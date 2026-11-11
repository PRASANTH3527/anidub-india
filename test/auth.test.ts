import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAuthorizedClerkAdmin,
  getAuthorizedAdminEmail,
  extractClerkJwtFromRequest,
  getAuth,
} from '../src/utils/auth.js';

test('isAuthorizedClerkAdmin strictly validates against process.env.ADMIN_EMAIL with no fallback', () => {
  const prev = process.env.ADMIN_EMAIL;
  try {
    delete process.env.ADMIN_EMAIL;
    assert.equal(getAuthorizedAdminEmail(), '');
    assert.equal(isAuthorizedClerkAdmin('any@example.com'), false);

    process.env.ADMIN_EMAIL = 'admin@anidub.in';
    assert.equal(getAuthorizedAdminEmail(), 'admin@anidub.in');
    assert.equal(isAuthorizedClerkAdmin('admin@anidub.in'), true);
    assert.equal(isAuthorizedClerkAdmin('fan@anidub.in'), false);
    assert.equal(isAuthorizedClerkAdmin(''), false);
    assert.equal(isAuthorizedClerkAdmin(undefined), false);
  } finally {
    if (prev === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = prev;
  }
});

test('extractClerkJwtFromRequest extracts only well-formed 3-part JWTs from Authorization Bearer or __session cookie', () => {
  assert.equal(extractClerkJwtFromRequest({ headers: {} }), null);
  assert.equal(extractClerkJwtFromRequest({ headers: { authorization: 'Bearer not-a-jwt' } }), null);
  assert.equal(extractClerkJwtFromRequest({ headers: { authorization: 'Bearer a.b.c' } }), 'a.b.c');
  assert.equal(extractClerkJwtFromRequest({ headers: { cookie: 'foo=bar; __session=header.payload.sig; theme=dark' } }), 'header.payload.sig');
});

test('getAuth rejects forged or unsigned tokens and ignores spoofed client body/headers', async () => {
  const forgedJwt = [
    Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: 'user_123', email: 'admin@anidub.in' })).toString('base64url'),
    'forged_signature',
  ].join('.');

  const result = await getAuth({
    headers: {
      authorization: `Bearer ${forgedJwt}`,
      'x-clerk-user-id': 'user_123',
      'x-clerk-user-email': 'admin@anidub.in',
    },
    body: {
      userId: 'user_123',
      email: 'admin@anidub.in',
    },
  });

  assert.equal(result.authenticated, false);
  assert.equal(result.userId, null);
  assert.equal(result.isAdmin, false);
});
