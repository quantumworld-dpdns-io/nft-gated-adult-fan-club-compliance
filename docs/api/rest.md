# REST API Reference

## Overview

- **Base URL**: `http://localhost:8000` (dev) / `https://api.nft-fanclub.example.com` (production)
- **Authentication**: Bearer JWT token in `Authorization` header
- **Content-Type**: `application/json`
- **Rate Limiting**: Per-endpoint sliding window limits (see each endpoint)
- **OpenAPI/Swagger**: `GET /docs` (dev) or `GET /openapi.json`

## Authentication

All endpoints except `GET /health`, `POST /api/auth/login/wallet`, `POST /api/auth/login/oauth`, and `POST /api/auth/register` require a Bearer JWT token.

```
Authorization: Bearer <jwt_token>
```

The JWT is obtained from the login endpoints and expires after `ACCESS_TOKEN_EXPIRE_MINUTES` (default 60). Use `POST /api/auth/refresh` to obtain a new token.

## Error Codes

| Status Code | Meaning |
|-------------|---------|
| 400 | Bad Request — Invalid input parameters |
| 401 | Unauthorized — Missing or invalid token |
| 403 | Forbidden — Insufficient permissions |
| 404 | Not Found — Resource does not exist |
| 409 | Conflict — Resource already exists |
| 429 | Too Many Requests — Rate limit exceeded |
| 500 | Internal Server Error — Backend failure |
| 501 | Not Implemented — Feature not configured (e.g., Stripe) |

Standard error response body:
```json
{
  "detail": "Human-readable error message"
}
```

Rate limit error response:
```json
{
  "detail": "Rate limit exceeded. Try again later."
}
```

---

## Auth Router

Prefix: `/api/auth`

### `POST /api/auth/login/wallet`

Authenticate using a wallet signature (EIP-191).

**Rate Limit**: 20 requests per 60 seconds (per IP)

**Request Body:**
```json
{
  "wallet_address": "0x1234...5678",
  "message": "Sign this message to authenticate with NFT Fan Club",
  "signature": "0xabcd...ef01"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "wallet_address": "0x1234...5678"
}
```

**Errors:** `401` — Invalid wallet signature

### `POST /api/auth/login/oauth`

Authenticate using an OAuth provider (Google or Discord).

**Request Body:**
```json
{
  "provider": "google",
  "code": "oauth-authorization-code",
  "redirect_uri": "https://app.example.com/auth/callback"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "wallet_address": "oauth_google_abc123"
}
```

**Errors:** `400` — Unsupported OAuth provider

### `POST /api/auth/register`

Register a new user with wallet address.

**Rate Limit**: 10 requests per 60 seconds (per IP)

**Request Body:**
```json
{
  "wallet_address": "0x1234...5678",
  "email": "user@example.com",
  "display_name": "CoolUser"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "wallet_address": "0x1234...5678"
}
```

**Errors:** `409` — Wallet address already registered

### `POST /api/auth/refresh`

Refresh an existing (possibly expired) JWT token to get a new one.

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "wallet_address": "0x1234...5678"
}
```

**Errors:** `401` — Invalid or expired token, user not found or inactive

### `POST /api/auth/logout`

Invalidate the current JWT token (adds to Redis blacklist).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

### `GET /api/auth/me`

Get the currently authenticated user's profile.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "wallet_address": "0x1234...5678",
  "email": "user@example.com",
  "display_name": "CoolUser",
  "age_verified": true,
  "membership_tier": "PREMIUM",
  "is_admin": false
}
```

---

## Membership Router

Prefix: `/api/membership`

### `GET /api/membership/tiers`

List all available membership tiers.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "BASIC",
    "description": "Basic membership with access to standard content",
    "price": 9.99,
    "token_price": "0.1",
    "duration_days": 30,
    "benefits": {
      "content_access": "standard",
      "priority_support": false
    }
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "name": "PREMIUM",
    "description": "Premium membership with full content access",
    "price": 24.99,
    "token_price": "0.5",
    "duration_days": 30,
    "benefits": {
      "content_access": "all",
      "priority_support": true,
      "exclusive_content": true
    }
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "name": "VIP",
    "description": "VIP membership with all benefits plus concierge service",
    "price": 49.99,
    "token_price": "1.0",
    "duration_days": 30,
    "benefits": {
      "content_access": "all",
      "priority_support": true,
      "exclusive_content": true,
      "concierge_service": true,
      "early_access": true
    }
  }
]
```

### `POST /api/membership/mint`

Mint a new membership NFT for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "tier_id": "550e8400-e29b-41d4-a716-446655440001",
  "payment_method": "stripe",
  "stripe_payment_intent_id": "pi_3Qxyz..."
}
```

**Response (200):**
```json
{
  "message": "Membership minted: BASIC",
  "tier": "BASIC",
  "subscription_id": "550e8400-e29b-41d4-a716-446655440010"
}
```

**Errors:** `404` — Tier not found

### `POST /api/membership/upgrade`

Upgrade an existing membership to a higher tier.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "tier_id": "550e8400-e29b-41d4-a716-446655440002",
  "payment_method": "stripe"
}
```

**Response (200):**
```json
{
  "message": "Upgraded to PREMIUM",
  "tier": "PREMIUM",
  "subscription_id": "550e8400-e29b-41d4-a716-446655440011"
}
```

**Errors:** `404` — Tier not found

### `GET /api/membership/status`

Get the membership status of the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "tier": "PREMIUM",
  "token_id": "42",
  "is_active": true,
  "age_verified": true
}
```

### `GET /api/membership/subscriptions`

List all subscriptions for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "tier_id": "550e8400-e29b-41d4-a716-446655440001",
    "start_date": "2025-01-01T00:00:00+00:00",
    "end_date": "2025-01-31T00:00:00+00:00",
    "active": true,
    "auto_renew": false
  }
]
```

### `POST /api/membership/subscribe`

Create a new subscription for a membership tier.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "tier_id": "550e8400-e29b-41d4-a716-446655440001",
  "auto_renew": true
}
```

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440012",
  "tier_id": "550e8400-e29b-41d4-a716-446655440001",
  "start_date": "2025-01-15T00:00:00+00:00",
  "end_date": "2025-02-14T00:00:00+00:00",
  "active": true,
  "auto_renew": true
}
```

**Errors:** `404` — Tier not found

### `POST /api/membership/cancel-subscription`

Cancel the currently active subscription.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Subscription cancelled",
  "subscription_id": "550e8400-e29b-41d4-a716-446655440012"
}
```

**Errors:** `404` — No active subscription found

---

## Content Router

Prefix: `/api/content`

### `GET /api/content`

List all active content (optionally filtered by category).

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter by category slug (optional) |

**Response (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "title": "Exclusive Behind the Scenes",
    "description": "Go behind the scenes of our latest production",
    "content_type": "video",
    "url": "https://cdn.nft-fanclub.example.com/videos/abc123.mp4",
    "thumbnail_url": "https://cdn.nft-fanclub.example.com/thumbnails/abc123.jpg",
    "required_tier": "PREMIUM",
    "age_restricted": true,
    "category_id": "550e8400-e29b-41d4-a716-446655440030"
  }
]
```

### `GET /api/content/{content_id}`

Get details of a specific content item.

**Headers:** `Authorization: Bearer <token>`

**Response (200):** Same schema as list response

**Errors:** `404` — Content not found

### `POST /api/content/access/{content_id}`

Request access to a specific content item. Performs token-gated access check.

**Headers:** `Authorization: Bearer <token>`

**Response (200) — Granted:**
```json
{
  "granted": true,
  "reason": "Access granted"
}
```

**Response (200) — Denied:**
```json
{
  "granted": false,
  "reason": "Age verification required"
}
```

Or:
```json
{
  "granted": false,
  "reason": "Membership required: PREMIUM"
}
```

**Errors:** `404` — Content not found

### `GET /api/content/categories`

List all content categories.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440030",
    "name": "Videos",
    "slug": "videos",
    "description": "Video content including behind-the-scenes and exclusives"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440031",
    "name": "Photos",
    "slug": "photos",
    "description": "Photo galleries"
  }
]
```

---

## Compliance Router

Prefix: `/api/compliance`

### `POST /api/compliance/verify-age`

Submit a date of birth for age verification. Generates a proof hash and checks against the configured age threshold.

**Rate Limit**: 5 requests per 60 seconds (per user)

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "dob": "1990-01-15",
  "threshold": 18
}
```

**Response (200) — Verified:**
```json
{
  "proof": {
    "proof_hash": "0xabc123def456...",
    "is_verified": true,
    "age": 35,
    "public_inputs": {
      "threshold": 18,
      "verified": true
    }
  },
  "verified": true,
  "message": "Age verified successfully"
}
```

**Response (200) — Underage:**
```json
{
  "proof": {
    "proof_hash": "0xdef789abc012...",
    "is_verified": false,
    "age": 16,
    "public_inputs": {
      "threshold": 18,
      "verified": false
    }
  },
  "verified": false,
  "message": "Age verification failed: underage"
}
```

**Errors:** `400` — Invalid date format (use YYYY-MM-DD)

### `GET /api/compliance/verify-status`

Check the current age verification status for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "wallet_address": "0x1234...5678",
  "age_verified": true,
  "verified_on_chain": true,
  "error": null
}
```

### `GET /api/compliance/audit-log`

Get the audit log entries for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 50 | Maximum number of entries |
| `offset` | int | 0 | Number of entries to skip |

**Response (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440040",
    "check_type": "age_verification",
    "check_hash": "0xabc123def456...",
    "metadata": {
      "age_verified": true,
      "threshold": 18
    },
    "ip_address": "192.168.1.100",
    "created_at": "2025-01-15T10:30:00+00:00"
  }
]
```

### `POST /api/compliance/webhook/kyc`

Receive KYC verification results from a third-party KYC provider.

**Rate Limit**: 5 requests per 60 seconds (per IP)

**Request Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "approved",
  "provider": "kyc_provider_name",
  "data": {
    "document_type": "passport",
    "verification_id": "ver_abc123"
  }
}
```

**Response (200):**
```json
{
  "message": "KYC webhook processed",
  "status": "approved"
}
```

**Errors:** `404` — User not found

### `GET /api/compliance/report`

Get a compliance report for the authenticated user. Runs all configured compliance rules.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "compliant": true,
  "checks": [
    {
      "rule": "age_verified",
      "type": "age_verified",
      "passed": true,
      "severity": "high",
      "details": {
        "age_verified": true,
        "age_verified_at": "2025-01-15T10:30:00+00:00"
      }
    },
    {
      "rule": "subscription_active",
      "type": "subscription_active",
      "passed": true,
      "severity": "high",
      "details": {
        "has_active_subscription": true,
        "subscription_id": "550e8400-e29b-41d4-a716-446655440012"
      }
    },
    {
      "rule": "no_previous_violations",
      "type": "no_previous_violations",
      "passed": true,
      "severity": "medium",
      "details": {
        "has_violations": false
      }
    }
  ],
  "timestamp": "2025-01-15T12:00:00+00:00"
}
```

---

## Admin Router

Prefix: `/api/admin`

All admin endpoints require `is_admin = true` in the JWT claims.

### `GET /api/admin/users`

List all users (paginated).

**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skip` | int | 0 | Number of users to skip |
| `limit` | int | 50 | Maximum number of users |

**Response (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "wallet_address": "0x1234...5678",
    "email": "user@example.com",
    "display_name": "CoolUser",
    "age_verified": true,
    "membership_tier": "PREMIUM",
    "is_admin": false,
    "is_active": true,
    "created_at": "2025-01-01T00:00:00+00:00"
  }
]
```

### `GET /api/admin/users/{user_id}`

Get details of a specific user.

**Headers:** `Authorization: Bearer <admin_token>`

**Response (200):** Same schema as list response

**Errors:** `404` — User not found

### `POST /api/admin/users/{user_id}/revoke`

Revoke a user's membership. Deactivates their subscription and removes their membership tier.

**Headers:** `Authorization: Bearer <admin_token>`

**Response (200):**
```json
{
  "message": "Membership revoked",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors:** `404` — User not found

### `GET /api/admin/audit-log`

Get the full audit log across all users.

**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skip` | int | 0 | Number of entries to skip |
| `limit` | int | 100 | Maximum number of entries |
| `user_id` | string | null | Filter by user ID |

**Response (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440040",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "check_type": "age_verification",
    "check_hash": "0xabc123def456...",
    "metadata": {},
    "ip_address": "192.168.1.100",
    "created_at": "2025-01-15T10:30:00+00:00"
  }
]
```

### `GET /api/admin/metrics`

Get platform-wide metrics.

**Headers:** `Authorization: Bearer <admin_token>`

**Response (200):**
```json
{
  "total_users": 1500,
  "active_subscriptions": 823,
  "age_verified_users": 1200,
  "total_payments": 45230.50,
  "payment_count": 950,
  "content_count": 45
}
```

### `GET /api/admin/compliance/summary`

Get a compliance summary across all users.

**Headers:** `Authorization: Bearer <admin_token>`

**Response (200):**
```json
{
  "total_users": 1500,
  "verified_users": 1200,
  "unverified_users": 300,
  "compliance_rate": 80.0,
  "total_checks": 12500
}
```

---

## Payments Router

Prefix: `/api/payments`

### `POST /api/payments/create-payment-intent`

Create a Stripe PaymentIntent for membership payment.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "amount": 2499,
  "currency": "usd",
  "payment_type": "membership",
  "metadata": {
    "tier_id": "550e8400-e29b-41d4-a716-446655440001"
  }
}
```

**Response (200):**
```json
{
  "client_secret": "pi_3Qxyz_secret_abc123",
  "payment_intent_id": "pi_3Qxyz",
  "amount": 2499,
  "currency": "usd"
}
```

**Errors:** `501` — Stripe not configured

### `POST /api/payments/webhook/stripe`

Webhook endpoint for Stripe events. Verifies the Stripe signature before processing.

**Headers:**
| Header | Value |
|--------|-------|
| `stripe-signature` | Stripe webhook signature |
| `Content-Type` | `application/json` |

**Request Body:** Stripe event JSON payload

**Response (200):**
```json
{
  "message": "Webhook received",
  "event": "payment_intent.succeeded"
}
```

**Errors:** `400` — Missing signature or invalid signature; `501` — Webhook not configured

### `POST /api/payments/withdraw`

Initiate a withdrawal of platform funds (admin only).

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:**
```json
{
  "amount": "1.5",
  "destination": "0xabcd...ef01"
}
```

**Response (200):**
```json
{
  "message": "Withdrawal initiated",
  "amount": "1.5",
  "destination": "0xabcd...ef01",
  "status": "pending"
}
```

### `GET /api/payments/history`

Get the payment history for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440050",
    "amount": 24.99,
    "currency": "usd",
    "status": "succeeded",
    "payment_type": "membership",
    "stripe_payment_intent_id": "pi_3Qxyz",
    "metadata": {
      "tier_id": "550e8400-e29b-41d4-a716-446655440002"
    },
    "created_at": "2025-01-15T10:30:00+00:00"
  }
]
```

---

## Additional Endpoints

### `GET /health`

Health check endpoint (no authentication required).

**Response (200):**
```json
{
  "status": "ok",
  "database": "healthy",
  "redis": "healthy",
  "environment": "dev"
}
```

---

## Rate Limiting Summary

| Endpoint | Limit | Window | Scope |
|----------|-------|--------|-------|
| `POST /api/auth/login/wallet` | 20 | 60s | Per IP |
| `POST /api/auth/register` | 10 | 60s | Per IP |
| `POST /api/compliance/verify-age` | 5 | 60s | Per user |
| `POST /api/compliance/webhook/kyc` | 5 | 60s | Per IP |
| All other endpoints | 100 | 60s | Per user (general) |

Rate limiting uses Redis sliding window counters. When the limit is exceeded, the API responds with `HTTP 429` and the detail message `"Rate limit exceeded. Try again later."`.

## Webhook Events

See `docs/api/webhooks.md` for full webhook specifications, including:
- Stripe events (payment_intent.succeeded, payment_intent.failed, customer.subscription.*)
- KYC provider webhook events
- Payload schemas
- Signature verification
- Retry and idempotency policies
