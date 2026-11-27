import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMP_BYPASS_ADMIN_AUTH, getAdminAuth } from '../utils/auth';
import { handleAdminRoutes } from '../server/routes/adminRoutes';
import { handleAnalyticsRoutes } from '../server/routes/analyticsRoutes';
import { handleCommunityRoutes } from '../server/routes/communityRoutes';

function createJsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('1. Production Clerk Admin Auth is strictly enforced (TEMP_BYPASS_ADMIN_AUTH === false)', async () => {
  assert.equal(TEMP_BYPASS_ADMIN_AUTH, false);

  const unauthReq = new Request('http://localhost:3000/api/admin/verify', {
    method: 'GET',
  });
  const env = {
    CLERK_SECRET_KEY: 'sk_test_dummy_key_for_unit_test',
    ADMIN_EMAIL: 'admin@anidub.in',
  };

  const session = await getAdminAuth(unauthReq, env);
  assert.equal(session.authenticated, false);
  assert.equal(session.isAdmin, false);
  assert.equal(session.userId, null);

  const verifyRes = await handleAdminRoutes({
    request: unauthReq,
    env: env as any,
    url: new URL(unauthReq.url),
    path: '/api/admin/verify',
    method: 'GET',
    jsonResponse: createJsonResponse as any,
  });
  assert.ok(verifyRes);
  assert.equal(verifyRes.status, 401);

  const pendingReq = new Request('http://localhost:3000/api/admin/pending', { method: 'GET' });
  const pendingRes = await handleAdminRoutes({
    request: pendingReq,
    env: env as any,
    url: new URL(pendingReq.url),
    path: '/api/admin/pending',
    method: 'GET',
    jsonResponse: createJsonResponse as any,
  });
  assert.ok(pendingRes);
  assert.equal(pendingRes.status, 401);

  const analyticsReq = new Request('http://localhost:3000/api/analytics/dashboard', { method: 'GET' });
  const analyticsRes = await handleAnalyticsRoutes({
    request: analyticsReq,
    env: env as any,
    url: new URL(analyticsReq.url),
    path: '/api/analytics/dashboard',
    method: 'GET',
    jsonResponse: createJsonResponse as any,
  });
  assert.ok(analyticsRes);
  assert.equal(analyticsRes.status, 401);
});

test('2. Analytics POST /api/track defaults missing region and city to Unknown (never Tamil Nadu / Chennai)', async () => {
  const boundParams: any[][] = [];
  const mockDb = {
    prepare: (_sql: string) => ({
      bind: (...args: any[]) => {
        boundParams.push(args);
        return {
          run: async () => ({ success: true }),
        };
      },
    }),
  };

  const trackReq = new Request('http://localhost:3000/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'sess_test_123',
      path: '/explore',
    }),
  });

  const res = await handleAnalyticsRoutes({
    request: trackReq,
    env: { DB: mockDb } as any,
    url: new URL(trackReq.url),
    path: '/api/track',
    method: 'POST',
    jsonResponse: createJsonResponse as any,
  });

  assert.ok(res);
  assert.equal(res.status, 200);
  assert.ok(boundParams.length >= 1);
  const sessionBind = boundParams[0];
  // [sessionId, clerkUserId, ipHash, country, region, city, os, browser, deviceType, referrer]
  assert.equal(sessionBind[3], 'Unknown');
  assert.equal(sessionBind[4], 'Unknown');
  assert.equal(sessionBind[5], 'Unknown');
});

test('3. Feedback PATCH /api/feedback/:id requires Admin Auth when unauthenticated', async () => {
  const patchReq = new Request('http://localhost:3000/api/feedback/42', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' }),
  });

  const res = await handleCommunityRoutes({
    request: patchReq,
    env: { CLERK_SECRET_KEY: 'sk_test_dummy' } as any,
    url: new URL(patchReq.url),
    path: '/api/feedback/42',
    method: 'PATCH',
    jsonResponse: createJsonResponse as any,
  });

  assert.ok(res);
  assert.equal(res.status, 401);
});
