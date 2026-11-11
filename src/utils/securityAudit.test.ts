import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { getAuthorizedAdminEmail, isAuthorizedClerkAdmin, extractClerkJwtFromRequest, getAuth } from './auth';

test('Security Audit 1: Mock auth removed & official @clerk/nextjs used without sessionStorage or hardcoded keys', () => {
  const clerkLibPath = path.join(process.cwd(), 'src/lib/clerk.tsx');
  const clerkLibContent = fs.readFileSync(clerkLibPath, 'utf-8');

  assert.equal(
    clerkLibContent.includes('sessionStorage'),
    false,
    'src/lib/clerk.tsx must not use sessionStorage for auth tokens'
  );
  assert.equal(
    clerkLibContent.includes('mock'),
    false,
    'src/lib/clerk.tsx must not contain mock auth implementations'
  );
  assert.ok(
    clerkLibContent.includes('@clerk/nextjs') || clerkLibContent.includes('@clerk/clerk-react'),
    'src/lib/clerk.tsx must integrate with official Clerk packages'
  );
});

test('Security Audit 2: Strict ADMIN_EMAIL validation with zero hardcoded fallbacks', () => {
  const originalAdminEmail = process.env.ADMIN_EMAIL;
  try {
    delete process.env.ADMIN_EMAIL;
    assert.equal(getAuthorizedAdminEmail(), '');

    assert.equal(isAuthorizedClerkAdmin(null), false);
    assert.equal(isAuthorizedClerkAdmin('viewer@anidub.in'), false);
    assert.equal(
      isAuthorizedClerkAdmin({
        id: 'user_regular123',
        primaryEmailAddress: { emailAddress: 'viewer@anidub.in' },
      }),
      false
    );

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
    'functions/api/[[route]].ts',
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

  const edgeRouteCode = fs.readFileSync(path.join(process.cwd(), 'functions/api/[[route]].ts'), 'utf-8');
  assert.ok(edgeRouteCode.includes('env.IMGBB_API_KEY'));
  assert.ok(edgeRouteCode.includes('await getAuth(request, env)'));
  assert.ok(edgeRouteCode.includes("path === '/api/upload'"));
  assert.ok(edgeRouteCode.includes("path === '/api/anime'"));
});

test('Security Audit 5: D1 Database Security (No raw client SQL) & User Actions extract userId strictly from session', () => {
  const edgeRouteCode = fs.readFileSync(path.join(process.cwd(), 'functions/api/[[route]].ts'), 'utf-8');
  const apiClientCode = fs.readFileSync(path.join(process.cwd(), 'src/services/cloudflareApi.ts'), 'utf-8');

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
    edgeRouteCode.includes('if (body.sql !== undefined)'),
    'functions/api/[[route]].ts D1 query endpoint must explicitly reject raw sql payloads'
  );
  assert.ok(edgeRouteCode.includes("getAuth(request, env)"));

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

test('Security Audit 6: Cloudflare Pages Functions, env bindings & Feedback Protection', async () => {
  const authCode = fs.readFileSync(path.join(process.cwd(), 'src/utils/auth.ts'), 'utf-8');
  const edgeRouteCode = fs.readFileSync(path.join(process.cwd(), 'functions/api/[[route]].ts'), 'utf-8');

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

  const { validateAndRateLimitFeedback } = await import('./auth');
  const testStore = new Map();

  const shortRes = validateAndRateLimitFeedback({ name: 'Test', feedback: 'hi' }, '10.0.0.1', { store: testStore });
  assert.equal(shortRes.ok, false);
  assert.equal(shortRes.status, 400);

  const honeypotRes = validateAndRateLimitFeedback(
    { name: 'Bot', feedback: 'Valid length feedback message', website: 'http://spam.com' },
    '10.0.0.1',
    { store: testStore }
  );
  assert.equal(honeypotRes.ok, false);
  assert.equal(honeypotRes.status, 400);

  const linkSpamRes = validateAndRateLimitFeedback(
    { name: 'Spammer', feedback: 'Check https://a.com and https://b.com and https://c.com now!' },
    '10.0.0.1',
    { store: testStore }
  );
  assert.equal(linkSpamRes.ok, false);
  assert.equal(linkSpamRes.status, 400);

  const badEmailRes = validateAndRateLimitFeedback(
    { name: 'User', email: 'not-an-email', feedback: 'Please add Naruto Tamil dub episodes!' },
    '10.0.0.1',
    { store: testStore }
  );
  assert.equal(badEmailRes.ok, false);
  assert.equal(badEmailRes.status, 400);

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
