# NFT-Gated Adult Fan Club Compliance Platform

> **Token-gated content membership with zero-knowledge age verification, soulbound NFTs, and compliance-first audit trail.**

[![CI](https://github.com/user/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/user/repo/actions/workflows/ci.yml)
[![Security Scan](https://github.com/user/repo/actions/workflows/security-scan.yml/badge.svg)](https://github.com/user/repo/actions/workflows/security-scan.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

- **NFT-Gated Access** — Soulbound ERC-721 membership tokens with BASIC, PREMIUM, and VIP tiers
- **ZK Age Verification** — Prove you're 18+ without revealing your birth date (Noir zero-knowledge circuits)
- **Compliance-First Design** — Dual on-chain + off-chain audit trail; daily automated compliance reports
- **Multi-Tier Memberships** — Flexible subscription plans with Stripe and crypto payment support
- **Cross-Platform** — Web app (Next.js 14) and mobile app (React Native / Expo)
- **Wallet-Centric Auth** — Connect MetaMask/WalletConnect; wallet signature-based authentication
- **Payments** — Fiat via Stripe Payment Intents + crypto via smart contract
- **Privacy by Default** — Minimal data collection; ZK proofs keep personal information private
- **L2 Optimized** — Smart contracts deployable to Base, Arbitrum, Optimism for low gas costs
- **Full Observability** — OpenTelemetry tracing, Sentry error tracking, Prometheus metrics

---

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd nft-gated-adult-fan-club-compliance
cp .env.example .env

# 2. Start all services
make dev

# 3. Open in browser
open http://localhost:3000   # Frontend
open http://localhost:8000/docs  # API docs
```

---

## Architecture

```
User Wallet (Web3Modal)  ──signs──▶  Backend API (FastAPI)  ──reads/writes──▶  PostgreSQL
       │                                    │                                        │
       │                                    ├── calls Smart Contracts (web3.py)       ├── Redis
       │                                    ├── verifies ZK proofs (Noir)             │
       │                                    ├── emits traces (OpenTelemetry)           │
       │                                    └── processes payments (Stripe)            │
       │                                                                               │
       └── Smart Contracts (L2) ◀────────────── ComplianceRegistry logs ◀──────────────┘
```

**Data Flow:**
1. Connect wallet → Wallet signature auth → JWT issued
2. Generate ZK proof locally (age >= 18) → Submit to API → Hash stored on-chain
3. Select membership tier → Pay via Stripe/crypto → Soulbound NFT minted
4. Access content → API verifies NFT + age → Token-gated access granted
5. Every check logged on-chain (ComplianceRegistry) + off-chain (compliance_logs)
6. Daily automated compliance audits at 02:00 UTC

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Smart Contracts** | Solidity 0.8.24, Hardhat, OpenZeppelin |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic |
| **Frontend Web** | Next.js 14 (App Router), React 18, Tailwind CSS, wagmi/viem |
| **Mobile** | React Native (Expo), Appium/WebDriverIO |
| **ZK Proofs** | Noir >=0.34.0 (Barretenberg backend) |
| **Database** | PostgreSQL 16, Redis 7 |
| **Infrastructure** | Docker, Kubernetes (Helm), GitHub Container Registry |
| **CI/CD** | GitHub Actions (7 workflows) |
| **Monitoring** | OpenTelemetry, Sentry, Prometheus |
| **Security** | OWASP ZAP, Bandit, Safety, Trivy, Gitleaks, Snyk |
| **Payments** | Stripe Payment Intents + Webhooks |

---

## Project Structure

```
.
├── AGENTS.md                 # opencode agent context
├── Makefile                  # Dev/test/lint/deploy commands
├── docker-compose.yml        # Local dev services
├── requirements.txt          # Python dependencies
├── .env.example              # Environment template
│
├── backend/                  # FastAPI Python backend
│   └── app/
│       ├── main.py           # App entry, lifespan, exception handlers
│       ├── api/              # Routes: auth, membership, content, compliance, admin, payments
│       ├── core/             # Config, DB, Redis, OpenTelemetry, Security
│       ├── models/           # SQLAlchemy ORM: User, Subscription, Payment, Content, etc.
│       ├── services/         # Business logic: age_verification, compliance_checker
│       └── zk-proofs/        # Noir proof generation/verification
│
├── contracts/                # Solidity smart contracts
│   ├── contracts/
│   │   ├── MembershipNFT.sol           # Soulbound ERC-721 (BASIC/PREMIUM/VIP)
│   │   ├── AgeVerificationOracle.sol   # On-chain age verification registry
│   │   ├── TokenGatedAccess.sol        # Access control (NFT + age check)
│   │   ├── ComplianceRegistry.sol      # Immutable audit trail
│   │   └── SubscriptionManager.sol     # On-chain subscriptions
│   ├── test/                 # Hardhat + Chai tests
│   ├── scripts/              # Deploy scripts
│   └── hardhat.config.ts     # Hardhat config (Sepolia, Mainnet)
│
├── frontend/                 # Next.js 14 web app
│   ├── app/                  # App Router: content/, membership/, verify/, admin/
│   ├── components/           # Reusable React components
│   └── lib/                  # Web3 hooks, API client
│
├── mobile/                   # React Native (Expo) mobile app
│   ├── app/                  # Screens, components, services
│   └── tests/                # Appium/WebDriverIO E2E tests
│
├── zk-circuits/              # Noir zero-knowledge circuits
│   ├── age-verification/     # Age >= threshold proof
│   └── membership-proof/     # Membership tier possession proof
│
├── tests/
│   ├── e2e/                  # Playwright E2E tests
│   ├── performance/          # k6 load tests
│   └── security/             # OWASP ZAP scan scripts
│
├── scripts/
│   ├── ci/                   # CI helper scripts
│   └── compliance/           # Compliance report generation
│
├── infra/
│   ├── docker/               # Docker Compose overrides
│   ├── helm/                 # Helm charts for K8s
│   └── k8s/                  # Raw Kubernetes manifests
│
├── docs/
│   ├── api/                  # REST API and webhook docs
│   ├── architecture/         # System architecture, security model
│   ├── compliance/           # Age verification, audit trail
│   └── security/             # OWASP Top 10, ZK proofs
│
└── .github/workflows/        # 7 CI/CD pipelines
```

---

## Prerequisites

- **Node.js** 20+ (with npm)
- **Python** 3.12+
- **Docker** Desktop 24+ (with Docker Compose V2)
- **Noir** >=0.34.0 (for ZK circuit development)
- **MetaMask** or any WalletConnect-compatible wallet
- **Stripe CLI** (for webhook testing)

---

## Installation

### 1. Clone and Configure

```bash
git clone <repo-url>
cd nft-gated-adult-fan-club-compliance
cp .env.example .env
```

Edit `.env` with your configuration (at minimum `JWT_SECRET`).

### 2. Start Infrastructure Services

```bash
docker compose up -d postgres redis
```

### 3. Backend Setup

```bash
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
make db-migrate
make backend
```

Backend runs at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### 4. Frontend Setup

```bash
cd frontend
npm install
make frontend
```

Frontend runs at `http://localhost:3000`.

### 5. Compile Smart Contracts

```bash
make contracts
```

### 6. Compile ZK Circuits

```bash
make zk-compile
```

### 7. Full Dev Environment

```bash
make dev
```

Starts all services: PostgreSQL, Redis, Backend (with hot reload), Frontend.

---

## Development Workflow

```bash
# Start specific services
make backend        # Backend only (uvicorn --reload)
make frontend       # Frontend only (next dev)

# Database
make db-migrate     # Run pending migrations
make db-reset       # Reset and re-migrate

# Smart Contracts
make contracts      # Compile + test
make deploy-local   # Deploy to local Hardhat node

# ZK Circuits
make zk-compile     # Compile Noir circuits
make zk-test        # Run Noir circuit tests

# Quality
make lint           # Ruff (Python) + ESLint (JS)
make format         # Ruff format + Prettier
make typecheck      # MyPy + TypeScript

# Docker
make docker-up      # Start Docker services
make docker-down    # Stop Docker services
make docker-test    # Run tests in Docker

# Full CI pipeline
make ci
```

---

## Testing

| Test Type | Tool | Command | Location |
|-----------|------|---------|----------|
| Backend unit/integration | pytest + pytest-asyncio | `make test-backend` | `backend/tests/` |
| Frontend unit | Jest + Testing Library | `make test-frontend` | `frontend/` |
| Smart contract | Hardhat + Chai | `make test-contracts` | `contracts/test/` |
| Web E2E | Playwright | `make test-e2e` | `tests/e2e/` |
| Mobile E2E (Android) | Appium + WebDriverIO | `make test-appium` | `mobile/tests/` |
| Mobile E2E (iOS) | Appium + WebDriverIO | `make test-appium` | `mobile/tests/` |
| Performance | k6 | `make test-perf` | `tests/performance/` |
| Security (DAST) | OWASP ZAP | `make test-security` | `tests/security/` |
| Security (SAST) | Bandit | `make bandit` | CI workflow |
| Dependency scan | Safety, Snyk, Trivy | `make safety` | CI workflow |
| Secret scan | Gitleaks | — | CI workflow |
| Contract analysis | Slither, Mythril | — | CI workflow |

```bash
# Run all tests
make test

# Run all security scans
make security

# Run full CI pipeline locally
make ci
```

---

## CI/CD Pipelines

The project includes 7 GitHub Actions workflows:

| Workflow | Trigger | Key Jobs |
|----------|---------|----------|
| **ci.yml** | Push/PR to main, dev | Lint, backend tests (w/ Postgres+Redis), contract tests, Docker build+push |
| **smart-contracts.yml** | Push/PR touching contracts/ | Compile, test, Slither, Mythril, coverage, gas report |
| **zk-circuits.yml** | Push/PR touching zk-circuits/ | Compile, test, size check, Solidity verifier generation |
| **security-scan.yml** | Push main, weekly Monday | Bandit SAST, Safety+Snyk dependency scan, OWASP ZAP DAST, Trivy container scan, Gitleaks secret scan |
| **compliance-audit.yml** | Daily cron (02:00 UTC) | Generate compliance report, check expired verifications |
| **appium-tests.yml** | Label `e2e-mobile` or push main touching mobile/ | Android emulator E2E, iOS simulator E2E |
| **deploy.yml** | Push to main | Deploy staging, E2E tests, deploy production, k6 smoke tests |

---

## Security

- **Wallet-Based Auth**: EIP-191 signature verification; no passwords to leak
- **ZK Age Verification**: Prove age >= 18 without revealing birth date
- **JWT Security**: Short-lived tokens (60 min), Redis blacklisting
- **Rate Limiting**: Redis sliding window per endpoint
- **Input Validation**: Pydantic v2 models; parameterized SQLAlchemy queries
- **OWASP ZAP**: Automated DAST against OpenAPI spec in CI
- **Smart Contract Audits**: Slither + Mythril static analysis in CI
- **Dependency Scanning**: Safety, Snyk, Trivy scans on every push
- **Secret Scanning**: Gitleaks scans for committed secrets
- **Soulbound NFTs**: Non-transferable by design; admin-revocable
- **Dual Audit Trail**: Immutable on-chain + queryable off-chain compliance logs

See `docs/security/owasp.md` for detailed OWASP Top 10 mitigation mapping.

---

## Documentation

| Document | Description |
|----------|-------------|
| `docs/architecture/overview.md` | System architecture, 4-layer design, data flow |
| `docs/architecture/security-model.md` | Threat model, trust boundaries, authentication/authorization |
| `docs/api/rest.md` | Complete REST API reference with request/response schemas |
| `docs/api/webhooks.md` | Stripe and KYC webhook specifications |
| `docs/security/owasp.md` | OWASP Top 10 (2021) mitigation mapping |
| `docs/security/zk-proofs.md` | ZK age verification circuit design and verification flow |
| `docs/compliance/age-verification.md` | Regulatory framework, compliance approach, privacy |
| `docs/compliance/audit-trail.md` | On-chain + off-chain audit trail design and integrity |
| `docs/CONTRIBUTING.md` | Contribution guidelines |

---

## License

[MIT](LICENSE)

---

*Built with Solidity, Python, Next.js, React Native, Noir, and a lot of compliance paperwork.*
