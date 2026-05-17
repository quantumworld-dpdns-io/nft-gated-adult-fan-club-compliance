import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '5m', target: 500 },
    { duration: '5m', target: 500 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.10'],
    http_req_duration: ['p(90)<3000', 'p(95)<5000'],
    http_req_failed: ['rate<0.10'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export default function () {
  group('API Endpoints', function () {
    const endpoints = [
      { method: 'GET', url: `${BASE_URL}/health` },
      { method: 'GET', url: `${BASE_URL}/api/membership/tiers` },
      { method: 'GET', url: `${BASE_URL}/api/compliance/age-verification/methods` },
    ];

    endpoints.forEach(({ method, url }) => {
      const res = http.get(url);
      check(res, { [`${url} responds`]: (r) => r.status < 500 });
      responseTime.add(res.timings.duration);
      errorRate.add(res.status >= 500);
    });

    sleep(1);
  });

  group('Auth Stress', function () {
    const wallet = '0x' + Math.random().toString(16).substring(2, 42);
    const registerPayload = JSON.stringify({
      wallet: wallet,
      email: `stress_${Math.random()}@example.com`,
      username: `user_${Math.random()}`,
      password: 'StressTestPass123!',
    });

    const registerRes = http.post(`${BASE_URL}/api/auth/register`, registerPayload, {
      headers: { 'Content-Type': 'application/json' },
    });
    check(registerRes, { 'register responds': (r) => r.status < 500 });
    responseTime.add(registerRes.timings.duration);

    const loginPayload = JSON.stringify({
      wallet: wallet,
      signature: '0x' + 'cd'.repeat(32),
      message: 'Stress test login',
    });
    const loginRes = http.post(`${BASE_URL}/api/auth/login/wallet`, loginPayload, {
      headers: { 'Content-Type': 'application/json' },
    });
    check(loginRes, { 'login responds': (r) => r.status < 500 });
    responseTime.add(loginRes.timings.duration);

    sleep(1);
  });

  group('Concurrent Content Access', function () {
    const token = __ENV.AUTH_TOKEN || '';
    if (token) {
      const contentEndpoints = [
        `${BASE_URL}/api/content/protected`,
        `${BASE_URL}/api/content/premium`,
        `${BASE_URL}/api/content/free`,
      ];

      contentEndpoints.forEach((url) => {
        const res = http.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        check(res, { [`content ${url} responds`]: (r) => r.status < 500 });
        responseTime.add(res.timings.duration);
      });
    }

    sleep(0.5);
  });

  group('Compliance Stress', function () {
    const verificationPayload = JSON.stringify({
      date_of_birth: '1990-01-01',
      country: 'US',
      document_type: 'passport',
    });

    const res = http.post(`${BASE_URL}/api/compliance/age-verification`, verificationPayload, {
      headers: { 'Content-Type': 'application/json' },
    });
    check(res, { 'age verification responds': (r) => r.status < 500 });
    responseTime.add(res.timings.duration);

    sleep(0.5);
  });
}
