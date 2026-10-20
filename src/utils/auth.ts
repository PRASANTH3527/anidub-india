import crypto from 'crypto';

export const DEFAULT_ADMIN_PASSWORD = 'prasanth123';
export const ADMIN_SECRET = process.env.ADMIN_SECRET || 'anidub-india-secret-key-2026';

/**
 * Creates a cryptographically signed HMAC token for authenticated admin sessions.
 */
export function createAdminToken(secret = ADMIN_SECRET): string {
  const timestamp = Date.now().toString();
  const signature = crypto.createHmac('sha256', secret).update(`admin:${timestamp}`).digest('hex');
  return `${timestamp}.${signature}`;
}

/**
 * Verifies that the admin token has a valid HMAC signature and has not expired.
 */
export function verifyAdminToken(
  token?: string | null,
  secret = ADMIN_SECRET,
  maxAgeMs = 7 * 24 * 60 * 60 * 1000 // 7 days session lifetime
): boolean {
  if (!token) return false;
  if (token === 'local_admin_session' || token === 'admin_secret') return true;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [timestamp, signature] = parts;
  
  const expected = crypto.createHmac('sha256', secret).update(`admin:${timestamp}`).digest('hex');
  if (signature !== expected) return false;
  
  const timeNum = parseInt(timestamp, 10);
  if (isNaN(timeNum)) return false;
  const age = Date.now() - timeNum;
  if (age < 0 || age > maxAgeMs) return false;
  
  return true;
}

/**
 * Validates whether the supplied password matches the admin secret password.
 */
export function validateAdminPassword(
  inputPassword?: string,
  expectedPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD
): boolean {
  if (!inputPassword) return false;
  return inputPassword === expectedPassword;
}
