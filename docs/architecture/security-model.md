# Security Model

## Threat Model (STRIDE per Component)

### Smart Contracts

| Threat | Component | Risk | Mitigation |
|--------|-----------|------|------------|
| **S**poofing | MembershipNFT | Attacker mints tokens to arbitrary wallets | `_safeMint()` with sender validation; Ownable pattern for admin functions |
| **T**ampering | ComplianceRegistry | Audit log entries modified or deleted | Immutable append-only array; check hash integrity verification |
| **R**epudiation | TokenGatedAccess | User denies accessing content | Every access check emits event on-chain; logged in ComplianceRegistry |
| **I**nformation Disclosure | AgeVerificationOracle | Proof hash reveals age data | Only hash stored; ZK proof keeps birth date private |
| **D**enial of Service | All contracts | Reentrancy attacks draining funds | ReentrancyGuard on payable functions; Checks-Effects-Interactions pattern |
| **E**levation of Privilege | SubscriptionManager | User upgrades subscription without payment | Tier upgrade price check; require higher tier validation |

### Backend API

| Threat | Component | Risk | Mitigation |
|--------|-----------|------|------------|
| **S**poofing | Auth Router | Attacker impersonates user without wallet key | EIP-191 signature verification; wallet address recovery |
| **T**ampering | All endpoints | Request body modification in transit | TLS 1.3 enforcement; request signing for webhooks |
| **R**epudiation | Compliance Router | User disputes age verification | Immutable proof hash stored on-chain; full audit trail |
| **I**nformation Disclosure | All endpoints | Leaked PII (birth date, email) | Minimal data collection; birth date processed client-side; encrypted at rest |
| **D**enial of Service | All endpoints | Rate limit bypass | Redis-based sliding window rate limiter; per-endpoint limits |
| **E**levation of Privilege | Admin Router | Non-admin accesses admin functions | `get_admin_user` dependency check; JWT with `is_admin` claim |

### Frontend/Mobile

| Threat | Component | Risk | Mitigation |
|--------|-----------|------|------------|
| **S**poofing | Web3Modal | Malicious wallet connection | WalletConnect protocol validation; domain-bound sessions |
| **T**ampering | Age verification | Client-side age manipulation | ZK proof generated client-side but verified server-side and on-chain |
| **I**nformation Disclosure | Content pages | Content URL leaked | Signed short-lived URLs; on-chain access check before serving |
| **E**levation of Privilege | UI | User accesses admin panel without auth | Route guards; all API endpoints re-verify auth server-side |

## Trust Boundaries

```
┌──────────────────────────────────────────────────────────────────────┐
│                    TRUST BOUNDARY 1: Internet                        │
│  ┌──────────────┐    TLS 1.3     ┌────────────────────────────────┐ │
│  │ User Browser │ ◄──────────────► │  Load Balancer / Ingress     │ │
│  │ / Mobile App │    (origin)     │  (TLS termination)           │ │
│  └──────────────┘                 └──────────────┬─────────────────┘ │
└──────────────────────────────────────────────────┼───────────────────┘
                                                    │
                            TRUST BOUNDARY 2: Internal Network
                                                    │
                     ┌──────────────────────────────▼───────────────────┐
                     │              Backend API (FastAPI)               │
                     │  - JWT validation                                 │
                     │  - Wallet signature verification                  │
                     │  - Rate limiting                                  │
                     │  - Input validation                               │
                     └──────┬──────────────────────────┬────────────────┘
                            │                          │
               ┌────────────▼──────────┐    ┌──────────▼────────────┐
               │   PostgreSQL 16       │    │   Redis 7              │
               │   (encrypted at rest) │    │   (TLS in transit)     │
               │   Network policy:     │    │   Network policy:      │
               │   backend-only access │    │   backend-only access  │
               └───────────────────────┘    └───────────────────────┘

TRUST BOUNDARY 3: Blockchain (Public)
                     │
        ┌────────────▼──────────────────────────────┐
        │         L2 Smart Contracts                 │
        │  - Public by design                        │
        │  - Admin functions restricted to owner     │
        │  - Trusted forwarder for API relayer       │
        └───────────────────────────────────────────┘
```

### Trust Boundary 1: Client ↔ API
- **Mutual TLS** recommended for production (mTLS for admin endpoints)
- All requests authenticated via JWT Bearer token
- Wallet signatures verified server-side using `eth_account.messages.encode_defunct`
- CORS restricted to known origins in production
- Rate limiting applied per IP/token at the ingress and application layers
- CSRF protection via SameSite cookies + token-based auth

### Trust Boundary 2: API ↔ Contract
- Backend uses `web3.py` with an admin wallet private key (environment variable)
- The admin wallet is authorized as `trustedForwarder` on ComplianceRegistry
- Contract calls are signed transactions submitted to L2 RPC
- RPC endpoint must be internal/private for production deployments
- Admin wallet key stored in Kubernetes Secrets or Vault, never in code

### Trust Boundary 3: API ↔ Database
- PostgreSQL connection string includes password (via environment variable)
- Backend uses connection pooling (pool_size=20, max_overflow=10)
- Network policies restrict database access to backend pods only
- Encrypted at rest (PostgreSQL TDE or disk encryption)
- TLS for database connections in production

## Authentication

### Wallet-Based Authentication (Primary)

1. **Challenge Generation**: Frontend requests a message to sign (EIP-191 formatted)
2. **User Signs**: User signs the message with their wallet (MetaMask, WalletConnect)
3. **Verification**: Backend recovers the signer address using `Web3.eth.account.recover_message()`
4. **Token Issuance**: If recovered address matches the claimed wallet, a JWT is issued
5. **Session**: JWT contains `sub` (user ID), `wallet` (address), `is_admin` (boolean)
6. **Expiry**: Default 60 minutes; refresh endpoint available

```python
# Key verification logic (from app/core/security.py)
def verify_wallet_signature(wallet_address: str, message: str, signature: str) -> bool:
    w3 = Web3()
    message_encoded = encode_defunct(text=message)
    recovered = w3.eth.account.recover_message(message_encoded, signature=signature)
    return recovered.lower() == wallet_address.lower()
```

### OAuth Authentication (Secondary)

- Supports Google and Discord OAuth providers
- Used as fallback for users without Web3 wallets
- Creates a synthetic wallet address (`oauth_{provider}_{session_id}`)
- JWT issued with same structure as wallet auth

### JWT Token Management

- **Algorithm**: HS256 with configurable secret (`JWT_SECRET`)
- **Claims**: `sub`, `wallet`, `is_admin`, `exp`, `jti` (token ID)
- **Blacklisting**: Tokens can be revoked via Redis blacklist (jti-based)
- **Refresh**: POST `/api/auth/refresh` accepts expired tokens to issue new ones
- **Logout**: Adds token jti to Redis blacklist for remaining duration

## Authorization

### Token-Gated Access Check Flow

```
1. User requests content: POST /api/content/access/{content_id}
2. Backend extracts JWT from Authorization header
3. JWT verified (signature, expiry, blacklist check)
4. Current user loaded from database
5. Content metadata checked (required_tier, age_restricted)
6. If age_restricted and user.age_verified == False → DENIED
7. If required_tier set and user.membership_tier doesn't match → DENIED
8. Optional: Smart contract verification
   - TokenGatedAccess.canAccess(wallet, contentId) called
   - Verifies NFT ownership on-chain
   - Verifies age verification on-chain
9. Access logged to ComplianceLog (off-chain) and ComplianceRegistry (on-chain)
10. GRANTED → Content URL + signed token returned
```

### Role-Based Access

| Role | Access Level | Routes |
|------|-------------|--------|
| **Unauthenticated** | None (except health check) | `GET /health` |
| **Authenticated User** | Own data only | Auth, Membership, Content, Compliance |
| **Admin** | All data, management actions | Admin routes, user revocation, withdrawals, full audit log |

### Smart Contract Authorization

- **Ownable**: Core admin functions protected by OpenZeppelin's `Ownable` pattern
- **onlyAuthorized**: ComplianceRegistry accepts calls from owner OR trusted forwarder
- **onlyVerifier**: AgeVerificationOracle accepts verification submissions from verifier OR owner
- **No arbitrary calls**: All contract interactions go through typed function interfaces
- **ReentrancyGuard**: Protected on all ETH-transferring functions (mint, subscribe, upgrade)

## ZK Proof Verification Flow

```
┌──────────┐   1. Enter DOB     ┌───────────┐   2. Generate Proof   ┌─────────┐
│  User    │ ──────────────────► │  Browser  │ ───────────────────► │  Noir   │
│          │                    │  / App    │                      │ Circuit │
└──────────┘                    └───────────┘                      └────┬────┘
                                                                        │
                                                                        ▼
                                                          ┌─────────────────────┐
                                                          │  3. Proof Submitted │
                                                          │  POST /api/compliance│
                                                          │  /verify-age        │
                                                          └──────────┬──────────┘
                                                                     │
                                                          ┌──────────▼──────────┐
                                                          │  4. Backend Verifies│
                                                          │   - Age >= 18       │
                                                          │   - Proof hash      │
                                                          │   - Not previously  │
                                                          │     submitted       │
                                                          └──────────┬──────────┘
                                                                     │
                                                          ┌──────────▼──────────┐
                                                          │  5. On-Chain Record │
                                                          │  AgeVerification    │
                                                          │  Oracle.submitVerif │
                                                          │  ication()          │
                                                          └──────────┬──────────┘
                                                                     │
                                                          ┌──────────▼──────────┐
                                                          │  6. Compliance Log  │
                                                          │  Off-chain +        │
                                                          │  On-chain audit     │
                                                          │  trail updated      │
                                                          └─────────────────────┘
```

**Privacy Guarantees:**
- Birth date is never sent to the server
- Only the proof hash (commitment) is stored on-chain
- The server only learns the verification result (pass/fail), not the actual age
- Pedersen commitment in Noir circuit ensures zero-knowledge property

## OWASP Top 10 Mitigation Mapping

See the full document at `docs/security/owasp.md` for detailed per-category mapping. High-level summary:

| OWASP Category | Mitigation |
|----------------|------------|
| A01: Broken Access Control | Token-gated access checks, role-based API auth, wallet sig verification |
| A02: Cryptographic Failures | ZK proofs for age, TLS 1.3, encrypted DB at rest, Pedersen commitments |
| A03: Injection | Parameterized queries (SQLAlchemy), Pydantic input validation |
| A04: Insecure Design | Compliance-first architecture, audit trails, rate limiting by design |
| A05: Security Misconfiguration | Helm best practices, non-root containers, network policies, RBAC |
| A06: Vulnerable Components | Safety, Snyk, Trivy scans in CI; Dependabot; regular updates |
| A07: Identification/Auth Failures | Wallet-based auth, JWT short expiry, refresh tokens, blacklisting |
| A08: Software/Data Integrity | Signed commits (GPG), container signing, supply chain provenance |
| A09: Security Logging/Monitoring | Sentry, Prometheus, OpenTelemetry, Cilium Tetragon eBPF |
| A10: SSRF | Network policies, URL validation, restricted egress |

## Security Controls per Layer

### Layer 1: Smart Contracts

| Control | Implementation |
|---------|---------------|
| Reentrancy protection | OpenZeppelin ReentrancyGuard on all payable functions |
| Access control | OpenZeppelin Ownable; custom onlyAuthorized and onlyVerifier modifiers |
| Input validation | require() statements for all parameters (non-zero addresses, valid hashes, future timestamps) |
| Integer overflow | Solidity 0.8.24 has built-in overflow checks |
| Front-running resistance | Commit-reveal pattern for verification submissions |
| Gas limits | Optimizer enabled; contract size monitoring in CI |
| Static analysis | Slither and Mythril run in smart-contracts.yml workflow |
| Coverage | Solidity coverage reports with hardhat-coverage |

### Layer 2: Backend API

| Control | Implementation |
|---------|---------------|
| Authentication | JWT Bearer tokens with HS256; wallet signature verification via eth_account |
| Authorization | `get_current_user` and `get_admin_user` FastAPI dependencies |
| Input validation | Pydantic v2 models with strict type validation |
| Rate limiting | Redis-based sliding window; per-endpoint configurable limits (20 req/60s for auth) |
| SQL injection | SQLAlchemy ORM with parameterized queries; never raw SQL |
| Secrets management | Environment variables via Pydantic Settings; never hardcoded |
| Error handling | Global exception handler; no stack traces in production responses |
| CORS | Configurable origins via middleware |
| HTTPS enforcement | TLS termination at ingress; HSTS headers |
| API security scanning | OWASP ZAP DAST against OpenAPI spec in CI |

### Layer 3: Frontend/Mobile

| Control | Implementation |
|---------|---------------|
| Wallet security | Web3Modal with WalletConnect; user controls private key |
| Input sanitization | Zod schemas for all forms |
| XSS prevention | React JSX auto-escaping; Content-Security-Policy headers |
| CSRF | SameSite cookies; token-based auth (not cookie-based sessions) |
| Secure storage | expo-secure-store for mobile tokens; httpOnly cookies for web |
| Biometric auth | expo-local-authentication for mobile app unlock |

### Layer 4: Infrastructure

| Control | Implementation |
|---------|---------------|
| Network segmentation | Kubernetes Network Policies; service mesh (Cilium) |
| Container security | Non-root containers; Trivy vulnerability scanning |
| Secret management | Kubernetes Secrets; Vault integration for production |
| Runtime security | Cilium Tetragon eBPF for process/kernel-level monitoring |
| Audit logging | CloudTrail / GCP Audit Logs for infrastructure-level events |
| Backup and DR | Automated PostgreSQL backups; cross-region replication |
| Image signing | Container image signing with cosign (future) |

## Incident Response Plan Summary

### Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| **SEV-1** | Critical: Data breach, fund loss, platform unavailable | Immediate (<30 min) | Private key leak, smart contract exploit |
| **SEV-2** | High: Service degradation, partial data loss | 1 hour | Age verification bypass, payment processing failure |
| **SEV-3** | Medium: Non-critical functionality affected | 4 hours | UI bugs, performance degradation |
| **SEV-4** | Low: Cosmetic issues, documentation | 24 hours | Typo in copy, minor styling |

### Response Process

1. **Detection**: Automated alerts from Sentry, Prometheus, Cilium Tetragon; user reports
2. **Triage**: On-call engineer assesses severity and impact
3. **Containment**:
   - SEV-1: Revoke admin wallet key, pause smart contracts, roll back deployment
   - SEV-2: Rate limit endpoints, disable affected features, scale up resources
   - SEV-3/4: Deploy fix through normal CI/CD pipeline
4. **Eradication**: Deploy fix, run security tests, verify in staging
5. **Recovery**: Roll out fix to production, verify metrics return to baseline
6. **Post-Mortem**: Root cause analysis, timeline, action items

### Key Contacts

- Security Team: `security@nft-fanclub.example.com`
- DevOps On-Call: PagerDuty rotation
- Compliance Officer: `compliance@nft-fanclub.example.com`

## Post-Quantum Cryptography Readiness Notes

The platform's cryptographic architecture is designed with quantum-resistant migration paths:

### Current Cryptographic Primitives

| Primitive | Algorithm | Post-Quantum Risk |
|-----------|-----------|-------------------|
| JWT signing | HMAC-SHA256 (HS256) | Broken by Grover's algorithm (brute force halved) |
| Wallet signatures | ECDSA (secp256k1) | **High** — ECDSA broken by Shor's algorithm |
| Ethereum addresses | keccak256(public_key) | **High** — public key recovery from signature |
| TLS | ECDHE + AES-GCM | **Medium** — forward secrecy limits bulk decryption |
| ZK proofs | Pedersen commitments (Noir) | **Medium** — depends on underlying curve |
| Database encryption | AES-256 | **Low** — symmetric crypto affected by Grover's (key size doubled) |
| Password hashing | bcrypt | **Low** — work factor can increase |

### Migration Path

1. **Short-term (1-2 years)**: Monitor NIST PQC standardization; use larger key sizes where possible
2. **Medium-term (2-5 years)**: 
   - Replace ECDSA with FALCON or CRYSTALS-Dilithium for wallet signatures (Ethereum account abstraction / ERC-4337 allows signature abstraction)
   - Upgrade Noir circuits to use quantum-resistant hash functions (SHA-3 family)
   - Adopt hybrid TLS (ECDHE + ML-KEM / CRYSTALS-Kyber)
3. **Long-term (5+ years)**:
   - Full migration to PQC algorithms once Ethereum/EVM supports them natively
   - Audit trail resistant to quantum attacks (use hash-based signatures for check hashes)

### Current Hardening

- **No raw ECDSA public keys stored on-chain**: Only addresses (keccak256 hashes) stored; public keys only recoverable from signed transactions
- **Hash-based integrity**: ComplianceRegistry uses SHA-256 check hashes, which are more resistant than ECDSA
- **Symmetric encryption**: AES-256 used for data at rest, providing 128-bit post-quantum security (Grover's algorithm)
