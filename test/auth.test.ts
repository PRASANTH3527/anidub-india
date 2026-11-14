import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  isAuthorizedClerkAdmin,
  getAuthorizedAdminEmail,
  extractClerkJwtFromRequest,
  getAuth,
} from '../src/utils/auth.js';
import { onRequest } from '../functions/api/[[route]].ts';

function signClerkTestJwt(claims: Record<string, any>, privateKeyPem: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', cat: 'cl_B7d4PD111AAA' })
  ).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user_clerk_test_1',
      sid: 'sess_test_1',
      iat: nowSec - 10,
      nbf: nowSec - 10,
      exp: nowSec + 300,
      ...claims,
    })
  ).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKeyPem).toString('base64url');
  return `${unsigned}.${sig}`;
}

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

test('getAuth and /api/admin/verify enforce Clerk authorizedParties (azp) and verified primary email (email_verified === true)', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const env = {
    ADMIN_EMAIL: 'admin@anidub.in',
    CLERK_JWT_KEY: publicKey,
    DB: null as any,
  };

  // 1. Token from another app (unapproved azp) MUST be rejected
  const foreignAppJwt = signClerkTestJwt(
    {
      email: 'admin@anidub.in',
      email_verified: true,
      azp: 'https://unrelated-clerk-app.com',
    },
    privateKey
  );
  const foreignAuth = await getAuth(
    new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${foreignAppJwt}` },
    }),
    env
  );
  assert.equal(foreignAuth.authenticated, false);
  assert.equal(foreignAuth.isAdmin, false);

  const foreignRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${foreignAppJwt}` },
    }),
    env,
  });
  assert.equal(foreignRes.status, 401);

  // 2. Token missing azp MUST be rejected
  const missingAzpJwt = signClerkTestJwt(
    {
      email: 'admin@anidub.in',
      email_verified: true,
    },
    privateKey
  );
  const missingAzpAuth = await getAuth(
    new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${missingAzpJwt}` },
    }),
    env
  );
  assert.equal(missingAzpAuth.authenticated, false);
  assert.equal(missingAzpAuth.isAdmin, false);

  // 3. Token with approved azp + matching admin email BUT email_verified: false MUST be denied admin access
  const unverifiedFalseJwt = signClerkTestJwt(
    {
      email: 'admin@anidub.in',
      email_verified: false,
      azp: 'https://anidub.in',
    },
    privateKey
  );
  const unverifiedFalseAuth = await getAuth(
    new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${unverifiedFalseJwt}` },
    }),
    env
  );
  assert.equal(unverifiedFalseAuth.authenticated, true);
  assert.equal(unverifiedFalseAuth.isAdmin, false);
  assert.match(unverifiedFalseAuth.error || '', /not verified/i);

  const unverifiedFalseRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${unverifiedFalseJwt}` },
    }),
    env,
  });
  assert.equal(unverifiedFalseRes.status, 401);

  // 4. Token with approved azp + matching admin email + omitted email_verified MUST be denied admin access
  const omittedVerifiedJwt = signClerkTestJwt(
    {
      email: 'admin@anidub.in',
      azp: 'https://anidub.in',
    },
    privateKey
  );
  const omittedVerifiedAuth = await getAuth(
    new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${omittedVerifiedJwt}` },
    }),
    env
  );
  assert.equal(omittedVerifiedAuth.authenticated, true);
  assert.equal(omittedVerifiedAuth.isAdmin, false);

  // 5. Token with approved azp + matching admin email + email_verified: true MUST succeed (200 OK)
  const validAdminJwt = signClerkTestJwt(
    {
      email: 'ADMIN@anidub.in',
      email_verified: true,
      azp: 'https://anidub.in',
    },
    privateKey
  );
  const validRes = await onRequest({
    request: new Request('https://anidub.in/api/admin/verify', {
      headers: { Authorization: `Bearer ${validAdminJwt}` },
    }),
    env,
  });
  assert.equal(validRes.status, 200);
  const validJson: any = await validRes.json();
  assert.equal(validJson.ok, true);
  assert.equal(validJson.isAdmin, true);
});
