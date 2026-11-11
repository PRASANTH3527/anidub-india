import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isAuthorizedClerkAdmin,
  getAuthorizedAdminEmail,
  extractClerkJwtFromRequest,
  getAuth,
  auth,
} from './auth';

test('Security Audit 1: Mock auth removed & official @clerk/nextjs used without sessionStorage or hardcoded keys', () => {
  const clerkLibCode = fs.readFileSync(path.join(process.cwd(), 'src/lib/clerk.tsx'), 'utf-8');
  const mainCode = fs.readFileSync(path.join(process.cwd(), 'src/main.tsx'), 'utf-8');
  const authCode = fs.readFileSync(path.join(process.cwd(), 'src/utils/auth.ts'), 'utf-8');

  // Verify sessionStorage and mock sign-in card are completely gone
  assert.equal(clerkLibCode.includes('sessionStorage'), false, 'sessionStorage must not be used in src/lib/clerk.tsx');
  assert.equal(clerkLibCode.includes('SimulatedSignInCard'), false, 'SimulatedSignInCard must be removed');
  assert.equal(clerkLibCode.includes('clerk_active_session'), false, 'clerk_active_session must be removed');

  // Verify main.tsx wraps the app with ClerkProvider from @clerk/nextjs and has no hardcoded pk_test_ fallback
  assert.equal(mainCode.includes("from '@clerk/nextjs'"), true, 'main.tsx must import ClerkProvider from @clerk/nextjs');
  assert.equal(mainCode.includes('pk_test_'), false, 'main.tsx must not contain a hardcoded publishable key fallback');

  // Verify auth.ts has no hardcoded fallback email, no hardcoded secret, and no fake token generation
  assert.equal(authCode.includes('prasanth01236'), false, 'auth.ts must not contain hardcoded fallback email');
  assert.equal(authCode.includes('clerk_edge_hmac'), false, 'auth.ts must not contain hardcoded signing secret');
  assert.equal(authCode.includes('generateAdminToken'), false, 'auth.ts must not contain fake token generator');
  assert.equal(authCode.includes('createAdminToken'), false, 'auth.ts must not contain fake token generator');
});

test('Security Audit 2: Strict ADMIN_EMAIL validation with zero hardcoded fallbacks', () => {
  const originalAdminEmail = process.env.ADMIN_EMAIL;
  try {
    // 1. When ADMIN_EMAIL is not configured, nobody is authorized
    delete process.env.ADMIN_EMAIL;
    assert.equal(getAuthorizedAdminEmail(), '');
    assert.equal(
      isAuthorizedClerkAdmin({
        id: 'user_2abc123',
        primaryEmailAddress: { emailAddress: 'admin@example.com' },
      }),
      false
    );

    // 2. When ADMIN_EMAIL is configured, only the exact matching Clerk user is authorized
    process.env.ADMIN_EMAIL = 'configured-admin@example.com';
    assert.equal(getAuthorizedAdminEmail(), 'configured-admin@example.com');

    assert.equal(isAuthorizedClerkAdmin(null), false);
    assert.equal(isAuthorizedClerkAdmin('viewer@anidub.in'), false);
    assert.equal(
      isAuthorizedClerkAdmin({
        id: 'user_regular123',
        primaryEmailAddress: { emailAddress: 'viewer@anidub.in' },
      }),
      false
    );
    assert.equal(
      isAuthorizedClerkAdmin({
        id: 'guest',
        primaryEmailAddress: { emailAddress: 'configured-admin@example.com' },
      }),
      false
    );
    assert.equal(
      isAuthorizedClerkAdmin({
        id: 'user_admin_clerk_1',
        primaryEmailAddress: { emailAddress: 'configured-admin@example.com' },
      }),
      true
    );
  } finally {
    if (originalAdminEmail === undefined) {
      delete process.env.ADMIN_EMAIL;
    } else {
      process.env.ADMIN_EMAIL = originalAdminEmail;
    }
  }
});

test('Security Audit 3: Backend getAuth() & auth() cryptographically verify JWTs and never trust client body or custom headers', async () => {
  process.env.ADMIN_EMAIL = 'configured-admin@example.com';

  // 1. Spoofed client body and custom headers without a valid cryptographic JWT must be rejected
  const spoofedReq = {
    headers: {
      'x-clerk-user-id': 'user_admin_clerk_1',
      'x-clerk-user-email': 'configured-admin@example.com',
      'x-user-id': 'user_admin_clerk_1',
      'x-admin-token': 'local_admin_session',
    },
    body: {
      userId: 'user_admin_clerk_1',
      user_id: 'user_admin_clerk_1',
      clerk_user_id: 'user_admin_clerk_1',
      email: 'configured-admin@example.com',
      clerk_email: 'configured-admin@example.com',
    },
  };

  assert.equal(extractClerkJwtFromRequest(spoofedReq), null);
  const spoofedSession = await getAuth(spoofedReq);
  assert.equal(spoofedSession.authenticated, false);
  assert.equal(spoofedSession.userId, null);
  assert.equal(spoofedSession.isAdmin, false);

  // 2. Forged / unsigned 3-part JWT in Authorization header must be rejected by Clerk verifyToken
  const forgedHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const forgedPayload = Buffer.from(
    JSON.stringify({ sub: 'user_admin_clerk_1', email: 'configured-admin@example.com' })
  ).toString('base64url');
  const forgedJwt = `${forgedHeader}.${forgedPayload}.invalidsignature`;

  const forgedReq = {
    headers: {
      authorization: `Bearer ${forgedJwt}`,
    },
  };
  assert.equal(extractClerkJwtFromRequest(forgedReq), forgedJwt);

  const forgedSession = await auth(forgedReq);
  assert.equal(forgedSession.authenticated, false);
  assert.equal(forgedSession.userId, null);
  assert.equal(forgedSession.isAdmin, false);
});

test('Security Audit 4: ImgBB API key & hardcoded credentials are not exposed in source code, and routes enforce auth', () => {
  const filesToScan = [
    'src/utils/imgbb.ts',
    'src/utils/auth.ts',
    'src/lib/clerk.tsx',
    'src/App.tsx',
    'src/components/Navbar.tsx',
    'src/components/AdminLoginModal.tsx',
    'src/services/cloudflareApi.ts',
    'server.ts',
    'functions/api/[[route]].ts',
    'worker.js',
  ];

  for (const relPath of filesToScan) {
    const fullPath = path.join(process.cwd(), relPath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    assert.equal(
      content.includes('Ee6b4e37ae9c228c29b8448483b6591b'),
      false,
      `Exposed ImgBB key found in ${relPath}`
    );
    assert.equal(
      content.includes('prasanth123'),
      false,
      `Hardcoded admin password found in ${relPath}`
    );
    assert.equal(
      content.includes('prasanth01236'),
      false,
      `Hardcoded fallback admin email found in ${relPath}`
    );
    assert.equal(
      content.includes('local_admin_session'),
      false,
      `Fake admin token found in ${relPath}`
    );
  }

  const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
  assert.ok(serverCode.includes('process.env.IMGBB_API_KEY'));
  assert.ok(serverCode.includes('await getAuth(req)'));
  assert.ok(serverCode.includes("app.post('/api/upload', requireUserAuth"));
  assert.ok(serverCode.includes("app.post('/api/anime', requireAdminAuth"));
  assert.ok(serverCode.includes("app.put('/api/anime/:id', requireAdminAuth"));
  assert.ok(serverCode.includes("app.delete('/api/anime/:id', requireAdminAuth"));
  assert.ok(serverCode.includes("app.post(['/api/rate', '/api/anime/:id/rate'], requireUserAuth"));
  assert.ok(serverCode.includes("app.post('/api/anime/:id/reviews', requireUserAuth"));
  assert.ok(serverCode.includes("app.get('/api/user/profile', requireUserAuth"));
  assert.ok(serverCode.includes("app.put('/api/user/profile', requireUserAuth"));
  assert.ok(serverCode.includes("app.post(['/api/chat', '/api/chat/messages'], requireUserAuth"));
  assert.ok(serverCode.includes("app.post('/api/watchlist', requireUserAuth"));
  assert.ok(serverCode.includes("app.post('/api/report', requireUserAuth"));
  assert.ok(serverCode.includes("app.get('/api/analytics/dashboard', requireAdminAuth"));
});

test('Security Audit 5: D1 Database Security (No raw client SQL) & User Actions extract userId strictly from session', () => {
  const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
  const edgeRouteCode = fs.readFileSync(path.join(process.cwd(), 'functions/api/[[route]].ts'), 'utf-8');
  const apiClientCode = fs.readFileSync(path.join(process.cwd(), 'src/services/cloudflareApi.ts'), 'utf-8');

  // 1. D1 Database Security: Raw SQL execution from client is forbidden
  assert.equal(serverCode.includes('db.exec(sql)'), false, 'server.ts must never execute raw client SQL via db.exec(sql)');
  assert.equal(
    edgeRouteCode.includes('env.DB.prepare(body.sql)'),
    false,
    'functions/api/[[route]].ts must never execute raw client SQL via env.DB.prepare(body.sql)'
  );
  assert.equal(
    apiClientCode.includes('JSON.stringify({ sql })'),
    false,
    'cloudflareApi.ts must not send raw SQL strings to the backend'
  );
  assert.ok(
    serverCode.includes('if (body.sql !== undefined)'),
    'server.ts D1 query endpoint must explicitly reject raw sql payloads'
  );
  assert.ok(
    edgeRouteCode.includes('if (body.sql !== undefined)'),
    'functions/api/[[route]].ts D1 query endpoint must explicitly reject raw sql payloads'
  );

  // 2. API Route Protection (Anime/Catalog): Create, Update, Delete require Admin session
  assert.ok(serverCode.includes("app.post('/api/anime', requireAdminAuth"));
  assert.ok(serverCode.includes("app.post('/api/anime/bulk', requireAdminAuth"));
  assert.ok(serverCode.includes("app.put('/api/anime/:id', requireAdminAuth"));
  assert.ok(serverCode.includes("app.delete('/api/anime/:id', requireAdminAuth"));
  assert.ok(edgeRouteCode.includes("getAuth(request, env)"));

  // 3. User Actions (Profile, Chat, Rating): Never trust client user_id or 'default_user'
  assert.equal(
    serverCode.includes("WHERE id = 'default_user'"),
    false,
    'server.ts must not hardcode default_user for user profiles'
  );
  assert.equal(
    edgeRouteCode.includes("WHERE id = 'default_user'"),
    false,
    'functions/api/[[route]].ts must not hardcode default_user for user profiles'
  );
  assert.equal(
    apiClientCode.includes("'x-user-id'"),
    false,
    'cloudflareApi.ts must not send spoofable x-user-id headers'
  );
  assert.equal(
    apiClientCode.includes("'x-clerk-user-id'"),
    false,
    'cloudflareApi.ts must not send spoofable x-clerk-user-id headers'
  );
});

test('Security Audit 6: Worker JWT Signature Verification, WebSocket DO Auth, Cloudflare env bindings & Feedback Protection', async () => {
  const workerCode = fs.readFileSync(path.join(process.cwd(), 'worker.js'), 'utf-8');
  const authCode = fs.readFileSync(path.join(process.cwd(), 'src/utils/auth.ts'), 'utf-8');
  const edgeRouteCode = fs.readFileSync(path.join(process.cwd(), 'functions/api/[[route]].ts'), 'utf-8');

  // 1. True Worker JWT Verification: uses @clerk/backend verifyToken, never unverified atob()
  assert.ok(
    workerCode.includes("import { createClerkClient, verifyToken } from '@clerk/backend'"),
    'worker.js must import verifyToken from @clerk/backend'
  );
  assert.equal(
    workerCode.includes('atob('),
    false,
    'worker.js must not decode JWT payloads with unverified atob()'
  );
  const { isWorkerClerkAdmin, getWorkerClerkUserId } = await import('../../worker.js');
  const forgedJwt = [
    Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: 'user_forged_123', email: 'admin@anidub.in', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
    'forged_signature_bytes'
  ].join('.');
  const forgedReq = new Request('https://anidub.in/api/admin/verify', {
    headers: { Authorization: `Bearer ${forgedJwt}` }
  });
  const workerEnv = { ADMIN_EMAIL: 'admin@anidub.in', CLERK_SECRET_KEY: 'sk_test_dummy_key_for_sig_check' };
  assert.equal(await getWorkerClerkUserId(forgedReq, workerEnv), null, 'getWorkerClerkUserId must reject forged JWTs');
  assert.equal(await isWorkerClerkAdmin(forgedReq, workerEnv), false, 'isWorkerClerkAdmin must reject forged JWTs');

  // 2. WebSocket & Durable Object Security: authenticates before upgrading
  assert.ok(
    workerCode.includes('path === "/ws/api/chat/stream"'),
    'worker.js must protect /ws/api/chat/stream'
  );
  assert.ok(
    workerCode.includes('Unauthorized: Verified Clerk session required for WebSocket stream'),
    'worker.js and ChatRoom DO must reject unauthenticated WebSocket upgrades with 401'
  );

  // 3. Cloudflare Environment Bindings: no direct process.env in auth.ts or functions/api/[[route]].ts
  assert.equal(
    authCode.includes('process.env.'),
    false,
    'src/utils/auth.ts must use Cloudflare env bindings instead of direct process.env.* access'
  );
  assert.equal(
    edgeRouteCode.includes('process.env'),
    false,
    'functions/api/[[route]].ts must use Cloudflare env bindings instead of process.env'
  );
  assert.equal(
    getAuthorizedAdminEmail({ ADMIN_EMAIL: 'cf-admin@anidub.in' }),
    'cf-admin@anidub.in'
  );
  assert.equal(
    isAuthorizedClerkAdmin({ email: 'cf-admin@anidub.in' }, { ADMIN_EMAIL: 'cf-admin@anidub.in' }),
    true
  );

  // 4. Feedback API Protection: input validation, spam prevention & rate limiting
  const { validateAndRateLimitFeedback } = await import('./auth');
  const testStore = new Map();

  // Rejects too-short message
  const shortRes = validateAndRateLimitFeedback({ name: 'Test', feedback: 'hi' }, '10.0.0.1', { store: testStore });
  assert.equal(shortRes.ok, false);
  assert.equal(shortRes.status, 400);

  // Rejects honeypot bot spam
  const honeypotRes = validateAndRateLimitFeedback(
    { name: 'Bot', feedback: 'Valid length feedback message', website: 'http://spam.com' },
    '10.0.0.1',
    { store: testStore }
  );
  assert.equal(honeypotRes.ok, false);
  assert.equal(honeypotRes.status, 400);

  // Rejects link spam (> 2 URLs)
  const linkSpamRes = validateAndRateLimitFeedback(
    { name: 'Spammer', feedback: 'Check https://a.com and https://b.com and https://c.com now!' },
    '10.0.0.1',
    { store: testStore }
  );
  assert.equal(linkSpamRes.ok, false);
  assert.equal(linkSpamRes.status, 400);

  // Rejects invalid email format
  const badEmailRes = validateAndRateLimitFeedback(
    { name: 'User', email: 'not-an-email', feedback: 'Please add Naruto Tamil dub episodes!' },
    '10.0.0.1',
    { store: testStore }
  );
  assert.equal(badEmailRes.ok, false);
  assert.equal(badEmailRes.status, 400);

  // Accepts 3 valid distinct submissions from same IP, then rate-limits 4th with 429
  for (let i = 1; i <= 3; i++) {
    const okRes = validateAndRateLimitFeedback(
      { name: 'AnimeFan', email: 'fan@example.com', feedback: `Great Tamil dub quality on episode ${i}!` },
      '10.0.0.2',
      { store: testStore }
    );
    assert.equal(okRes.ok, true);
  }
  const rateLimitedRes = validateAndRateLimitFeedback(
    { name: 'AnimeFan', email: 'fan@example.com', feedback: 'Fourth message within window should be rate limited!' },
    '10.0.0.2',
    { store: testStore }
  );
  assert.equal(rateLimitedRes.ok, false);
  assert.equal(rateLimitedRes.status, 429);
});


