# Compliance Audit Trail

## Architecture

The platform implements a **dual-layer audit trail**:
1. **On-Chain** (immutable, public, permanent): `ComplianceRegistry.sol`
2. **Off-Chain** (queryable, indexed, retained): `compliance_logs` PostgreSQL table

```
                Compliance Event
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
  ┌─────────────────┐   ┌──────────────────┐
  │ ComplianceRegistry│  │ compliance_logs   │
  │ (Smart Contract) │   │ (PostgreSQL)     │
  ├─────────────────┤   ├──────────────────┤
  │ Immutable       │   │ Queryable        │
  │ Public          │   │ Indexed          │
  │ Permanent       │   │ 7-year retention │
  │ Gas cost per tx │   │ Free to write    │
  │ Append-only     │   │ Indexed + filtered│
  └─────────────────┘   └──────────────────┘
          │                       │
          └───────────┬───────────┘
                      │
                      ▼
           Daily Integrity Check
        (hash comparison verification)
```

## What Gets Logged

Every compliance-relevant event is logged to both systems.

### Event Types

| Check Type | Trigger | Logged Data |
|------------|---------|-------------|
| `age_verification` | User submits proof via POST /api/compliance/verify-age | Proof hash, threshold, verification result |
| `access_attempt` | User requests content via POST /api/content/access/{id} | Content ID, required tier, age_restricted flag, result |
| `membership_minted` | User mints NFT | Tier, payment method, token ID, price |
| `membership_upgraded` | User upgrades tier | Old tier, new tier, upgrade cost |
| `membership_revoked` | Admin revokes | Admin ID, reason |
| `subscription_created` | User subscribes | Tier, duration, auto_renew, payment method |
| `subscription_cancelled` | User cancels | Previous subscription ID, reason |
| `subscription_expired` | Auto-detected | Subscription ID, end date |
| `payment_received` | Stripe webhook or direct payment | Amount, currency, payment method, status |
| `kyc_{provider}` | KYC webhook received | Provider, status (approved/denied/pending), verification ID |
| `compliance_check` | Automated compliance rules run | Rule results (age_verified, subscription_active, violations) |
| `violation` | Admin records compliance violation | Violation type, description, severity |
| `data_deletion` | User or admin deletes data | Deletion scope, user consent |
| `admin_action` | Any admin action | Action type, target, admin ID |

### Data Structure

#### Off-Chain (PostgreSQL)

Table: `compliance_logs`

```sql
CREATE TABLE compliance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    check_type VARCHAR(100) NOT NULL,
    check_hash VARCHAR(255) NOT NULL,
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX ix_compliance_logs_user_type_created 
    ON compliance_logs (user_id, check_type, created_at DESC);
```

#### On-Chain (Ethereum)

Contract: `ComplianceRegistry.sol`

```solidity
struct ComplianceCheck {
    address user;
    bytes32 checkHash;
    string checkType;
    uint256 timestamp;
}

ComplianceCheck[] private _allChecks;
mapping(address => uint256[]) private _userCheckIndices;
mapping(bytes32 => bool) private _checkHashes;

event ComplianceCheckRecorded(
    address indexed user,
    bytes32 indexed checkHash,
    string checkType,
    uint256 timestamp,
    uint256 indexed checkId
);
```

## Log Integrity

### Hash Verification

Every compliance log entry contains a `check_hash` which is a SHA-256 hash of the check data. The hash is stored both on-chain and off-chain, allowing integrity verification.

```python
# From backend/app/services/compliance_checker.py
import hashlib, json

check_data = {
    "user_id": user_id,
    "check_type": "age_verification",
    "result": "approved",
    "timestamp": datetime.now(timezone.utc).isoformat(),
}

# Generate hash
check_hash = hashlib.sha256(
    json.dumps(check_data, sort_keys=True, default=str).encode()
).hexdigest()

# Log off-chain
compliance_log = ComplianceLog(
    user_id=user_id,
    check_type="age_verification",
    check_hash=check_hash,
    metadata=check_data,
)
db.add(compliance_log)

# Log on-chain
registry.recordCheck(
    user_wallet_address,
    bytes(check_hash, 'utf-8'),
    "age_verification",
    block.timestamp
)
```

### Integrity Verification Process

```
Step 1: Query off-chain log entry
  check_hash = "0xabc123..."
  check_type = "age_verification"
  metadata = { user_id, result, timestamp }

Step 2: Re-compute hash from metadata
  computed_hash = SHA256(JSON(metadata))
  assert computed_hash == check_hash

Step 3: Query on-chain entry
  on_chain_hash = ComplianceRegistry.getCheck(checkId).checkHash
  assert on_chain_hash == check_hash

Step 4: All three match → integrity verified
```

### Proof of Integrity

Users and auditors can independently verify that:
1. Off-chain logs have not been tampered with (hash recomputation)
2. On-chain audit trail matches off-chain records (cross-reference)
3. No entries have been deleted (append-only on-chain)

## Querying Audit History

### User Query

Users can view their own compliance history:

**API**: `GET /api/compliance/audit-log?limit=50&offset=0`
**Auth**: Bearer token (user sees only their own logs)

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440040",
    "check_type": "age_verification",
    "check_hash": "0xabc123def456...",
    "metadata": {
      "threshold": 18,
      "age_verified": true
    },
    "ip_address": "192.168.1.100",
    "created_at": "2025-01-15T10:30:00+00:00"
  }
]
```

### Admin Query

Admins can query all users' logs with optional filtering:

**API**: `GET /api/admin/audit-log?skip=0&limit=100&user_id={optional}`
**Auth**: Bearer token (admin only)

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

### On-Chain Query

**View function**: `ComplianceRegistry.getCheckHistory(address user)`

```solidity
// Returns all ComplianceCheck structs for a user
function getCheckHistory(address user) external view returns (ComplianceCheck[] memory);

// Paginated query
function getUserChecksPaginated(
    address user,
    uint256 offset,
    uint256 limit
) external view returns (ComplianceCheck[] memory);

// Single check by ID
function getCheck(uint256 checkId) external view returns (ComplianceCheck memory);

// Check if a hash has been recorded
function isCheckRecorded(bytes32 checkHash) external view returns (bool);
```

Example query via ethers.js:

```javascript
const registry = new ethers.Contract(address, abi, provider);
const checks = await registry.getCheckHistory(userWalletAddress);
console.log(`${checks.length} compliance checks recorded`);
```

## Report Generation

### Automated Daily Report

**Workflow**: `compliance-audit.yml` (runs daily at 02:00 UTC)

**Script**: `backend/scripts/generate_compliance_report.py`

```bash
python backend/scripts/generate_compliance_report.py \
  --output-dir compliance-reports \
  --date $(date +%Y-%m-%d)
```

**Report Contents:**
- All compliance log entries for the date range
- Summary statistics (total checks, pass/fail rates, check types)
- Expired verification list
- Integrity verification results
- Visualizations (check type breakdown, daily trends)
- Format: XLSX (tabular) + Markdown (summary)

### Report Schema

```json
{
  "report_date": "2025-01-15",
  "generated_at": "2025-01-16T02:00:00Z",
  "total_checks": 12450,
  "unique_users": 823,
  "check_type_breakdown": {
    "age_verification": 3200,
    "access_attempt": 5800,
    "subscription_created": 150,
    "payment_received": 1100,
    "compliance_check": 2100,
    "other": 100
  },
  "compliance_rate": 94.5,
  "expired_verifications": 12,
  "integrity_passed": true,
  "data_integrity": {
    "off_chain_entries": 12450,
    "on_chain_entries": 12450,
    "mismatches": 0
  }
}
```

## Integration with External Auditors

### Auditor Access

External auditors can access the compliance trail through:

1. **Read-Only API Access**: Dedicated auditor API key with read-only access to compliance endpoints
2. **On-Chain Explorer**: Public access to ComplianceRegistry on the blockchain explorer (e.g., Etherscan, Basescan)
3. **Exported Reports**: Daily compliance reports archived as CI artifacts (90-day retention)

### Auditor Verification Steps

```
1. Request full compliance log export via admin API
2. Random sample selected for verification
3. For each sampled entry:
   a. Retrieve off-chain metadata
   b. Re-compute SHA-256 hash
   c. Compare with stored check_hash
   d. Query on-chain: ComplianceRegistry.getCheck(checkId)
   e. Verify on-chain hash matches off-chain hash
4. Generate auditor report with findings
5. Report integrity status (pass/fail with evidence)
```

### Smart Contract Verification

Contracts are verified on public block explorers:

- **Etherscan**: Source code verification with matching compilation metadata
- **Sourcify**: Full metadata and bytecode verification
- **Hardhat Verify**: Automated via `hardhat-verify` plugin

## Data Retention and Archiving

### Retention Schedule

| Data | Active Storage | Archive | Deletion |
|------|---------------|---------|----------|
| Compliance logs (off-chain) | 90 days (hot) | 7 years (cold storage) | After 7 years |
| Compliance checks (on-chain) | Permanent | Permanent (blockchain) | Never (immutable) |
| Report artifacts | 90 days | 7 years (S3 Glacier) | After 7 years |

### Archiving Process

1. **Monthly**: Move compliance logs older than 90 days to cold storage
2. **Yearly**: Package yearly audit artifacts into encrypted archives
3. **On-Demand**: Export for regulatory requests within 72 hours

### Deletion Process

When a user requests data deletion (GDPR Article 17):

1. User profile anonymized (wallet address removed, display name set to "Deleted User")
2. Compliance logs with `ip_address` and `user_agent` anonymized
3. Subscriptions cancelled
4. On-chain data cannot be deleted; user is informed during onboarding
5. Deletion logged as `data_deletion` compliance event
