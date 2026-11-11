import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isAuthorizedClerkAdmin,
  generateAdminToken,
  verifyAdminToken,
  verifyClerkUserSession,
  verifyClerkAdminRequest,
  getAuthorizedAdminEmail,
} from './auth';

test('Security Audit 1: Hardcoded admin passwords and fake tokens are rejected', () => {
  // Fake static tokens must never be accepted
  assert.equal(verifyAdminToken('local_admin_session'), false);
  assert.equal(verifyAdminToken('admin_secret'), false);
  assert.equal(verifyAdminToken('cf_admin_12345'), false);
  assert.equal(verifyAdminToken('admin_token_xyz'), false);
  assert.equal(verifyAdminToken('prasanth123'), false);
  assert.equal(verifyAdminToken('admin123'), false);
  assert.equal(verifyAdminToken(''), false);
  assert.equal(verifyAdminToken(null), false);
});

test('Security Audit 2: Strict Clerk Admin authentication & HMAC-SHA256 token signing', () => {
  const adminEmail = getAuthorizedAdminEmail();

  // Non-admin and guest users are rejected
  assert.equal(isAuthorizedClerkAdmin(null), false);
  assert.equal(isAuthorizedClerkAdmin('fan@anidub.in'), false);
  assert.equal(
    isAuthorizedClerkAdmin({
      id: 'user_regular123',
      primaryEmailAddress: { emailAddress: 'fan@anidub.in' },
    }),
    false
  );
  assert.equal(
    isAuthorizedClerkAdmin({
      id: 'guest',
      primaryEmailAddress: { emailAddress: adminEmail },
    }),
    false
  );

  // Authorized Clerk Admin user is accepted
  assert.equal(
    isAuthorizedClerkAdmin({
      id: 'user_admin_clerk_1',
      primaryEmailAddress: { emailAddress: adminEmail },
    }),
    true
  );

  // Generating a token for a non-admin user throws
  assert.throws(() => {
    generateAdminToken('user_regular123', 'fan@anidub.in');
  }, /Unauthorized/);

  // Generating a token for the authorized Clerk Admin succeeds and verifies
  const validToken = generateAdminToken('user_admin_clerk_1', adminEmail);
  assert.equal(verifyAdminToken(validToken), true);
  assert.equal(verifyAdminToken(`Bearer ${validToken}`), true);

  // Tampering with the token invalidates the HMAC signature
  const [payloadPart, sigPart] = validToken.split('.');
  assert.equal(verifyAdminToken(`${payloadPart}.${sigPart}tampered`), false);
});

test('Security Audit 3: ImgBB API key is not exposed in client or server source code', () => {
  const filesToScan = [
    'src/utils/imgbb.ts',
    'src/utils/auth.ts',
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
      content.includes('local_admin_session'),
      false,
      `Fake admin token found in ${relPath}`
    );
  }

  const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
  assert.equal(
    serverCode.includes('process.env.IMGBB_API_KEY'),
    true,
    'server.ts must read IMGBB_API_KEY from process.env.IMGBB_API_KEY'
  );
});

test('Security Audit 4: API routes enforce user session and admin authentication checks', () => {
  // Unauthenticated / anonymous request is rejected
  const anonSession = verifyClerkUserSession({}, {});
  assert.equal(anonSession.authenticated, false);

  const guestSession = verifyClerkUserSession({ 'x-user-id': 'guest_123' }, {});
  assert.equal(guestSession.authenticated, false);

  // Valid Clerk user session is accepted for user routes, but not admin routes
  const userHeaders = {
    'x-clerk-user-id': 'user_2abc987',
    'x-clerk-user-email': 'viewer@anidub.in',
    'x-clerk-session-token': 'clerk_sess_user_2abc987_1700000000',
  };
  const userSession = verifyClerkUserSession(userHeaders);
  assert.equal(userSession.authenticated, true);
  assert.equal(userSession.userId, 'user_2abc987');
  assert.equal(userSession.isAdmin, false);

  const nonAdminCheck = verifyClerkAdminRequest(userHeaders);
  assert.equal(nonAdminCheck.authorized, false);

  // Authorized Clerk Admin session is accepted for admin routes
  const adminHeaders = {
    'x-clerk-user-id': 'user_admin_01',
    'x-clerk-user-email': getAuthorizedAdminEmail(),
    'x-clerk-session-token': 'clerk_sess_user_admin_01_1700000000',
  };
  const adminCheck = verifyClerkAdminRequest(adminHeaders);
  assert.equal(adminCheck.authorized, true);

  // Verify server.ts protects data-modifying routes with requireUserAuth or requireAdminAuth
  const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
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
