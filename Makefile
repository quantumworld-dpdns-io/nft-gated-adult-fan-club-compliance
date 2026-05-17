.PHONY: help dev test lint clean docker ci security appium contracts

help:
	@echo "=== NFT-Gated Adult Fan Club Compliance ==="
	@echo ""
	@echo "Development:"
	@echo "  make dev           Start all services in development mode"
	@echo "  make backend       Start backend API server"
	@echo "  make frontend      Start frontend dev server"
	@echo ""
	@echo "Testing:"
	@echo "  make test          Run all tests (unit + integration)"
	@echo "  make test-backend  Run backend tests"
	@echo "  make test-frontend Run frontend tests"
	@echo "  make test-contracts Run smart contract tests"
	@echo "  make test-appium   Run Appium mobile E2E tests"
	@echo "  make test-security Run OWASP ZAP security scan"
	@echo "  make test-e2e      Run Playwright E2E tests"
	@echo "  make test-perf     Run performance load tests"
	@echo ""
	@echo "Security:"
	@echo "  make security      Run all security scans"
	@echo "  make owasp-zap     Run OWASP ZAP scan"
	@echo "  make bandit        Run Python security linter"
	@echo "  make safety        Check dependency vulnerabilities"
	@echo ""
	@echo "Quality:"
	@echo "  make lint          Run all linters"
	@echo "  make format        Format all code"
	@echo "  make typecheck     Run type checking"
	@echo ""
	@echo "Contracts:"
	@echo "  make contracts     Compile and test smart contracts"
	@echo "  make deploy-local  Deploy contracts to local network"
	@echo ""
	@echo "Infrastructure:"
	@echo "  make docker-up     Start all Docker services"
	@echo "  make docker-down   Stop all Docker services"
	@echo "  make docker-test   Run tests in Docker"
	@echo "  make ci            Run full CI pipeline locally"
	@echo ""
	@echo "ZK Proofs:"
	@echo "  make zk-compile    Compile Noir ZK circuits"
	@echo "  make zk-test       Test ZK circuits"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate    Run database migrations"
	@echo "  make db-reset      Reset and reinitialize database"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean         Remove build artifacts and caches"

dev:
	@echo "Starting development environment..."
	docker-compose up -d
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost:3000"
	@echo "API Docs: http://localhost:8000/docs"

backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && npm run dev

test:
	@echo "Running all tests..."
	make test-backend
	make test-frontend
	make test-contracts

test-backend:
	cd backend && pytest -v --cov=app --cov-report=term-missing

test-frontend:
	cd frontend && npm test -- --coverage

test-contracts:
	cd contracts && npx hardhat test

test-appium:
	cd mobile && npx wdio run wdio.conf.js

test-security:
	@echo "Running OWASP ZAP security scan..."
	cd tests/security && bash run-owasp-scan.sh

test-e2e:
	cd tests/e2e && npx playwright test

test-perf:
	cd tests/performance && k6 run load-test.js

security:
	make bandit
	make safety
	make owasp-zap

bandit:
	cd backend && bandit -r app/ -f json -o bandit-report.json

safety:
	safety check -r requirements.txt

owasp-zap:
	cd tests/security && bash run-owasp-scan.sh

lint:
	cd backend && ruff check .
	cd frontend && npm run lint

format:
	cd backend && ruff format .
	cd frontend && npm run format

typecheck:
	cd backend && mypy app/
	cd frontend && npm run typecheck

contracts:
	cd contracts && npx hardhat compile && npx hardhat test

deploy-local:
	cd contracts && npx hardhat run scripts/deploy.ts --network localhost

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-test:
	docker-compose -f docker-compose.test.yml up --abort-on-container-exit --build

zk-compile:
	cd zk-circuits && nargo compile

zk-test:
	cd zk-circuits && nargo test

db-migrate:
	cd backend && alembic upgrade head

db-reset:
	cd backend && alembic downgrade base && alembic upgrade head

ci:
	make lint
	make test
	make security
	make docker-test

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "build" -exec rm -rf {} + 2>/dev/null || true
	rm -f .coverage coverage.xml
	rm -rf backend/htmlcov
