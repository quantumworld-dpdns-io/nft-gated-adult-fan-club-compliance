import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const authFailRate = new Rate('auth_failures');

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.05'],
    auth_failures: ['rate<0.01'],
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export function setup() {
  const res = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    wallet: '0xloadtestwallet',
    email: 'loadtest@example.com',
    username: 'loadtester',
    password: 'LoadTestPass123!',
  }), { headers: { 'Content-Type': 'application/json' } });

  const token = res.json('access_token') || '';
  return { token };
}

export default function (data) {
  group('Health & Discovery', function () {
    const res = http.get(`${BASE_URL}/health`);
    check(res, { 'health status 200': (r) => r.status === 200 });
    responseTime.add(res.timings.duration);

    const tiersRes = http.get(`${BASE_URL}/api/membership/tiers`);
    check(tiersRes, { 'tiers status 200': (r) => r.status === 200 });
    responseTime.add(tiersRes.timings.duration);

    sleep(1);
  });

  group('Authentication', function () {
    const payload = JSON.stringify({
      wallet: '0x' + Math.random().toString(16).substring(2, 42),
      signature: '0x' + 'ab'.repeat(32),
      message: 'Sign to authenticate: ' + Date.now(),
    });

    const res = http.post(`${BASE_URL}/api/auth/login/wallet`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    check(res, { 'login status 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
    authFailRate.add(res.status === 401);
    responseTime.add(res.timings.duration);

    sleep(2);
  });

  group('Content Access', function () {
    if (data.token) {
      const res = http.get(`${BASE_URL}/api/content/protected`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      check(res, { 'content access responds': (r) => r.status < 500 });
      responseTime.add(res.timings.duration);
    }

    sleep(1);
  });

  group('Compliance Check', function () {
    if (data.token) {
      const res = http.get(`${BASE_URL}/api/compliance/age-verification/status`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      check(res, { 'compliance status responds': (r) => r.status < 500 });
      responseTime.add(res.timings.duration);
    }

    sleep(1);
  });
}

export function teardown(data) {
  if (data.token) {
    http.del(`${BASE_URL}/api/user/account`, null, {
      headers: { Authorization: `Bearer ${data.token}` },
    });
  }
}
