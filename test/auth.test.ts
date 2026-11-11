import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdminToken,
  verifyAdminToken,
  isAuthorizedClerkAdmin,
  getAuthorizedAdminEmail,
} from '../src/utils/auth.js';

test('isAuthorizedClerkAdmin checks Clerk administrator identity strictly', () => {
  assert.equal(isAuthorizedClerkAdmin(getAuthorizedAdminEmail()), true);
  assert.equal(isAuthorizedClerkAdmin('fan@anidub.in'), false);
  assert.equal(isAuthorizedClerkAdmin(''), false);
  assert.equal(isAuthorizedClerkAdmin(undefined), false);
});

test('createAdminToken creates a valid verifiable HMAC-SHA256 token', () => {
  const token = createAdminToken('user_clerk_admin', getAuthorizedAdminEmail());
  assert.ok(token);
  assert.equal(typeof token, 'string');
  assert.equal(verifyAdminToken(token), true);
});

test('verifyAdminToken rejects forged, fake, or tampered tokens', () => {
  const token = createAdminToken('user_clerk_admin', getAuthorizedAdminEmail());
  const [payload, signature] = token.split('.');
  const forgedToken = `${payload}.tampered${signature.slice(8)}`;

  assert.equal(verifyAdminToken(forgedToken), false);
  assert.equal(verifyAdminToken('invalid-token-format'), false);
  assert.equal(verifyAdminToken(''), false);
  assert.equal(verifyAdminToken(null), false);
  assert.equal(verifyAdminToken(undefined), false);
});

test('verifyAdminToken rejects expired tokens', () => {
  const token = createAdminToken('user_clerk_admin', getAuthorizedAdminEmail());
  assert.equal(verifyAdminToken(token, undefined, -100), false);
});
