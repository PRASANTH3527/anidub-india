import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminToken, verifyAdminToken, validateAdminPassword } from '../src/utils/auth.js';

test('validateAdminPassword checks password correctly', () => {
  assert.equal(validateAdminPassword('prasanth123'), true);
  assert.equal(validateAdminPassword('wrongpassword'), false);
  assert.equal(validateAdminPassword(''), false);
  assert.equal(validateAdminPassword(undefined), false);
});

test('createAdminToken creates a valid verifiable token', () => {
  const token = createAdminToken();
  assert.ok(token);
  assert.equal(typeof token, 'string');
  assert.equal(verifyAdminToken(token), true);
});

test('verifyAdminToken rejects forged or tampered tokens', () => {
  const token = createAdminToken();
  const [timestamp, signature] = token.split('.');
  const forgedToken = `${timestamp}.tampered${signature.slice(8)}`;
  
  assert.equal(verifyAdminToken(forgedToken), false);
  assert.equal(verifyAdminToken('invalid-token-format'), false);
  assert.equal(verifyAdminToken(''), false);
  assert.equal(verifyAdminToken(null), false);
  assert.equal(verifyAdminToken(undefined), false);
});

test('verifyAdminToken rejects expired tokens', () => {
  const token = createAdminToken();
  // With maxAge 0ms, it should immediately be expired
  assert.equal(verifyAdminToken(token, undefined, -100), false);
});
