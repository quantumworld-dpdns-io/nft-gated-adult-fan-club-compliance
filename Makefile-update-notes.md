# Makefile Update Notes for Test Targets

## Current test targets (already in Makefile):
- test-backend     - Runs `cd backend && pytest -v --cov=app --cov-report=term-missing`
- test-frontend    - Runs frontend tests
- test-contracts   - Runs smart contract tests
- test-appium      - Runs Appium mobile E2E tests
- test-security    - Runs OWASP ZAP security scan
- test-e2e         - Runs Playwright E2E tests
- test-perf        - Runs k6 performance load tests

## Additional targets to ADD to Makefile:

```makefile
# === Backend Unit Tests ===
test-backend-unit:
	cd backend && pytest -v tests/unit/ --cov=app --cov-report=term-missing

# === Backend Integration Tests ===
test-backend-integration:
	cd backend && pytest -v tests/integration/ --cov=app --cov-report=term-missing

# === Backend Security Tests ===
test-backend-security:
	cd backend && pytest -v tests/security/ -v

# === Specific Backend Test Modules ===
test-backend-auth:
	cd backend && pytest -v tests/unit/test_auth.py -v

test-backend-membership:
	cd backend && pytest -v tests/unit/test_membership.py -v

test-backend-compliance:
	cd backend && pytest -v tests/unit/test_compliance.py -v

test-backend-zk:
	cd backend && pytest -v tests/unit/test_zk_proofs.py -v

# === Security Scans ===
test-zap-api:
	cd tests/security && bash zap-api-scan.sh

test-zap-auth:
	cd tests/security && bash zap-authenticated-scan.sh

test-safety:
	safety check -r requirements.txt
	safety check -r tests/security/dependency-scan/requirements-check.txt

test-bandit:
	cd backend && bandit -r app/ -f json -o bandit-report.json

test-all-security:
	make bandit
	make safety
	make test-backend-security
	make owasp-zap

# === Performance Tests ===
test-perf-stress:
	cd tests/performance && k6 run stress-test.js

test-perf-all:
	cd tests/performance && k6 run load-test.js && k6 run stress-test.js

# === E2E Tests by Browser ===
test-e2e-chromium:
	cd tests/e2e && npx playwright test --project=chromium

test-e2e-firefox:
	cd tests/e2e && npx playwright test --project=firefox

test-e2e-webkit:
	cd tests/e2e && npx playwright test --project=webkit

test-e2e-mobile:
	cd tests/e2e && npx playwright test --project="Mobile Chrome" --project="Mobile Safari"

test-e2e-api:
	cd tests/e2e && npx playwright test --project=api

# === Coverage ===
test-coverage:
	cd backend && pytest --cov=app --cov-report=html --cov-report=xml --cov-report=term-missing

# === Watch Mode (development) ===
test-backend-watch:
	cd backend && ptw -- -v

# === Docker Test Commands ===
docker-test-unit:
	docker-compose -f docker-compose.test.yml run --rm backend pytest tests/unit/ -v

docker-test-integration:
	docker-compose -f docker-compose.test.yml run --rm backend pytest tests/integration/ -v

# === Test with specific markers ===
test-slow:
	cd backend && pytest -v -m slow

test-fast:
	cd backend && pytest -v -m "not slow"
```

## How to add:
1. Open Makefile
2. Add the above targets after the existing `test-perf:` target (around line 92)
3. Save the file
