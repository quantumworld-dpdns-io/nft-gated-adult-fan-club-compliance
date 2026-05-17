# AGENTS.md — opencode Agent Context

## Project Overview

NFT-gated adult fan club compliance platform — a token-gated content membership system with zero-knowledge (ZK) age verification, soulbound membership NFTs, and a compliance-first audit trail. Users connect a wallet, verify they are 18+ (without revealing their birth date), mint a membership NFT, and gain access to age-restricted content via web or mobile apps.

## Tech Stack

| Component       | Stack                                                                 |
|-----------------|-----------------------------------------------------------------------|
| Smart Contracts | Solidity 0.8.24, Hardhat, OpenZeppelin, Slither, Mythril              |
| Backend API     | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2    |
| Frontend Web    | Next.js 14 (App Router), React 18, Tailwind CSS, wagmi/viem, Web3Modal|
| Mobile          | React Native (Expo), Appium/WebDriverIO E2E                           |
| ZK Proofs       | Noir (>=0.34.0) — Barretenberg backend                                |
| Database        | PostgreSQL 16 (primary), Redis 7 (cache/sessions/rate-limit)          |
| Infrastructure  | Docker, Kubernetes (Helm charts), GitHub Container Registry            |
| Observability   | OpenTelemetry, Sentry, Prometheus                                     |
| Security        | OWASP ZAP, Bandit, Safety, Trivy, Gitleaks, Snyk                      |
| CI/CD           | GitHub Actions (7 workflows)                                          |
| Payments        | Stripe (payment intents, webhooks)                                   |

## Directory Structure

```
./
├── AGENTS.md                  # This file — opencode agent context
├── Makefile                   # Dev/test/lint/deploy commands
├── docker-compose.yml         # Local dev services (Postgres, Redis, API, Frontend)
├── docker-compose.test.yml    # Test services (isolated Postgres, Redis)
├── Dockerfile.backend         # Backend container image
├── Dockerfile.frontend        # Frontend (Nginx-served Next.js) image
├── requirements.txt           # Python dependencies
├── .env.example               # Environment variable template
│
├── backend/                   # FastAPI Python backend
│   └── app/
│       ├── main.py            # FastAPI app entry, lifespan, exception handlers
│       ├── api/               # Route handlers (auth, membership, content, compliance, admin, payments)
│       ├── core/              # Config, DB engine, Redis client, OpenTelemetry, Security (JWT, wallet verify)
│       ├── models/            # SQLAlchemy ORM models (User, Subscription, Payment, Content, ComplianceLog, etc.)
│       ├── services/          # Business logic (age_verification, compliance_checker)
│       └── zk-proofs/         # Noir proof generation/verification integration
│
├── contracts/                 # Solidity smart contracts
│   ├── contracts/
│   │   ├── MembershipNFT.sol           # Soulbound NFT with BASIC/PREMIUM/VIP tiers
│   │   ├── AgeVerificationOracle.sol   # On-chain age verification registry
│   │   ├── TokenGatedAccess.sol        # Access control logic (NFT + age verification)
│   │   ├── ComplianceRegistry.sol      # Immutable compliance audit trail on-chain
│   │   └── SubscriptionManager.sol     # On-chain subscription plans and renewals
│   ├── test/                  # Hardhat tests
│   ├── scripts/               # Deploy scripts
│   └── hardhat.config.ts      # Hardhat config (Sepolia, Mainnet, gas reporter)
│
├── frontend/                  # Next.js web application
│   ├── app/                   # App router: page.tsx, layout.tsx, providers.tsx
│   │   ├── content/           # Content listing/access pages
│   │   ├── membership/        # Membership tier selection/mint
│   │   ├── verify/            # Age verification flow
│   │   └── admin/             # Admin dashboard
│   ├── components/            # Reusable React components
│   └── lib/                   # Web3 hooks, API client, utils
│
├── mobile/                    # React Native (Expo) mobile app
│   ├── app/                   # App entry, screens, components, services
│   └── tests/                 # Appium/WebDriverIO mobile E2E tests
│
├── zk-circuits/               # Noir zero-knowledge circuits
│   ├── age-verification/      # Age >= threshold proof (private birth_date)
│   │   └── src/main.nr
│   ├── membership-proof/      # Membership tier possession proof
│   │   └── src/main.nr
│   ├── Prover.toml.example
│   └── Verifier.toml.example
│
├── tests/
│   ├── e2e/                   # Playwright E2E tests (web)
│   ├── performance/           # k6 load/stress tests
│   └── security/              # OWASP ZAP scan scripts and configs
│
├── scripts/
│   ├── ci/                    # CI helper scripts
│   └── compliance/            # Compliance report generation scripts
│
├── infra/
│   ├── docker/                # Docker Compose overrides
│   ├── helm/                  # Helm chart for Kubernetes deployment
│   │   └── nft-platform/      # K8s manifests (deployments, services, ingress, network policies)
│   └── k8s/                   # Raw Kubernetes manifests (secrets, configmaps)
│
├── docs/
│   ├── api/                   # REST API and webhook documentation
│   ├── architecture/          # System architecture and security model
│   ├── compliance/            # Age verification and audit trail docs
│   ├── security/              # OWASP Top 10, ZK proof design docs
│   └── CONTRIBUTING.md        # Contribution guidelines
│
└── .github/workflows/         # 7 CI/CD pipelines (see CI/CD section)
```

## Architecture Summary

```
User Wallet (Web3Modal)  ──signs──▶  Backend API (FastAPI)  ──reads/writes──▶  PostgreSQL
       │                                    │                                        │
       │                                    ├── calls Smart Contracts (web3.py)       ├── Redis (cache/sessions)
       │                                    ├── verifies ZK proofs (Noir)             │
       │                                    ├── emits traces (OpenTelemetry)           │
       │                                    ├── sends errors (Sentry)                  │
       │                                    └── processes payments (Stripe)            │
       │                                                                               │
       └── Smart Contracts (L2) ◀────────────── ComplianceRegistry logs ◀──────────────┘
                │
                ├── MembershipNFT (soulbound ERC-721)
                ├── AgeVerificationOracle (ZK proof registry)
                ├── TokenGatedAccess (access control)
                └── SubscriptionManager (recurring payments)
```

**Data Flow:**
1. User connects wallet (MetaMask/WalletConnect) via frontend/mobile
2. User generates ZK proof locally (age >= 18) using Noir, submits to API
3. API verifies proof, records hash on AgeVerificationOracle contract
4. User selects membership tier, pays via Stripe or ETH, mints soulbound NFT
5. User accesses content — API calls TokenGatedAccess.canAccess() to verify NFT + age
6. Every check is logged to ComplianceRegistry (on-chain) and ComplianceLog (off-chain DB)
7. Daily automated compliance audits generate reports

## Key Design Decisions

1. **ZK Age Verification (Noir)**: Users prove age >= 18 without revealing birth date. Circuit hashes private inputs with Pedersen commitment, asserts age >= threshold. Proof hash stored on-chain.
2. **Soulbound NFTs**: `MembershipNFT` overrides `_update()` to prevent transfers — once minted, tokens are permanently bound to the owner's wallet. Revocable only by admin.
3. **Compliance-First Audit Trail**: Every age check, membership change, and access attempt is logged both in `ComplianceRegistry.sol` (immutable on-chain) and `compliance_logs` DB table (queryable). Daily automated audits via GitHub Actions.
4. **L2 Deployment**: Contracts deployable to L2 (e.g., Base, Arbitrum) for low gas costs. Hardhat config includes Sepolia and Mainnet.
5. **Layer Separation**: Smart contracts handle logic + audit; API handles orchestration + off-chain data; frontend handles UX + wallet connection. No business logic in frontend.
6. **Stripe + Crypto Payments**: Dual payment support — fiat via Stripe Payment Intents, crypto via direct contract calls.
7. **Redis-Centric Infrastructure**: Redis used for rate limiting (sliding window), JWT blacklisting, response caching, session storage, and rate limiter denylist.

## Test Framework

| Test Type              | Tool                | Location                  |
|------------------------|---------------------|---------------------------|
| Backend unit/integration| pytest + pytest-asyncio | backend/tests/         |
| Frontend unit          | Jest + Testing Library | frontend/              |
| Smart contract         | Hardhat + Chai       | contracts/test/          |
| Web E2E                | Playwright           | tests/e2e/               |
| Mobile E2E             | Appium + WebDriverIO | mobile/tests/            |
| Performance            | k6                   | tests/performance/        |
| Security (SAST)        | Bandit (Python)      | CI workflow              |
| Security (DAST)        | OWASP ZAP            | tests/security/           |
| Dependency scan        | Safety, Snyk, Trivy  | CI workflow              |
| Secret scan            | Gitleaks             | CI workflow              |
| Contract static analysis| Slither, Mythril    | CI workflow              |

## CI/CD Pipelines (7 Workflows in .github/workflows/)

| Workflow          | Trigger                   | Key Jobs                                              |
|-------------------|---------------------------|-------------------------------------------------------|
| `ci.yml`          | Push/PR to main, dev      | Lint, backend tests, contract tests, Docker build+push|
| `smart-contracts.yml`| Push/PR touching contracts/ | Compile, test, Slither, Mythril, coverage          |
| `zk-circuits.yml` | Push/PR touching zk-circuits/ | Compile, test, size check, Solidity verifier gen  |
| `security-scan.yml`| Push main, weekly schedule | Bandit, Safety, Snyk, OWASP ZAP, Trivy, Gitleaks    |
| `compliance-audit.yml`| Daily cron (02:00 UTC) | Generate compliance report, check expired verifications|
| `appium-tests.yml` | Label `e2e-mobile` or push main touching mobile/ | Android + iOS Appium E2E      |
| `deploy.yml`      | Push to main              | Deploy staging, E2E tests, deploy production, k6 smoke|

## Build and Run Instructions

```bash
# Prerequisites
make dev         # Start all services (Docker Compose)
make backend     # Start backend only (uvicorn --reload)
make frontend    # Start frontend only (next dev)
make contracts   # Compile + test contracts
make db-migrate  # Run Alembic migrations
make zk-compile  # Compile Noir circuits
```

## Environment Variables

Key variables (see `.env.example` for full list):

| Variable                          | Description                        |
|-----------------------------------|------------------------------------|
| `DATABASE_URL`                    | PostgreSQL async connection string |
| `REDIS_URL`                       | Redis connection string            |
| `JWT_SECRET`                      | JWT signing secret                 |
| `ETHEREUM_RPC_URL`                | L2 RPC endpoint                    |
| `WALLET_PRIVATE_KEY`              | Admin wallet private key           |
| `STRIPE_SECRET_KEY`               | Stripe API secret key              |
| `STRIPE_WEBHOOK_SECRET`           | Stripe webhook signing secret      |
| `SENTRY_DSN`                      | Sentry error tracking DSN          |
| `OTEL_EXPORTER_OTLP_ENDPOINT`     | OpenTelemetry collector endpoint   |
| `CONTRACT_MEMBERSHIP_NFT`         | Deployed MembershipNFT address     |
| `CONTRACT_AGE_VERIFICATION`       | Deployed AgeVerificationOracle addr|
| `CONTRACT_TOKEN_GATED_ACCESS`     | Deployed TokenGatedAccess address  |
| `CONTRACT_COMPLIANCE_REGISTRY`    | Deployed ComplianceRegistry address|
| `AGE_VERIFICATION_THRESHOLD`      | Minimum age (default 18)           |
| `KYC_PROVIDER_URL`                | Third-party KYC webhook endpoint   |

## Common Commands (from `make help`)

```
=== NFT-Gated Adult Fan Club Compliance ===

Development:
  make dev           Start all services in development mode
  make backend       Start backend API server
  make frontend      Start frontend dev server

Testing:
  make test          Run all tests (unit + integration)
  make test-backend  Run backend tests
  make test-frontend Run frontend tests
  make test-contracts Run smart contract tests
  make test-appium   Run Appium mobile E2E tests
  make test-security Run OWASP ZAP security scan
  make test-e2e      Run Playwright E2E tests
  make test-perf     Run performance load tests

Security:
  make security      Run all security scans
  make owasp-zap     Run OWASP ZAP scan
  make bandit        Run Python security linter
  make safety        Check dependency vulnerabilities

Quality:
  make lint          Run all linters
  make format        Format all code
  make typecheck     Run type checking

Contracts:
  make contracts     Compile and test smart contracts
  make deploy-local  Deploy contracts to local network

Infrastructure:
  make docker-up     Start all Docker services
  make docker-down   Stop all Docker services
  make docker-test   Run tests in Docker
  make ci            Run full CI pipeline locally

ZK Proofs:
  make zk-compile    Compile Noir ZK circuits
  make zk-test       Test ZK circuits

Database:
  make db-migrate    Run database migrations
  make db-reset      Reset and reinitialize database

Cleanup:
  make clean         Remove build artifacts and caches
```

## Notes for AI Agents

- All API routes are under `/api/` prefix with six routers: auth, membership, content, compliance, admin, payments
- Authentication uses Bearer JWT tokens; wallet signature verification uses `eth_account.messages.encode_defunct`
- Smart contracts are soulbound (no transfers), deployed on L2 for gas efficiency
- Compliance logging happens both on-chain (ComplianceRegistry) and off-chain (compliance_logs table)
- The project uses Noir >=0.34.0; circuit files are in `zk-circuits/age-verification/src/main.nr` and `zk-circuits/membership-proof/src/main.nr`
- All backend tests use pytest with async support; contract tests use Hardhat + Chai
- OWASP ZAP scans run against the OpenAPI spec of the backend
- The compliance audit workflow runs daily at 02:00 UTC via GitHub Actions cron
- Always run `make lint` before committing; ensure all CI checks pass
