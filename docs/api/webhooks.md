# Webhook Specifications

## Overview

The platform receives webhooks from two external services:
1. **Stripe** — Payment events (payment intents, subscriptions)
2. **KYC Provider** — Age/identity verification results

All webhooks are received as HTTP POST requests with JSON payloads and must include signature verification for authenticity.

---

## Stripe Webhooks

### Endpoint

```
POST /api/payments/webhook/stripe
```

### Signature Verification

Stripe webhooks are verified using the `stripe-signature` header and the configured `STRIPE_WEBHOOK_SECRET`.

```python
# Backend verification logic
event = stripe.Webhook.construct_event(
    payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
)
```

If verification fails, the endpoint returns `HTTP 400` with detail `"Invalid signature"`.

### Supported Events

#### `payment_intent.succeeded`

Triggered when a payment completes successfully. Creates a `Payment` record in the database.

**Payload:**
```json
{
  "id": "evt_3Qxyz...",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_3Qxyz...",
      "amount": 2499,
      "currency": "usd",
      "status": "succeeded",
      "metadata": {
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "payment_type": "membership",
        "tier_id": "550e8400-e29b-41d4-a716-446655440001"
      },
      "payment_method": "pm_abc123",
      "customer": "cus_xyz789",
      "created": 1736872200
    }
  }
}
```

**Processing:**
1. Verify signature
2. Extract `user_id` from metadata
3. Create `Payment` record (amount, currency, status, payment_type)
4. If payment is for membership, trigger membership minting
5. Log to compliance audit trail

#### `payment_intent.payment_failed`

Triggered when a payment attempt fails.

**Payload:**
```json
{
  "id": "evt_3Qxyz...",
  "type": "payment_intent.payment_failed",
  "data": {
    "object": {
      "id": "pi_3Qxyz...",
      "amount": 2499,
      "currency": "usd",
      "status": "failed",
      "last_payment_error": {
        "code": "card_declined",
        "message": "Your card was declined."
      },
      "metadata": {
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "payment_type": "membership"
      }
    }
  }
}
```

**Processing:**
1. Verify signature
2. Extract `user_id` from metadata
3. Create `Payment` record with status `failed`
4. Log payment failure to compliance audit trail
5. (Optional) Notify user of failed payment

#### `customer.subscription.created`

Triggered when a new subscription is created in Stripe.

**Payload:**
```json
{
  "id": "evt_3Qxyz...",
  "type": "customer.subscription.created",
  "data": {
    "object": {
      "id": "sub_abc123",
      "customer": "cus_xyz789",
      "status": "active",
      "current_period_start": 1736872200,
      "current_period_end": 1739464200,
      "items": {
        "data": [
          {
            "price": {
              "product": "prod_basic_monthly",
              "unit_amount": 999
            }
          }
        ]
      },
      "metadata": {
        "user_id": "550e8400-e29b-41d4-a716-446655440000"
      }
    }
  }
}
```

#### `customer.subscription.updated`

Triggered when a subscription is updated (upgrade, downgrade, renewal).

**Payload:**
```json
{
  "id": "evt_3Qxyz...",
  "type": "customer.subscription.updated",
  "data": {
    "object": {
      "id": "sub_abc123",
      "customer": "cus_xyz789",
      "status": "active",
      "current_period_start": 1736872200,
      "current_period_end": 1739464200,
      "cancel_at_period_end": false,
      "metadata": {
        "user_id": "550e8400-e29b-41d4-a716-446655440000"
      }
    }
  }
}
```

#### `customer.subscription.deleted`

Triggered when a subscription is cancelled or expires.

**Payload:**
```json
{
  "id": "evt_3Qxyz...",
  "type": "customer.subscription.deleted",
  "data": {
    "object": {
      "id": "sub_abc123",
      "customer": "cus_xyz789",
      "status": "canceled",
      "ended_at": 1736872200,
      "metadata": {
        "user_id": "550e8400-e29b-41d4-a716-446655440000"
      }
    }
  }
}
```

### Stripe Event Processing Flow

```
Stripe ──POST──▶ /api/payments/webhook/stripe
  │
  ├─▶ Verify stripe-signature header
  ├─▶ Construct event object
  ├─▶ Route by event type:
  │   ├── payment_intent.succeeded → Create Payment record, mint membership
  │   ├── payment_intent.payment_failed → Create Payment record (failed), notify
  │   ├── customer.subscription.created → Sync subscription state
  │   ├── customer.subscription.updated → Update subscription in DB
  │   └── customer.subscription.deleted → Mark subscription as inactive
  └─▶ Return 200 OK
```

### Idempotency

Stripe may deliver the same event multiple times. The backend handles idempotency by:

1. **Payment Intent ID Uniqueness**: The `stripe_payment_intent_id` column in the `payments` table has a UNIQUE constraint. Duplicate events with the same payment intent ID will fail at the database level and be caught by the session rollback.

2. **Event IDempotency Key**: Stripe sends an `Idempotency-Key` header on retries. The backend can optionally store processed event IDs in Redis to skip duplicate processing.

### Retry Policy

| Condition | Retry Behavior |
|-----------|----------------|
| HTTP 4xx (bad request) | Stripe does not retry; log and investigate |
| HTTP 5xx (server error) | Stripe retries with exponential backoff (up to 3 times) |
| Timeout ( > 10s) | Stripe retries with exponential backoff |
| Network error | Stripe retries for up to 3 days |

The backend should acknowledge webhooks quickly (< 2 seconds) to avoid Stripe timeouts. Heavy processing (e.g., minting NFTs) should be queued as background tasks.

---

## KYC Provider Webhooks

### Endpoint

```
POST /api/compliance/webhook/kyc
```

### Authentication

KYC webhooks are authenticated via:
1. **Static API Key** (recommended): Passed in `Authorization: Bearer <kyc_api_key>` header
2. **IP Allowlisting**: Restrict to known KYC provider IP ranges
3. **Signature Verification**: HMAC-SHA256 signature in `X-Signature` header using shared secret

### Supported Events

#### `verification.approved`

Triggered when a KYC verification is approved.

**Payload:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "approved",
  "provider": "kyc_provider_name",
  "data": {
    "document_type": "passport",
    "document_country": "US",
    "verification_id": "ver_abc123",
    "verified_at": "2025-01-15T10:30:00Z",
    "age_verified": true,
    "age_threshold": 18,
    "identity_confirmed": true
  }
}
```

**Processing:**
1. Verify signature or API key
2. Look up user by `user_id`
3. Set `user.age_verified = True` and `user.age_verified_at = now()`
4. Create `ComplianceLog` entry with check type `kyc_{provider}`
5. If contract is configured, call `AgeVerificationOracle.submitVerification()`

#### `verification.denied`

Triggered when a KYC verification is denied.

**Payload:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "denied",
  "provider": "kyc_provider_name",
  "data": {
    "verification_id": "ver_abc123",
    "reason": "document_verification_failed",
    "details": "The submitted document could not be verified as authentic"
  }
}
```

**Processing:**
1. Verify signature or API key
2. Look up user by `user_id`
3. Do NOT set age_verified (remains false)
4. Create `ComplianceLog` entry with check type `kyc_{provider}` and status `denied`
5. (Optional) Notify user of denial with instructions to retry

#### `verification.pending`

Triggered when a KYC verification requires additional review.

**Payload:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "provider": "kyc_provider_name",
  "data": {
    "verification_id": "ver_abc123",
    "reason": "additional_review_required"
  }
}
```

### KYC Webhook Processing Flow

```
KYC Provider ──POST──▶ /api/compliance/webhook/kyc
  │
  ├─▶ Verify auth (API key / HMAC signature / IP allowlist)
  ├─▶ Rate limit check (5 req/60s per IP)
  ├─▶ Look up user by user_id
  ├─▶ Route by status:
  │   ├── approved → Set age_verified=True, log, optionally record on-chain
  │   ├── denied → Log denial, optionally notify user
  │   └── pending → Log pending status
  └─▶ Return 200 OK
```

### Idempotency

KYC webhooks include a `verification_id` in the data payload. The backend should:

1. Store processed `verification_id` values in Redis with a TTL of 7 days
2. Before processing a webhook, check if `verification_id` has already been processed
3. If duplicate, return `200 OK` without processing

### Retry Policy

| Condition | Retry Behavior |
|-----------|----------------|
| HTTP 4xx (except 429) | Do not retry; provider should log error |
| HTTP 429 (rate limit) | Retry after `Retry-After` header delay |
| HTTP 5xx | Retry with exponential backoff (3 attempts, 30s/60s/120s delays) |
| Timeout | Retry after 60 seconds |

---

## Webhook Security Best Practices

### Verification Steps

1. **Always verify signatures** before processing payloads
2. **Never parse the payload before verification** (to avoid signature stripping attacks)
3. **Use constant-time comparison** for signature verification
4. **Log all webhook receipts** for audit trail (event ID, timestamp, source IP, signature)
5. **Implement timeout limits** on webhook processing (return 200 quickly, process async)
6. **Use separate webhook secrets** for staging and production environments

### Stripe-Specific

- Rotate `STRIPE_WEBHOOK_SECRET` periodically
- Verify the webhook URL is HTTPS in production
- Use Stripe's `webhook_endpoints` API to manage destinations

### KYC Provider-Specific

- Rotate shared secrets quarterly
- Maintain IP allowlist for KYC provider servers
- Use separate API keys for different environments

---

## Testing Webhooks Locally

### Stripe CLI

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward events to local backend
stripe listen --forward-to localhost:8000/api/payments/webhook/stripe

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.created
```

### KYC Test Webhook

```bash
curl -X POST http://localhost:8000/api/compliance/webhook/kyc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-kyc-api-key" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "approved",
    "provider": "test_provider",
    "data": {
      "verification_id": "test_ver_001",
      "age_verified": true,
      "age_threshold": 18
    }
  }'
```
