# Performance Test Notes

## Running Tests

```bash
# Load test
k6 run tests/performance/load-test.js

# Stress test
k6 run tests/performance/stress-test.js

# With custom base URL
BASE_URL=http://staging.example.com k6 run tests/performance/load-test.js

# With authentication token
AUTH_TOKEN=eyJ... k6 run tests/performance/stress-test.js
```

## Test Scenarios

### Load Test (`load-test.js`)
- Simulates normal traffic patterns
- Ramps up to 50 concurrent users over 1 minute
- Sustains 50 users for 3 minutes
- Ramps to 100 users over 1 minute
- Sustains 100 users for 3 minutes
- Ramps down over 1 minute

### Stress Test (`stress-test.js`)
- Simulates peak traffic conditions
- Ramps to 100, 200, 300, and 500 concurrent users
- Sustains 500 users for 5 minutes
- Tests system behavior under extreme load

## Thresholds

### Load Test
- Error rate: < 5%
- Auth failures: < 1%
- Response time p(95): < 2s
- Response time p(99): < 5s

### Stress Test
- Error rate: < 10%
- Response time p(90): < 3s
- Response time p(95): < 5s

## Metrics Tracked
- Error rate (errors per request)
- Response time distribution
- Auth failure rate
- HTTP request failure rate
