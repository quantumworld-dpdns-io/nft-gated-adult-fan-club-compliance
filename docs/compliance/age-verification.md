# Age Verification Compliance

## Regulatory Framework

The platform must comply with age verification regulations across multiple jurisdictions. This document maps the platform's compliance approach to key regulatory requirements.

### Key Regulations

| Regulation | Jurisdiction | Key Requirements | Impact on Platform |
|------------|-------------|------------------|-------------------|
| **GDPR** (Art. 5, 6, 8) | EU/EEA | Lawful basis for processing; data minimization; consent for under-16 | Minimal data collection; ZK proofs avoid processing PII |
| **COPPA** | USA (federal) | Parental consent for under-13; data collection restrictions | Platform targets 18+ only; age gate prevents underage access |
| **Age Verification Laws** | UK, Germany, France | Mandatory age verification for adult content platforms | ZK proof satisfies "reasonable age verification" standard |
| **CCPA/CPRA** | California (USA) | Consumer right to know/delete personal information | Minimal data stored; deletion API available |
| **AVMS Directive** | EU | Age verification for video-sharing platforms | On-chain compliance audit trail provides regulatory evidence |
| **Online Safety Bill** | UK | Duty of care for user safety; age verification for pornography | Platform-level age gating with ZK proofs |
| **LGPD** | Brazil | Similar to GDPR; data protection for children | Age gate at 18; minimal data processing |

## How the Platform Achieves Compliance

### Layered Compliance Approach

```
Layer 1: Age Gate (ZK Proof)
  ├── No PII collected
  ├── Zero-knowledge proof of age >= 18
  ├── Proof verified server-side and recorded on-chain
  └── User privacy fully protected
      │
Layer 2: Membership Tier (Conditional)
  ├── Requires age verification before purchase
  ├── Additional KYC for PREMIUM/VIP tiers (optional)
  ├── Stripe payment processing with identity verification
  └── Subscription auto-renewal checks compliance status
      │
Layer 3: Ongoing Audit (Continuous)
  ├── Every access attempt logged (ComplianceLog + ComplianceRegistry)
  ├── Daily automated compliance report generation
  ├── Periodic re-verification (configurable expiry)
  └── Admin review and manual override capabilities
```

### Compliance-by-Design Principles

1. **Data Minimization**: Only collect data absolutely necessary for the service
2. **Privacy by Default**: Age verification uses ZK proofs; no birth date stored
3. **Auditability**: Every compliance event is logged immutably
4. **User Control**: Users can view their audit log and request data deletion
5. **Transparency**: All data processing documented and disclosed
6. **Security**: Encrypted at rest and in transit; regular security audits

## ZK Proof Approach vs Traditional KYC

| Aspect | ZK Proof (Platform) | Traditional KYC Document Upload |
|--------|---------------------|----------------------------------|
| **Data Collected** | None (only proof hash) | Full name, DOB, address, ID photos |
| **Privacy** | ✅ Full (birth date never leaves device) | ❌ Complete PII exposure |
| **Storage Liability** | ✅ None (no PII stored) | ❌ High (must secure KYC documents) |
| **Verification Time** | ✅ Instant (< 1 second) | ❌ Minutes to hours (manual review) |
| **User Friction** | ✅ Low (enter DOB, automatic) | ❌ High (find ID, take photo, upload) |
| **Regulatory Acceptance** | ⚠️ Emerging (accepted in UK/EU) | ✅ Well-established |
| **Cost per Verification** | ✅ < $0.01 (gas on L2) | ❌ $1-$5 per KYC check |
| **Sybil Resistance** | ❌ Low (multiple wallets) | ✅ High (government ID) |
| **Reusability** | ✅ Proof valid for configurable period | ❌ Must re-submit for each service |

### When to Use Each Approach

| Scenario | Recommended Approach |
|----------|---------------------|
| Basic age gate (18+ check) | ✅ ZK proof (default) |
| High-value membership (VIP tier) | ZK proof + optional KYC |
| Regulatory audit trail | ZK proof on-chain + KYC webhook |
| Legal/compliance investigation | KYC document verification |
| User requests data deletion | ZK proof is non-identifiable; KYC data deleted |

## Age Verification Threshold Configuration

### Configuration

The age threshold is configured via the `AGE_VERIFICATION_THRESHOLD` environment variable:

```env
# .env
AGE_VERIFICATION_THRESHOLD=18
```

### Default Thresholds

| Tier | Age Threshold | Rationale |
|------|---------------|-----------|
| **Standard** | 18 | Minimum age for adult content in most jurisdictions |
| **UK/EU** | 18 | Online Safety Bill / AVMS Directive compliance |
| **US** | 18 (varies by state) | Federal minimum; some states require 21 |

### Per-User Override

The `POST /api/compliance/verify-age` endpoint accepts an optional `threshold` field:

```json
{
  "dob": "1990-01-15",
  "threshold": 21
}
```

This allows the platform to enforce stricter thresholds for specific content tiers without changing the global setting.

## User Data Privacy

### Minimal Data Collection by Design

The `User` model stores only:

| Field | Stored? | Purpose |
|-------|---------|---------|
| `wallet_address` | ✅ Yes | Authentication and on-chain identity |
| `email` | ⚠️ Optional | Notifications and account recovery |
| `display_name` | ⚠️ Optional | UI personalization |
| `age_verified` | ✅ Boolean only | Compliance check result |
| `age_verified_at` | ✅ Timestamp | Verification expiry tracking |
| `membership_tier` | ✅ Yes | Access control |
| `membership_token_id` | ✅ Yes | Contract reference |

`Fields explicitly NOT stored:`
- Date of birth ❌
- Government ID numbers ❌
- Physical address ❌
- IP address (in compliance_logs, not in user profile) ⚠️

### Birth Date Processing Flow

```
User enters DOB ──▶ Client-side processing ──▶ ZK proof ──▶ API
                                                              │
                     DOB never leaves device ◀────────────────┘
                     Only verification result stored
```

## Compliance Audit Trail Specification

See `docs/compliance/audit-trail.md` for full details. Summary:

### Off-Chain Audit Log

Table: `compliance_logs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID FK | Reference to user |
| `check_type` | VARCHAR(100) | Type of compliance check |
| `check_hash` | VARCHAR(255) | SHA-256 hash of check data |
| `metadata` | JSONB | Additional check context |
| `ip_address` | VARCHAR(45) | Client IP address |
| `user_agent` | TEXT | Client user agent |
| `created_at` | TIMESTAMPTZ | When the check occurred |

### On-Chain Audit Log

Contract: `ComplianceRegistry.sol`

| Event | Data |
|-------|------|
| `ComplianceCheckRecorded` | `user` (address), `checkHash` (bytes32), `checkType` (string), `timestamp` (uint256), `checkId` (uint256) |

## Retention Policies

| Data Type | Retention Period | Rationale |
|-----------|-----------------|-----------|
| Compliance logs (off-chain) | 7 years | Regulatory requirement for adult content platforms |
| ComplianceRegistry (on-chain) | Permanent | Blockchain is immutable by design |
| User profile data | Until account deletion | GDPR right to erasure |
| Payment records | 7 years | Tax and financial audit requirements |
| Age verification proof hashes | Duration of verification + 90 days | Proof expiry + grace period |
| Session tokens | Until logout + 60 min expiry | JWT expiry time |
| IP addresses in logs | 90 days | Security incident investigation |
| Email addresses | Until account deletion | User communication |

### Data Deletion API

Users can request data deletion via:

1. **POST /api/auth/delete-account**: Deletes user profile, subscriptions, and associated compliance logs
2. **Manual process**: Admin can delete data via admin panel (GDPR Article 17 compliance)

Note: On-chain data (ComplianceRegistry, MembershipNFT) cannot be deleted due to blockchain immutability. Users are informed of this during onboarding.

## Jurisdictional Considerations

### Current Support

| Jurisdiction | Age Threshold | Verification Method | Special Requirements |
|--------------|---------------|--------------------|---------------------|
| United States (federal) | 18 | ZK proof | Varies by state (21 in some contexts) |
| European Union | 18 | ZK proof + GDPR consent | Data processing register required |
| United Kingdom | 18 | ZK proof | Age-verification arrangement under Online Safety Act |
| Canada | 18 | ZK proof | Provincial variations (18 or 19) |
| Australia | 18 | ZK proof | Classified as Category 1 Restricted Material |

### Geo-Targeting by Jurisdiction

The platform supports per-jurisdiction configuration:

```json
{
  "EU": {
    "age_threshold": 18,
    "require_kyc_for_vip": false,
    "data_retention_days": 2555,  // 7 years
    "gdpr_compliant": true
  },
  "US_CA": {
    "age_threshold": 18,
    "require_kyc_for_vip": true,
    "data_retention_days": 2555,
    "ccpa_compliant": true
  },
  "UK": {
    "age_threshold": 18,
    "require_kyc_for_vip": false,
    "data_retention_days": 2555,
    "online_safety_act": true
  }
}
```

Jurisdiction detection is based on:
1. IP geolocation (initial guess)
2. User-declared jurisdiction (profile setting)
3. Wallet connection origin (EIP-3770 chain prefix)

## Regular Compliance Audit Process

### Automated Daily Audit

GitHub Actions workflow: `.github/workflows/compliance-audit.yml`

**Schedule**: Daily at 02:00 UTC

**Process:**
```
1. Generate Compliance Report
   ├── Query all compliance_logs from PostgreSQL
   ├── Verify integrity against ComplianceRegistry on-chain hashes
   ├── Check for expired age verifications
   ├── Identify users with lapsed compliance
   ├── Generate Excel + JSON report
   └── Archive to artifacts (90 days)

2. Check Expired Verifications
   ├── Find verifications older than 30 days
   ├── Export to JSON
   ├── Generate notification list
   └── Send alerts to affected users

3. Audit Summary
   ├── Check audit generation success
   ├── Check expired verification check success
   └── Output summary to GitHub Actions step summary
```

### Manual Audit

Admins can generate on-demand compliance reports:

```bash
# Generate compliance report for a specific date
python backend/scripts/generate_compliance_report.py \
  --output-dir ./compliance-reports \
  --date 2025-01-15

# Check expired verifications
python backend/scripts/check_expired_verifications.py \
  --days-threshold 30 \
  --format json
```

### Compliance Reports

The daily audit generates:

| Artifact | Format | Contents |
|----------|--------|----------|
| Full compliance report | XLSX/CSV | All compliance_logs for the day, user statuses, verification expiry dates |
| Summary | Markdown | High-level metrics (total users, verified %, compliance rate) |
| Expired verifications | JSON | List of users whose age verification has expired |
| Integrity check | JSON | Off-chain vs on-chain hash comparison results |
