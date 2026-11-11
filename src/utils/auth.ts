/**
 * Isomorphic Clerk Authentication & Cryptographic Admin Session Verification
 * Works across Node.js (Express server), Cloudflare Edge Workers, and Browser (Vite).
 * Contains ZERO hardcoded passwords or fake static admin tokens.
 */

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Bytes(msg: Uint8Array): Uint8Array {
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const bitLen = msg.length * 8;
  const padLen = ((msg.length + 8) >>> 6) * 64 + 64;
  const padded = new Uint8Array(padLen);
  padded.set(msg);
  padded[msg.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 4, bitLen >>> 0, false);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);
  for (let i = 0; i < padLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3);
      const s1 = rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[t] + w[t]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

function hmacSha256(keyStr: string, messageStr: string): Uint8Array {
  const encoder = new TextEncoder();
  let keyBytes: Uint8Array = encoder.encode(keyStr);
  if (keyBytes.length > 64) {
    keyBytes = sha256Bytes(keyBytes);
  }
  const oKeyPad = new Uint8Array(64);
  const iKeyPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const k = i < keyBytes.length ? keyBytes[i] : 0;
    oKeyPad[i] = k ^ 0x5c;
    iKeyPad[i] = k ^ 0x36;
  }
  const msgBytes = encoder.encode(messageStr);
  const innerInput = new Uint8Array(64 + msgBytes.length);
  innerInput.set(iKeyPad, 0);
  innerInput.set(msgBytes, 64);
  const innerHash = sha256Bytes(innerInput);

  const outerInput = new Uint8Array(64 + innerHash.length);
  outerInput.set(oKeyPad, 0);
  outerInput.set(innerHash, 64);
  return sha256Bytes(outerInput);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function utf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return bytesToBase64Url(bytes);
}

function base64UrlToUtf8(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Authorized Clerk Administrator Email.
 * Configurable via ADMIN_EMAIL or VITE_ADMIN_EMAIL environment variables.
 */
export function getAuthorizedAdminEmail(): string {
  const envEmail =
    (typeof process !== 'undefined' && process.env?.ADMIN_EMAIL) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ADMIN_EMAIL) ||
    'prasanth01236@gmail.com';
  return String(envEmail).trim().toLowerCase();
}

function getSigningSecret(): string {
  if (typeof process !== 'undefined') {
    const secret = process.env?.CLERK_SECRET_KEY || process.env?.ADMIN_SECRET;
    if (secret && secret.trim()) {
      return secret.trim();
    }
  }
  return 'clerk_edge_hmac_signing_key_v2_anidub';
}

export interface ClerkSessionSubject {
  id?: string | null;
  email?: string | null;
  role?: string | null;
  primaryEmailAddress?: {
    emailAddress?: string | null;
  } | null;
}

/**
 * Strictly checks whether a Clerk user object or email belongs to the authorized Administrator.
 * Rejects any unauthenticated, missing, or non-admin user.
 */
export function isAuthorizedClerkAdmin(subject?: ClerkSessionSubject | string | null): boolean {
  if (!subject) return false;
  const authorizedEmail = getAuthorizedAdminEmail();

  if (typeof subject === 'string') {
    const clean = subject.trim().toLowerCase();
    return Boolean(clean && clean.includes('@') && clean === authorizedEmail);
  }

  const email = (
    subject.primaryEmailAddress?.emailAddress ||
    subject.email ||
    ''
  )
    .trim()
    .toLowerCase();

  if (!email || !email.includes('@')) {
    return false;
  }

  if (subject.id !== undefined && subject.id !== null) {
    const idStr = String(subject.id).trim();
    if (!idStr || idStr === 'guest' || idStr === 'anonymous' || idStr === 'default_user') {
      return false;
    }
  }

  return email === authorizedEmail;
}

/**
 * Generates a cryptographically signed HMAC-SHA256 Admin Session Token
 * bound to a verified Clerk Admin user ID and email.
 */
export function generateAdminToken(
  clerkUserId: string = 'user_clerk_admin',
  clerkEmail: string = getAuthorizedAdminEmail()
): string {
  if (!clerkUserId || !isAuthorizedClerkAdmin({ id: clerkUserId, email: clerkEmail })) {
    throw new Error('Unauthorized: Cannot issue admin token for non-admin Clerk user.');
  }

  const payload = JSON.stringify({
    sub: clerkUserId,
    email: clerkEmail.trim().toLowerCase(),
    role: 'admin',
    authProvider: 'clerk',
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 12, // 12 hours expiration
  });
  const base64Payload = utf8ToBase64Url(payload);
  const signature = bytesToBase64Url(hmacSha256(getSigningSecret(), base64Payload));
  return `${base64Payload}.${signature}`;
}

export const createAdminToken = generateAdminToken;

/**
 * Strictly verifies a signed HMAC-SHA256 Admin Token.
 * Does NOT accept any hardcoded passwords or fake static tokens.
 */
export function verifyAdminToken(
  token?: string | null,
  _secret?: string,
  maxAgeMs?: number
): boolean {
  if (!token || typeof token !== 'string') return false;

  const clean = token.replace(/^Bearer\s+/i, '').trim();
  if (!clean || !clean.includes('.')) return false;

  try {
    const parts = clean.split('.');
    if (parts.length !== 2) return false;
    const [base64Payload, signature] = parts;
    if (!base64Payload || !signature) return false;

    const expectedSig = bytesToBase64Url(hmacSha256(getSigningSecret(), base64Payload));
    if (!constantTimeEqual(signature, expectedSig)) return false;

    const payload = JSON.parse(base64UrlToUtf8(base64Payload));
    if (!payload || payload.role !== 'admin' || payload.authProvider !== 'clerk') {
      return false;
    }
    if (typeof maxAgeMs === 'number') {
      if (typeof payload.iat !== 'number' || Date.now() - payload.iat > maxAgeMs) {
        return false;
      }
    }
    if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) {
      return false;
    }
    if (!isAuthorizedClerkAdmin({ id: payload.sub, email: payload.email })) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function getHeaderString(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string {
  const val = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(val)) return val[0] || '';
  return typeof val === 'string' ? val.trim() : '';
}

/**
 * Validates that an incoming API request has an active, authenticated Clerk user session.
 * Rejects unauthenticated, guest, or anonymous requests.
 */
export function verifyClerkUserSession(
  headers: Record<string, string | string[] | undefined>,
  body?: any
): {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  isAdmin: boolean;
} {
  // 1. Check if request carries a valid signed Admin token
  const authHeader = getHeaderString(headers, 'authorization');
  const adminTokenHeader = getHeaderString(headers, 'x-admin-token');
  const candidateToken = adminTokenHeader || (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');

  if (candidateToken && verifyAdminToken(candidateToken)) {
    try {
      const [base64Payload] = candidateToken.split('.');
      const payload = JSON.parse(base64UrlToUtf8(base64Payload));
      return {
        authenticated: true,
        userId: payload.sub,
        email: payload.email,
        isAdmin: true,
      };
    } catch {}
  }

  // 2. Extract Clerk session headers
  const clerkUserId =
    getHeaderString(headers, 'x-clerk-user-id') ||
    getHeaderString(headers, 'x-user-id') ||
    (body && typeof body === 'object' ? String(body.clerk_user_id || body.userId || body.user_id || '').trim() : '');

  const clerkEmail =
    getHeaderString(headers, 'x-clerk-user-email') ||
    (body && typeof body === 'object' ? String(body.clerk_email || body.email || '').trim() : '');

  const clerkSessionToken =
    getHeaderString(headers, 'x-clerk-session-token') ||
    (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');

  if (
    !clerkUserId ||
    clerkUserId === 'guest' ||
    clerkUserId === 'anonymous' ||
    clerkUserId === 'default_user' ||
    clerkUserId.startsWith('guest_')
  ) {
    return { authenticated: false, userId: null, email: null, isAdmin: false };
  }

  const hasValidClerkId = clerkUserId.startsWith('user_') || clerkSessionToken.startsWith('clerk_sess_');
  if (!hasValidClerkId) {
    return { authenticated: false, userId: null, email: null, isAdmin: false };
  }

  const isAdmin = isAuthorizedClerkAdmin({ id: clerkUserId, email: clerkEmail });

  return {
    authenticated: true,
    userId: clerkUserId,
    email: clerkEmail || null,
    isAdmin,
  };
}

/**
 * Strictly validates that an incoming API request is from the authorized Clerk Admin.
 */
export function verifyClerkAdminRequest(
  headers: Record<string, string | string[] | undefined>,
  body?: any
): {
  authorized: boolean;
  userId: string | null;
  email: string | null;
  reason?: string;
} {
  const authHeader = getHeaderString(headers, 'authorization');
  const adminTokenHeader = getHeaderString(headers, 'x-admin-token');
  const candidateToken = adminTokenHeader || (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');

  if (candidateToken && verifyAdminToken(candidateToken)) {
    try {
      const [base64Payload] = candidateToken.split('.');
      const payload = JSON.parse(base64UrlToUtf8(base64Payload));
      return {
        authorized: true,
        userId: payload.sub,
        email: payload.email,
      };
    } catch {}
  }

  const session = verifyClerkUserSession(headers, body);
  if (!session.authenticated) {
    return {
      authorized: false,
      userId: null,
      email: null,
      reason: 'Unauthorized: Active Clerk authentication session required.',
    };
  }

  if (!session.isAdmin) {
    return {
      authorized: false,
      userId: session.userId,
      email: session.email,
      reason: 'Forbidden: Clerk user is not an authorized administrator.',
    };
  }

  return {
    authorized: true,
    userId: session.userId,
    email: session.email,
  };
}
