# System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LAYER 4: INFRASTRUCTURE                          │
│  Kubernetes (EKS) │ Helm Charts │ Docker │ GitHub Container Registry        │
│  Prometheus │ Grafana │ Sentry │ OpenTelemetry │ Cilium Tetragon (eBPF)     │
│  Network Policies │ Secrets Manager │ Vault │ Cert-Manager │ Ingress-Nginx  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                    ├──────────────┬────────────────┐
                                    │              │                │
                      ┌─────────────▼──┐  ┌────────▼──────┐  ┌─────▼──────────┐
                      │  LAYER 3: WEB  │  │LAYER 3: MOBILE│  │LAYER 3: ADMIN  │
                      │  Next.js 14    │  │React Native   │  │Next.js (admin) │
                      │  wagmi/viem    │  │Expo           │  │wagmi/viem      │
                      │  Web3Modal     │  │Web3Wallet     │  │Web3Modal       │
                      └───────┬────────┘  └───────┬────────┘  └───────┬────────┘
                              │ HTTP/WS            │ HTTP/WS          │ HTTP/WS
                              │ (JWT Bearer)       │ (JWT Bearer)     │ (JWT Bearer)
                              └──────────┬─────────┴──────────────────┘
                                         │
                          ┌──────────────▼──────────────────────────────┐
                          │            LAYER 2: BACKEND API            │
                          │         FastAPI (Python 3.12)              │
                          │                                            │
                          │  ┌─────────┐ ┌──────────┐ ┌────────────┐  │
                          │  │ Auth    │ │Membership│ │ Content    │  │
                          │  │ Router  │ │ Router   │ │ Router     │  │
                          │  ├─────────┤ ├──────────┤ ├────────────┤  │
                          │  │Payments │ │Compliance│ │ Admin      │  │
                          │  │ Router  │ │ Router   │ │ Router     │  │
                          │  └─────────┘ └──────────┘ └────────────┘  │
                          │         │            │          │          │
                          │  ┌──────▼────────────▼──────────▼──────┐  │
                          │  │         Services Layer              │  │
                          │  │  age_verification.py                │  │
                          │  │  compliance_checker.py              │  │
                          │  │  noir_prover.py                     │  │
                          │  └────────────────────────────────────┘  │
                          └──────────────┬───────────────────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
    ┌─────────▼──────────┐   ┌──────────▼──────────┐   ┌───────────▼────────┐
    │    PostgreSQL 16    │   │      Redis 7         │   │  L2 Smart          │
    │                    │   │                      │   │  Contracts         │
    │  - users           │   │  - Session cache     │   │                    │
    │  - compliance_logs │   │  - JWT blacklist     │   │  - MembershipNFT   │
    │  - subscriptions   │   │  - Rate limiter      │   │  - AgeVerification │
    │  - payments        │   │  - Response cache    │   │  - TokenGatedAccess│
    │  - content         │   │  - Denylist          │   │  - ComplianceReg   │
    │  - membership_tiers│   │                      │   │  - SubscriptionMgr │
    └────────────────────┘   └──────────────────────┘   └───────────────────┘
```

## Four-Layer Architecture

### Layer 1: Blockchain (Smart Contracts on L2)

The foundational layer consists of five Solidity smart contracts deployed on an Ethereum L2 (such as Base, Arbitrum, or Optimism) for low gas costs:

| Contract | Purpose |
|----------|---------|
| **MembershipNFT.sol** | Soulbound ERC-721 with three tiers (BASIC, PREMIUM, VIP). Overrides `_update()` to prevent transfers. Admin can revoke tokens. |
| **AgeVerificationOracle.sol** | On-chain registry of ZK proof hashes. Stores `proofHash` and `expiry` per wallet address. Tracks whether a user has completed age verification. |
| **TokenGatedAccess.sol** | Access control contract. Checks that a user holds a valid MembershipNFT AND has an active age verification before granting access to content tiers. |
| **ComplianceRegistry.sol** | Immutable audit trail on-chain. Every compliance check (age verification, membership change, access attempt) is recorded as an event and stored in an append-only array with hash integrity. |
| **SubscriptionManager.sol** | On-chain subscription plans (Monthly/Quarterly/Yearly) with auto-renewal support. Handles ETH-based payments for subscriptions. |

Key characteristics:
- Solidity 0.8.24 with OpenZeppelin contracts
- Hardhat for compilation, testing, and deployment
- Gas optimization via optimizer (runs: 200) and viaIR
- Sepolia testnet and Ethereum mainnet deployment targets
- Slither and Mythril static analysis in CI

### Layer 2: Backend API (FastAPI)

The orchestration layer that connects smart contracts to clients. Built with Python 3.12 and FastAPI.

**API Routers:**
- **Auth Router** (`/api/auth`): Wallet-based login (EIP-191 signature verification), OAuth (Google/Discord), JWT token management, user registration
- **Membership Router** (`/api/membership`): Tier listing, NFT minting, upgrades, subscription management
- **Content Router** (`/api/content`): Content listing, category browsing, token-gated access checks
- **Compliance Router** (`/api/compliance`): Age verification (ZK proof submission), audit log queries, KYC webhook, compliance reports
- **Admin Router** (`/api/admin`): User management, membership revocation, full audit log, platform metrics, compliance summary
- **Payments Router** (`/api/payments`): Stripe PaymentIntent creation, Stripe webhook handling, withdrawal (admin), payment history

**Core Services:**
- `age_verification.py`: Calculates age from DOB, generates proof hashes, verifies against on-chain oracle
- `compliance_checker.py`: Runs configurable compliance rules (age verified, subscription active, no violations) and logs results
- `noir_prover.py`: Async wrapper around Nargo CLI for compiling circuits, generating/verifying proofs, extracting verification keys

**Infrastructure Components:**
- `config.py`: Pydantic Settings loading from `.env`
- `database.py`: Async SQLAlchemy engine with PostgreSQL (connection pooling, session management)
- `redis.py`: Async Redis client with caching decorator, token blacklist, rate limiter, session store
- `otel.py`: OpenTelemetry setup with OTLP HTTP exporter and FastAPI auto-instrumentation
- `security.py`: JWT creation/verification, wallet signature verification (eth_account), password hashing (bcrypt), rate limiting

### Layer 3: Web and Mobile Clients

**Web Frontend (Next.js 14):**
- App Router with route groups: `/content`, `/membership`, `/verify`, `/admin`
- Wallet connection via Web3Modal (wagmi + viem)
- Tailwind CSS for styling, lucide-react for icons
- React Query for server state management
- React Hook Form + Zod for form validation
- Pages: Content listing/access, membership tier selection/mint, age verification flow, admin dashboard

**Mobile App (React Native / Expo):**
- Expo managed workflow with expo-router
- Web3Wallet integration for wallet connection
- Screens mirror web functionality: content access, membership, verification
- Biometric authentication via expo-local-authentication
- Camera integration for document upload (expo-camera)
- Appium + WebDriverIO for E2E testing (both Android and iOS)

### Layer 4: Infrastructure

**Container Orchestration:**
- Kubernetes via Helm charts (`infra/helm/nft-platform/`)
- Docker Compose for local development
- GitHub Container Registry for image storage

**Monitoring and Observability:**
- OpenTelemetry for distributed tracing (OTLP HTTP exporter)
- Sentry for error tracking (FastAPI integration)
- Prometheus metrics endpoint
- Cilium Tetragon for eBPF-based runtime security monitoring

**Security Tooling:**
- OWASP ZAP for DAST (API scan against OpenAPI spec)
- Bandit for Python SAST
- Trivy for container vulnerability scanning
- Gitleaks for secret scanning
- Snyk and Safety for dependency vulnerability scanning
- Slither and Mythril for smart contract static analysis
- Network policies for pod-level segmentation

## Data Flow

### Primary User Flow

```
1. Connect Wallet
   User → Frontend/Mobile → MetaMask/WalletConnect
   → Wallet address returned

2. Authenticate
   Frontend → POST /api/auth/login/wallet
   → Backend verifies EIP-191 signature
   → JWT issued (60-min expiry)

3. Verify Age (ZK Proof)
   Frontend → User enters birth date
   → Noir circuit generates proof locally
   → POST /api/compliance/verify-age
   → Backend verifies age >= threshold
   → Proof hash recorded on AgeVerificationOracle.sol
   → ComplianceLog entry created (off-chain)
   → ComplianceRegistry.recordCheck() called (on-chain)

4. Select Membership Tier
   Frontend → GET /api/membership/tiers
   → User selects BASIC/PREMIUM/VIP

5. Make Payment
   Option A (Stripe): POST /api/payments/create-payment-intent
   → Stripe PaymentIntent → User pays with card
   → Stripe webhook notifies backend → Membership minted

   Option B (Crypto): User sends ETH directly to MembershipNFT contract
   → mint() function called with tier parameter

6. Mint Soulbound NFT
   Backend → MembershipNFT.mint(tier) called via web3.py
   → Token minted, permanently bound to wallet
   → User record updated with membership tier + token ID

7. Access Content
   Frontend → GET /api/content or POST /api/content/access/{id}
   → Backend checks TokenGatedAccess.canAccess()
   → Verifies NFT ownership + age verification
   → Access granted/denied
   → ComplianceLog entry created
```

### Compliance Audit Trail Flow

```
Every Compliance Event:
  1. Event occurs (age verify, access attempt, membership change)
  2. Off-chain: Backend creates ComplianceLog entry in PostgreSQL
  3. On-chain: Backend calls ComplianceRegistry.recordCheck()
     - Records: user address, checkHash (SHA-256), checkType, timestamp
  4. Check hash is stored immutably on blockchain
  5. Daily cron (02:00 UTC):
     - GitHub Actions workflow runs compliance-audit.yml
     - Generates comprehensive report from off-chain logs
     - Verifies integrity against on-chain hashes
     - Archives report (90-day retention)
     - Sends notification to compliance team
```

## Off-Chain Media Storage Approach

The platform uses a hybrid storage model for content media:

| Storage Type | Use Case | Technology |
|---|---|---|
| **IPFS** | NFT metadata and tier URIs | Content-addressed, immutable URIs stored in `_setTokenURI()` |
| **Arweave** | Permanent compliance records | Immutable audit artifacts for regulatory retention |
| **S3-compatible** | Primary media storage (videos, images) | Origin storage with CDN integration |
| **Signed URLs** | Temporary access to media | Pre-signed S3 URLs with time-limited access |

Content URLs stored as `url` and `thumbnail_url` fields in the `content` database table point to the appropriate storage backend. The `required_tier` and `age_restricted` fields control access at the API level, with on-chain verification via `TokenGatedAccess.sol`.

## Integration Points

| Service | Integration Method | Purpose |
|---|---|---|
| **Noir** | CLI subprocess (`nargo`) via `noir_prover.py` | Circuit compilation, proof generation, verification |
| **Redis** | `redis-py` async client | Caching, rate limiting, session storage, JWT blacklist |
| **OpenTelemetry** | OTLP HTTP exporter + FastAPI auto-instrumentation | Distributed tracing, performance monitoring |
| **Cilium Tetragon** | eBPF-based observability (K8s sidecar) | Runtime security monitoring, network flow tracking |
| **Stripe** | REST API + webhooks | Payment processing, subscription management |
| **KYC Provider** | Webhook endpoint (`/api/compliance/webhook/kyc`) | Third-party identity verification integration |
| **Sentry** | SDK (`sentry-sdk[fastapi]`) | Error tracking, performance monitoring |
| **Prometheus** | Metrics endpoint (`/metrics`) | Custom application metrics, resource monitoring |
| **Ethereum L2** | `web3.py` HTTP provider | Contract interactions, event listening |
| **GitHub Actions** | CI/CD workflows | Testing, security scanning, deployment, compliance audits |
