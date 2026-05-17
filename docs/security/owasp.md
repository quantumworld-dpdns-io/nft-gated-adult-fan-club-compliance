# OWASP Top 10 (2021) Mitigation Strategy

This document details how the platform addresses each of the OWASP Top 10 web application security risks. Every mitigation is mapped to specific code, configuration, and infrastructure controls implemented across the stack.

---

## A01: Broken Access Control

**Risk**: Attackers bypass authorization checks to access restricted functionality or data.

### Mitigations

#### API-Level Access Control

| Control | Implementation | Location |
|---------|---------------|----------|
| JWT authentication | Bearer token required for all endpoints except `/health` | `backend/app/core/security.py:68-86` |
| Admin-only routes | `get_admin_user` dependency checks `is_admin` claim | `backend/app/core/security.py:89-95` |
| Token-gated content | `POST /api/content/access/{id}` checks membership tier + age verification | `backend/app/api/content.py:121-156` |
| Wallet signature verification | EIP-191 signature recovery prevents impersonation | `backend/app/core/security.py:59-65` |
| JWT blacklisting | Revoked tokens stored in Redis | `backend/app/core/redis.py:72-82` |

#### Smart Contract Access Control

| Control | Implementation | Contract |
|---------|---------------|----------|
| Ownable pattern | Admin functions restricted to contract owner | All contracts |
| onlyAuthorized | ComplianceRegistry accepts calls from owner + trusted forwarder | `ComplianceRegistry.sol:30-36` |
| onlyVerifier | AgeVerificationOracle accepts submissions from verifier + owner | `AgeVerificationOracle.sol:21-25` |
| Soulbound enforcement | `_update()` override prevents NFT transfers | `MembershipNFT.sol:165-173` |

#### Frontend Access Control

- Route guards for admin pages
- API calls re-verify auth server-side (defense in depth)
- No sensitive business logic in client-side code

---

## A02: Cryptographic Failures

**Risk**: Sensitive data exposed due to weak or missing cryptography.

### Mitigations

#### Data in Transit

| Control | Implementation |
|---------|---------------|
| TLS 1.3 | Enforced at ingress level (K8s Ingress + cert-manager) |
| HSTS headers | Configured in nginx frontend container |
| API over HTTPS | Production deployment requires TLS termination |

#### Data at Rest

| Control | Implementation |
|---------|---------------|
| Database encryption | PostgreSQL 16 TDE / disk-level encryption |
| Password hashing | bcrypt via passlib (`pwd_context`) |
| PII minimization | Birth date never stored; only verification result |
| Secrets in environment | All keys/secrets via environment variables, never in code |

#### Cryptographic Choices

| Use Case | Algorithm | Rationale |
|----------|-----------|-----------|
| JWT signing | HMAC-SHA256 | Fast, symmetric; secret rotated regularly |
| Wallet verification | ECDSA (secp256k1) | Ethereum standard; `eth_account` library |
| ZK proof commitment | Pedersen (Noir) | Zero-knowledge; birth date never revealed |
| Check hashing | SHA-256 | Standard for audit trail integrity |
| API rate limiting | SHA-256 (key derivation) | Fast, collision-resistant |

---

## A03: Injection

**Risk**: Attacker injects malicious input (SQL, NoSQL, OS commands, etc.).

### Mitigations

#### SQL Injection

| Control | Implementation |
|---------|---------------|
| Parameterized queries | SQLAlchemy ORM with bind parameters; no raw SQL strings |
| ORM layer | All database access through SQLAlchemy models |
| Input validation | Pydantic v2 models with strict type coercion and validation |

```python
# Safe: Parameterized query via SQLAlchemy ORM
result = await db.execute(
    select(User).where(User.wallet_address == wallet_address)
)

# Safe: Pydantic validation
class WalletLoginRequest(BaseModel):
    wallet_address: str  # Strict typing, length validation
    message: str
    signature: str
```

#### OS Command Injection

| Control | Implementation |
|---------|---------------|
| Nargo subprocess | `noir_prover.py` uses `asyncio.create_subprocess_exec` (no shell) |
| Path validation | Circuit paths checked for existence before execution |
| No user input in commands | All subprocess arguments are programmatically generated |

```python
# Safe: No shell=True, no user input in command
process = await asyncio.create_subprocess_exec(
    nargo, "compile",
    cwd=circuit_dir,
    stdout=asyncio.subprocess.PIPE,
    stderr=asyncio.subprocess.PIPE,
)
```

#### NoSQL Injection

- Redis commands use key-value operations with sanitized keys
- No user-controlled input used directly in Redis commands

#### XSS (Cross-Site Scripting)

- React JSX auto-escapes output
- Content-Security-Policy headers configured in nginx
- Input sanitization on all user-submitted content

---

## A04: Insecure Design

**Risk**: Architecture-level flaws that enable attacks.

### Mitigations

#### Compliance-First Design

- Every access attempt, age verification, and membership change is logged (dual on-chain + off-chain)
- Immutable audit trail on ComplianceRegistry.sol prevents log tampering
- Daily automated compliance audits verify integrity

#### Rate Limiting by Design

- Redis sliding window rate limiter at application level
- Per-endpoint limits (20/min for auth, 5/min for verify-age, 100/min general)
- Rate limiter in `app/core/security.py:98-110` for in-memory fallback
- Redis rate limiter in `app/core/redis.py:85-100` for distributed deployments

#### Defense in Depth

- Three trust boundaries (client ↔ API ↔ contracts)
- Every layer re-verifies auth (no trust between layers)
- Smart contracts validate all inputs independently of the API
- Fail closed: access denied by default, explicit grant required

#### Secure Defaults

- JWT tokens expire after 60 minutes
- New users have no membership until explicitly purchased
- Admin access requires explicit `is_admin` flag
- CORS configured per environment (restrictive in production)

---

## A05: Security Misconfiguration

**Risk**: Insecure default configurations, unnecessary features enabled, improper permissions.

### Mitigations

#### Kubernetes (Helm Chart)

| Control | Implementation | Location |
|---------|---------------|----------|
| Non-root containers | `runAsNonRoot: true` in security context | `infra/helm/nft-platform/templates/` |
| Read-only root filesystem | `readOnlyRootFilesystem: true` | Same |
| Resource limits | CPU/memory limits defined | Same |
| Network policies | Egress/ingress restrictions | `infra/k8s/network-policies.yaml` |
| Pod Security Policies | Restricted pod security standards | Same |

#### Backend Configuration

| Control | Implementation |
|---------|---------------|
| Debug mode disabled | `ENVIRONMENT=production` disables debug endpoints |
| CORS restricted | Production CORS origins explicitly listed |
| OpenAPI docs restricted | `/docs` disabled in production |
| Error details hidden | Global exception handler returns generic messages |

#### Smart Contract Configuration

| Control | Implementation |
|---------|---------------|
| Constructor initialization | All state variables initialized in constructors |
| No selfdestruct | Contracts do not include selfdestruct |
| Admin address | Owner address set at deployment; transferable |

---

## A06: Vulnerable and Outdated Components

**Risk**: Using components with known vulnerabilities.

### Mitigations

#### Dependency Scanning

| Tool | Scope | Frequency | Workflow |
|------|-------|-----------|----------|
| **Safety** | Python packages (`requirements.txt`) | Every push to main | `security-scan.yml` |
| **Snyk** | Python + JavaScript (all projects) | Every push to main | `security-scan.yml` |
| **Trivy** | Docker container images | Every push to main | `security-scan.yml` |
| **Dependabot** | GitHub dependency graph | Daily | GitHub-native |
| **OWASP Dependency-Check** | Java (Appium) | Weekly | `security-scan.yml` |

#### Update Policy

| Component | Update Cadence | Responsibility |
|-----------|----------------|----------------|
| Python packages | Monthly or when CVE published | Dependabot + manual review |
| npm packages | Monthly or when CVE published | Dependabot + manual review |
| Solidity/OpenZeppelin | Per OpenZeppelin release | Developer |
| Docker base images | Weekly | Renovate/Dependabot |
| Kubernetes | Per EKS/GKE release | DevOps |
| Noir/BB | Per release | Developer |

#### CI Controls

- `security-scan.yml` runs all dependency scans on push to main and weekly
- PRs cannot be merged if critical vulnerabilities are detected
- Scan reports uploaded as CI artifacts for audit

---

## A07: Identification and Authentication Failures

**Risk**: Weak authentication allows attackers to impersonate legitimate users.

### Mitigations

#### Authentication Methods

| Method | Strength | Notes |
|--------|----------|-------|
| Wallet signature (EIP-191) | **High** | Private key never leaves user's wallet; signature verified server-side |
| OAuth (Google/Discord) | **Medium** | Delegated to trusted providers; synthetic wallet address |
| JWT refresh token | **Medium** | Short-lived access tokens (60 min); refresh endpoint |

#### JWT Security

| Control | Implementation |
|---------|---------------|
| Short expiry | 60 minutes default (`ACCESS_TOKEN_EXPIRE_MINUTES`) |
| Blacklisting | Revoked tokens stored in Redis until natural expiry |
| No sensitive data in claims | Only `sub`, `wallet`, `is_admin` |
| Secure secret | `JWT_SECRET` from environment; minimum 256-bit |
| Algorithm pinning | Only HS256 allowed; no algorithm confusion |

#### Wallet Verification

```python
def verify_wallet_signature(wallet_address: str, message: str, signature: str) -> bool:
    message_encoded = encode_defunct(text=message)
    recovered = w3.eth.account.recover_message(message_encoded, signature=signature)
    return recovered.lower() == wallet_address.lower()
```

#### Session Management

- No session cookies (token-based auth)
- Token stored in `localStorage` (web) or `SecureStore` (mobile)
- Logout clears token from storage + adds to Redis blacklist
- No automatic token renewal; user must explicitly refresh

---

## A08: Software and Data Integrity Failures

**Risk**: Software updates or data pipelines compromised by untrusted sources.

### Mitigations

#### Supply Chain Security

| Control | Implementation |
|---------|---------------|
| Signed commits | GPG signing for all commits (team policy) |
| CI/CD integrity | GitHub Actions workflows pinned to commit SHAs |
| Container signing | Future: cosign signing of Docker images |
| Dependency integrity | `package-lock.json` and `requirements.txt` with hashes |
| Immutable releases | Git tags + GitHub releases with release notes |

#### Data Integrity

| Control | Implementation |
|---------|---------------|
| On-chain audit trail | `ComplianceRegistry.sol` append-only array; data cannot be modified |
| Check hash verification | SHA-256 hash of each compliance event stored on-chain |
| Log integrity | Off-chain logs verified against on-chain hashes during daily audit |
| Smart contract verification | Contracts verified on Etherscan/Sourcify |
| Database constraints | Unique constraints, foreign keys, check constraints |

#### CI/CD Pipeline Integrity

- All workflows use `actions/checkout@v4` (pinned version)
- Docker images built from source, not pre-built artifacts
- Artifact attestation (future: SLSA Level 2+)
- Separate staging and production environments with approval gates

---

## A09: Security Logging and Monitoring Failures

**Risk**: Insufficient logging or monitoring delays incident detection.

### Mitigations

#### Logging Strategy

| Log Type | Destination | Retention | Contents |
|----------|-------------|-----------|----------|
| Application logs | stdout (container) → Loki/CloudWatch | 30 days | Request ID, endpoint, user, status, duration |
| Compliance audit | PostgreSQL (`compliance_logs`) | 7 years | Check type, hash, user, IP, timestamp |
| On-chain audit | ComplianceRegistry.sol | Permanent | Check hash, user address, timestamp |
| Error tracking | Sentry | 90 days | Stack traces, request context, user session |
| Security events | Prometheus + Alerts | 30 days | Rate limit hits, auth failures, suspicious patterns |
| Infrastructure audit | CloudTrail / GCP Audit Logs | 1 year | K8s API calls, IAM changes, network changes |

#### Monitoring Tools

| Tool | Purpose | Configuration |
|------|---------|---------------|
| **Sentry** | Error tracking + performance monitoring | `sentry_sdk.init()` in `main.py:28-34` |
| **Prometheus** | Application metrics | `/metrics` endpoint, custom counters |
| **OpenTelemetry** | Distributed tracing | `setup_opentelemetry()` in `main.py:72-74` and `core/otel.py` |
| **Cilium Tetragon** | eBPF runtime security | `infra/k8s/tetragon-policies.yaml` |

#### Critical Alerts

| Alert Condition | Severity | Action |
|-----------------|----------|--------|
| Rate limit exceeded 100x in 5 min | SEV-3 | Investigate IP/user; possible DDoS |
| Failed auth attempts > 50/min | SEV-3 | Block IP; investigate credential stuffing |
| Age verification failure spike | SEV-2 | Check KYC provider; potential service issue |
| Smart contract call failure | SEV-2 | Check RPC endpoint; potential L2 issue |
| Sentry error rate > 5% | SEV-2 | Deploy fix; rollback if needed |
| On-chain vs off-chain log mismatch | SEV-1 | Audit trail integrity compromised; immediate investigation |

---

## A10: Server-Side Request Forgery (SSRF)

**Risk**: Attacker tricks the server into making requests to internal resources.

### Mitigations

#### Network Controls

| Control | Implementation | Location |
|---------|---------------|----------|
| Kubernetes Network Policies | Deny all egress except to known services | `infra/k8s/network-policies.yaml` |
| Service mesh (future) | Cilium L7 policies for HTTP-level filtering | CiliumNetworkPolicy CRDs |
| No direct user URLs | Content served from CDN, not user-supplied URLs | Application logic |

#### Application-Level Controls

| Control | Implementation |
|---------|---------------|
| URL validation | Content URLs validated against allowlist of known domains |
| No user-controlled redirects | All redirects are server-side and hardcoded |
| Web3 RPC endpoint | `ETHEREUM_RPC_URL` from env; not user-configurable |
| KYC webhook URL | `KYC_PROVIDER_URL` from env; not user-configurable |

#### Stripe Webhook SSRF Prevention

- Stripe webhook endpoint does not make external requests based on webhook data
- All Stripe API calls use the official `stripe` Python library (validated URLs)
- Webhook payload is validated before any processing

#### KYC Webhook SSRF Prevention

- Incoming webhook only updates local database state
- Does not fetch any URLs based on webhook payload
- Rate limited to prevent abuse (5 req/60s per IP)

---

## OWASP ZAP Scan Configuration

### Scan Profile

The platform runs OWASP ZAP scans as part of the CI pipeline (`security-scan.yml`).

#### API Scan (CI)

```bash
# Command from tests/security/run-owasp-scan.sh
docker run --network host \
  -v $(pwd):/zap/wrk/:rw \
  -t ghcr.io/zaproxy/zaproxy:stable \
  zap-api-scan.py \
  -t http://localhost:8000/openapi.json \
  -f openapi \
  -r zap-report.html \
  -z "-config api.key=change-me" \
  -x zap-report.xml
```

#### Scan Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Target | OpenAPI spec (http://localhost:8000/openapi.json) | Full API coverage |
| Format | openapi | Native OpenAPI parsing |
| Alert threshold | Default | Catches all findings |
| Active scan | Enabled | Deep vulnerability testing |
| Ajax spider | Enabled for authenticated scans | Client-side rendering coverage |

#### Authentication for ZAP

For authenticated scans, a bearer token is passed:
```bash
# From tests/security/zap-authenticated-scan.sh
docker run ...
  -z "-config api.key=change-me" \
  -z "-config authentication.method=json" \
  -z "-config authentication.loginurl=http://localhost:8000/api/auth/login/wallet"
```

#### Exclusions

| Alert | Reason |
|-------|--------|
| X-Frame-Options | SPA is not designed to be iframed but accepts risks |
| Content-Type sniffing | API responses are JSON with correct Content-Type |

#### Results Handling

- Results uploaded as CI artifacts (HTML + XML reports)
- Scans run with `continue-on-error: true` (non-blocking)
- Summary generated in `security-scan.yml:186-217`
- Critical findings in OWASP ZAP or Trivy block CI (`security-scan.yml:219-223`)

### Local ZAP Testing

```bash
# Start ZAP in daemon mode
docker compose --profile security up -d zap

# Run scan
make test-security

# View report
open tests/security/zap-report.html
```

### Test Profiles

The `tests/security/` directory contains three scan scripts:

| Script | Purpose |
|--------|---------|
| `run-owasp-scan.sh` | Full API scan against OpenAPI spec |
| `zap-api-scan.sh` | Lightweight scan for quick checks |
| `zap-authenticated-scan.sh` | Authenticated scan (with bearer token) |

### Remediation SLA

| Severity | Remediation Time | Example |
|----------|-----------------|---------|
| Critical | < 24 hours | SSRF to internal metadata endpoint |
| High | < 72 hours | SQL injection in search parameter |
| Medium | < 2 weeks | Missing security headers |
| Low | < 1 month | Information disclosure in error messages |
