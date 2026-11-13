import { createClerkClient, verifyToken } from '@clerk/backend';

/**
 * Strict Clerk Authentication & Admin Authorization Utilities
 *
 * Security guarantees:
 * - No hardcoded fallback admin emails, passwords, or signing secrets.
 * - Uses Cloudflare environment bindings (`env`) passed from request context,
 *   with safe fallback to global runtime env when running in Node.js dev server.
 * - Never trusts client-supplied userId, email, or x-admin-email headers.
 * - Verifies Clerk session JWTs cryptographically using `@clerk/backend`.
 */

export interface EnvBindings {
  ADMIN_EMAIL?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_JWT_KEY?: string;
  IMGBB_API_KEY?: string;
  [key: string]: any;
}

/**
 * Safely reads an environment variable from Cloudflare `env` bindings first,
 * falling back to Node's runtime environment only when available.
 */
export function getEnvBinding(key: string, env?: EnvBindings | null): string | undefined {
  if (env && typeof env === 'object' && env[key] !== undefined && env[key] !== null) {
    const val = String(env[key]).trim();
    if (val !== '') return val;
  }
  const globalCloudflareEnv = (globalThis as any)?.__CLOUDFLARE_ENV__;
  if (globalCloudflareEnv && globalCloudflareEnv[key]) {
    const val = String(globalCloudflareEnv[key]).trim();
    if (val !== '') return val;
  }
  const nodeEnv = (globalThis as any)?.process?.env;
  if (nodeEnv && typeof nodeEnv[key] === 'string') {
    const val = nodeEnv[key].trim();
    if (val !== '') return val;
  }
  return undefined;
}

/**
 * Returns the configured ADMIN_EMAIL from Cloudflare `env` bindings (or client VITE_/NEXT_PUBLIC_ in browser).
 * Returns '' if not configured (fails closed).
 */
export function getAuthorizedAdminEmail(env?: EnvBindings | null): string {
  const serverEnvEmail = getEnvBinding('ADMIN_EMAIL', env);

  let clientEnvEmail: string | undefined;
  try {
    clientEnvEmail =
      (import.meta as any).env?.VITE_ADMIN_EMAIL ||
      (import.meta as any).env?.NEXT_PUBLIC_ADMIN_EMAIL ||
      (import.meta as any).env?.ADMIN_EMAIL;
  } catch {
    // import.meta.env may not exist in all runtimes
  }

  return (serverEnvEmail || clientEnvEmail || '').trim().toLowerCase();
}

/**
 * Validates whether a Clerk user object or verified email string belongs to the authorized Admin.
 * Strictly requires ADMIN_EMAIL to be configured in `env` bindings.
 */
export function isAuthorizedClerkAdmin(subject?: any, env?: EnvBindings | null): boolean {
  const authorizedEmail = getAuthorizedAdminEmail(env);
  if (!authorizedEmail || !subject) return false;

  if (typeof subject === 'string') {
    return subject.trim().toLowerCase() === authorizedEmail;
  }

  if (subject.id === 'guest') return false;

  const candidateEmails: string[] = [];

  if (typeof subject.primaryEmailAddress?.emailAddress === 'string') {
    candidateEmails.push(subject.primaryEmailAddress.emailAddress);
  }
  if (typeof subject.email === 'string') {
    candidateEmails.push(subject.email);
  }
  if (typeof subject.emailAddress === 'string') {
    candidateEmails.push(subject.emailAddress);
  }
  if (Array.isArray(subject.emailAddresses)) {
    for (const entry of subject.emailAddresses) {
      if (typeof entry?.emailAddress === 'string') {
        candidateEmails.push(entry.emailAddress);
      } else if (typeof entry?.email === 'string') {
        candidateEmails.push(entry.email);
      }
    }
  }

  return candidateEmails.some(
    (email) => email.trim().toLowerCase() === authorizedEmail
  );
}

/**
 * Extracts a well-formed 3-part bearer JWT, `__session` cookie, or `?token=` WebSocket query token
 * from a standard Fetch Request or Express Request.
 */
export function extractClerkJwtFromRequest(req: any): string | null {
  if (!req) return null;

  // 1. Check Authorization header: "Bearer <jwt>"
  let authHeader: string | null = null;
  if (typeof req.headers?.get === 'function') {
    authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  } else if (req.headers && typeof req.headers === 'object') {
    const raw = req.headers['authorization'] || req.headers['Authorization'];
    authHeader = Array.isArray(raw) ? raw[0] : raw || null;
  }

  if (authHeader && typeof authHeader === 'string') {
    const trimmed = authHeader.trim();
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      const token = trimmed.slice(7).trim();
      if (token && token.split('.').length === 3) return token;
    }
  }

  // 2. Check __session cookie
  let cookieHeader: string | null = null;
  if (typeof req.headers?.get === 'function') {
    cookieHeader = req.headers.get('cookie') || req.headers.get('Cookie');
  } else if (req.headers && typeof req.headers === 'object') {
    const raw = req.headers['cookie'] || req.headers['Cookie'];
    cookieHeader = Array.isArray(raw) ? raw.join('; ') : raw || null;
  }

  if (cookieHeader && typeof cookieHeader === 'string') {
    const cookies = cookieHeader.split(';');
    for (const part of cookies) {
      const [rawName, ...rest] = part.trim().split('=');
      if (rawName === '__session') {
        const value = decodeURIComponent(rest.join('=').trim());
        if (value && value.split('.').length === 3) return value;
      }
    }
  }

  // 3. Check ?token= query parameter (used for authenticated WebSocket upgrade requests)
  try {
    const rawUrl = req.url || req.originalUrl;
    if (rawUrl && typeof rawUrl === 'string') {
      const parsedUrl = new URL(rawUrl, 'http://localhost');
      const queryToken = parsedUrl.searchParams.get('token') || parsedUrl.searchParams.get('__session');
      if (queryToken && queryToken.trim() && queryToken.trim().split('.').length === 3) {
        return queryToken.trim();
      }
    }
  } catch {
    // Ignore malformed URLs
  }

  return null;
}

export interface VerifiedClerkSession {
  userId: string | null;
  sessionId: string | null;
  email: string | null;
  isAdmin: boolean;
  authenticated: boolean;
  isAuthenticated: boolean;
  claims: Record<string, any> | null;
}

const BASE_AUTHORIZED_PARTIES = [
  'http://localhost:3000',
  'https://ais-dev-qwvw5bws5eviuuugfdklbn-712933804987.asia-southeast1.run.app',
  'https://ais-pre-qwvw5bws5eviuuugfdklbn-712933804987.asia-southeast1.run.app',
  'https://anidub.in',
  'https://www.anidub.in',
  'https://anidub-india.pages.dev',
];

/**
 * Validates whether a given origin or URL belongs to an approved local dev, preview,
 * Cloudflare Pages/Workers deployment, or production AniDub domain.
 */
export function isApprovedOrigin(originOrUrl?: string | null, env?: EnvBindings | null): boolean {
  if (!originOrUrl || typeof originOrUrl !== 'string') return false;
  const trimmed = originOrUrl.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === 'anidub.in' ||
      hostname.endsWith('.anidub.in') ||
      hostname.endsWith('.pages.dev') ||
      hostname.endsWith('.workers.dev') ||
      hostname.endsWith('.run.app')
    ) {
      return true;
    }

    const extraOriginsRaw =
      getEnvBinding('ALLOWED_ORIGINS', env) ||
      getEnvBinding('CLERK_AUTHORIZED_PARTIES', env) ||
      '';
    if (extraOriginsRaw) {
      const extras = extraOriginsRaw
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      for (const extra of extras) {
        try {
          const extraParsed = new URL(extra.startsWith('http') ? extra : `https://${extra}`);
          if (extraParsed.origin.toLowerCase() === parsed.origin.toLowerCase()) return true;
        } catch {
          if (hostname === extra) return true;
        }
      }
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Builds the Clerk `authorizedParties` allowlist including approved Cloudflare Pages/Workers origins.
 */
export function buildAuthorizedParties(req?: any, env?: EnvBindings | null): string[] {
  const parties = new Set<string>(BASE_AUTHORIZED_PARTIES);

  const extraPartiesRaw =
    getEnvBinding('CLERK_AUTHORIZED_PARTIES', env) ||
    getEnvBinding('ALLOWED_ORIGINS', env) ||
    '';
  if (extraPartiesRaw) {
    for (const raw of extraPartiesRaw.split(',')) {
      const cleaned = raw.trim().replace(/\/+$/, '');
      if (cleaned) parties.add(cleaned);
    }
  }

  const candidateUrls: string[] = [];
  if (typeof req?.headers?.get === 'function') {
    const reqOrigin = req.headers.get('origin') || req.headers.get('Origin');
    if (reqOrigin) candidateUrls.push(reqOrigin);
  } else if (req?.headers && typeof req.headers === 'object') {
    const reqOrigin = req.headers['origin'] || req.headers['Origin'];
    if (typeof reqOrigin === 'string') candidateUrls.push(reqOrigin);
  }
  if (typeof req?.url === 'string' && req.url.startsWith('http')) {
    try {
      candidateUrls.push(new URL(req.url).origin);
    } catch {}
  }

  for (const candidate of candidateUrls) {
    if (isApprovedOrigin(candidate, env)) {
      try {
        parties.add(new URL(candidate).origin);
      } catch {}
    }
  }

  return Array.from(parties);
}

/**
 * Official backend Clerk `getAuth(req, env)` implementation.
 * Cryptographically verifies the Clerk session JWT using `@clerk/backend`'s `verifyToken`
 * with Cloudflare `env` bindings (`env.CLERK_SECRET_KEY` / `env.CLERK_JWT_KEY`).
 * Never trusts unverified client payloads, query params, or request body fields.
 */
export async function getAuth(req?: any, env?: EnvBindings | null): Promise<VerifiedClerkSession> {
  const emptySession: VerifiedClerkSession = {
    userId: null,
    sessionId: null,
    email: null,
    isAdmin: false,
    authenticated: false,
    isAuthenticated: false,
    claims: null,
  };

  const resolvedEnv: EnvBindings | undefined = env || (req as any)?.env || undefined;
  const token = extractClerkJwtFromRequest(req);
  if (!token) return emptySession;

  const secretKey = getEnvBinding('CLERK_SECRET_KEY', resolvedEnv);
  const jwtKey = getEnvBinding('CLERK_JWT_KEY', resolvedEnv);

  // Strict verification: require CLERK_SECRET_KEY or CLERK_JWT_KEY to verify cryptographic signature
  if (!secretKey && !jwtKey) {
    return emptySession;
  }

  try {
    const verifyOptions: Record<string, any> = {
      authorizedParties: buildAuthorizedParties(req, resolvedEnv),
    };
    if (secretKey) verifyOptions.secretKey = secretKey;
    if (jwtKey) verifyOptions.jwtKey = jwtKey;

    const verifiedPayload = await verifyToken(token, verifyOptions);
    if (!verifiedPayload || typeof verifiedPayload.sub !== 'string' || !verifiedPayload.sub.trim()) {
      return emptySession;
    }

    const userId = verifiedPayload.sub.trim();
    const sessionId = typeof verifiedPayload.sid === 'string' ? verifiedPayload.sid : null;

    // Extract email from verified token claims if present, or fetch from Clerk Backend API
    let email: string | null =
      (typeof (verifiedPayload as any).email === 'string' && (verifiedPayload as any).email) ||
      (typeof (verifiedPayload as any).email_address === 'string' && (verifiedPayload as any).email_address) ||
      (typeof (verifiedPayload as any).primary_email_address === 'string' && (verifiedPayload as any).primary_email_address) ||
      null;

    if (!email && secretKey) {
      try {
        const clerkClient = createClerkClient({ secretKey });
        const user = await clerkClient.users.getUser(userId);
        const primary =
          user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ||
          user.emailAddresses[0];
        if (primary?.emailAddress) {
          email = primary.emailAddress;
        }
      } catch {
        // If Clerk API lookup fails, email remains null (fails closed for admin check)
      }
    }

    const isAdmin = Boolean(email && isAuthorizedClerkAdmin(email, resolvedEnv));

    return {
      userId,
      sessionId,
      email: email ? email.trim().toLowerCase() : null,
      isAdmin,
      authenticated: true,
      isAuthenticated: true,
      claims: verifiedPayload as Record<string, any>,
    };
  } catch {
    return emptySession;
  }
}

/**
 * Alias matching `@clerk/nextjs/server` `auth()` signature.
 */
export async function auth(req?: any, env?: EnvBindings | null): Promise<VerifiedClerkSession> {
  return getAuth(req, env);
}

/**
 * Extracts client IP address from Fetch Request or Express Request headers.
 */
export function extractClientIp(req: any): string {
  if (!req) return '127.0.0.1';
  if (typeof req.headers?.get === 'function') {
    return (
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('CF-Connecting-IP') ||
      req.headers.get('x-real-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      '127.0.0.1'
    );
  }
  if (req.headers && typeof req.headers === 'object') {
    const cfIp = req.headers['cf-connecting-ip'] || req.headers['CF-Connecting-IP'];
    if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim();
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

export interface FeedbackRateLimitEntry {
  timestamps: number[];
  recentHashes: Set<string>;
}

const defaultFeedbackRateLimitStore = new Map<string, FeedbackRateLimitEntry>();

export interface FeedbackValidationResult {
  ok: boolean;
  status: number;
  error?: string;
  sanitized?: {
    name: string;
    email: string;
    message: string;
  };
}

/**
 * Validates, sanitizes, filters spam, and rate-limits public Feedback POST submissions.
 *
 * Security protections:
 * 1. Honeypot check (`website`, `honeypot`, `bot_field`, `company_url`).
 * 2. Input validation (required feedback text 5..1500 chars, name <= 80 chars, valid email <= 120 chars).
 * 3. Spam & injection prevention (blocks `<script`, `javascript:`, excessive URLs > 2, character floods, duplicates).
 * 4. Per-IP sliding-window rate limiting (max 3 submissions per 10-minute window).
 */
export function validateAndRateLimitFeedback(
  body: any,
  clientIp: string,
  options?: {
    store?: Map<string, FeedbackRateLimitEntry>;
    windowMs?: number;
    maxRequests?: number;
    now?: number;
  }
): FeedbackValidationResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, error: 'Invalid feedback payload.' };
  }

  // 1. Honeypot check for automated spam bots
  const honeypotValue =
    body.website || body.honeypot || body.bot_field || body.company_url;
  if (honeypotValue !== undefined && honeypotValue !== null && String(honeypotValue).trim() !== '') {
    return { ok: false, status: 400, error: 'Spam detected.' };
  }

  // 2. Extract raw fields
  const rawMessage = body.feedback ?? body.message ?? body.notes ?? '';
  const rawName = body.name ?? body.nameOrInsta ?? body.animeTitle ?? 'Anonymous';
  const rawEmail = body.email ?? body.reason ?? '';

  if (typeof rawMessage !== 'string' || typeof rawName !== 'string' || typeof rawEmail !== 'string') {
    return { ok: false, status: 400, error: 'Feedback fields must be strings.' };
  }

  // 3. Malicious script / XSS / SQLi pattern check before stripping tags
  const combinedRaw = `${rawName} ${rawEmail} ${rawMessage}`;
  if (/<\s*script|javascript:|onerror\s*=|onload\s*=|union\s+select|drop\s+table/i.test(combinedRaw)) {
    return { ok: false, status: 400, error: 'Invalid characters or script content detected.' };
  }

  // 4. Sanitize HTML tags & normalize whitespace
  const cleanMessage = rawMessage.replace(/<[^>]*>/g, '').trim();
  const cleanName = (rawName.replace(/<[^>]*>/g, '').trim() || 'Anonymous');
  const cleanEmail = rawEmail.replace(/<[^>]*>/g, '').trim();

  // 5. Length & format validation
  if (cleanMessage.length < 5) {
    return {
      ok: false,
      status: 400,
      error: 'Feedback message is too short (minimum 5 characters).',
    };
  }
  if (cleanMessage.length > 1500) {
    return {
      ok: false,
      status: 400,
      error: 'Feedback message exceeds maximum length of 1500 characters.',
    };
  }
  if (cleanName.length > 80) {
    return {
      ok: false,
      status: 400,
      error: 'Name exceeds maximum length of 80 characters.',
    };
  }
  if (cleanEmail.length > 120) {
    return {
      ok: false,
      status: 400,
      error: 'Email exceeds maximum length of 120 characters.',
    };
  }

  // Validate email format if provided and looks like an email field (not a report reason)
  if (body.email !== undefined && cleanEmail !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      return {
        ok: false,
        status: 400,
        error: 'Please provide a valid email address.',
      };
    }
  }

  // 6. Anti-spam heuristics: excessive URLs or repeated character flooding
  const urlMatches = cleanMessage.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || [];
  if (urlMatches.length > 2) {
    return {
      ok: false,
      status: 400,
      error: 'Spam detected: Too many links in feedback message.',
    };
  }
  if (/(.)\1{19,}/.test(cleanMessage)) {
    return {
      ok: false,
      status: 400,
      error: 'Spam detected: Repetitive character pattern.',
    };
  }

  // 7. Per-IP Rate Limiting & Duplicate Suppression
  const store = options?.store || defaultFeedbackRateLimitStore;
  const windowMs = options?.windowMs ?? 10 * 60 * 1000; // 10 minutes
  const maxRequests = options?.maxRequests ?? 3;
  const now = options?.now ?? Date.now();
  const ipKey = (clientIp || '127.0.0.1').trim();

  const existing = store.get(ipKey) || { timestamps: [], recentHashes: new Set<string>() };
  existing.timestamps = existing.timestamps.filter((ts) => now - ts < windowMs);
  if (existing.timestamps.length === 0) {
    existing.recentHashes.clear();
  }

  if (existing.timestamps.length >= maxRequests) {
    store.set(ipKey, existing);
    return {
      ok: false,
      status: 429,
      error: 'Rate limit exceeded: Too many feedback submissions. Please try again later.',
    };
  }

  const normalizedHash = `${cleanName.toLowerCase()}::${cleanMessage.toLowerCase()}`;
  if (existing.recentHashes.has(normalizedHash)) {
    return {
      ok: false,
      status: 400,
      error: 'Duplicate feedback submission detected.',
    };
  }

  existing.timestamps.push(now);
  existing.recentHashes.add(normalizedHash);
  store.set(ipKey, existing);

  return {
    ok: true,
    status: 200,
    sanitized: {
      name: cleanName,
      email: cleanEmail,
      message: cleanMessage,
    },
  };
}
