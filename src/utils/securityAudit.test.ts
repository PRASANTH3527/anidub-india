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
  assert.ok(serverCode.includes("app.post('/api/anime', requireUserAuth"));
  assert.ok(serverCode.includes("app.post(['/api/rate', '/api/anime/:id/rate'], requireUserAuth"));
  assert.ok(serverCode.includes("app.post('/api/anime/:id/reviews', requireUserAuth"));
  assert.ok(serverCode.includes("app.put('/api/user/profile', requireUserAuth"));
  assert.ok(serverCode.includes("app.post(['/api/chat', '/api/chat/messages'], requireUserAuth"));
  assert.ok(serverCode.includes("app.post('/api/watchlist', requireUserAuth"));
  assert.ok(serverCode.includes("app.post('/api/report', requireUserAuth"));
  assert.ok(serverCode.includes("app.get('/api/analytics/dashboard', requireAdminAuth"));
});
