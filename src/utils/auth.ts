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
  VITE_ADMIN_EMAIL?: string;
  NEXT_PUBLIC_ADMIN_EMAIL?: string;
  CLERK_SECRET_KEY?: string;
  VITE_CLERK_SECRET_KEY?: string;
  NEXT_PUBLIC_CLERK_SECRET_KEY?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  VITE_CLERK_PUBLISHABLE_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_JWT_KEY?: string;
  ALLOWED_ORIGINS?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
  APP_URL?: string;
  IMGBB_API_KEY?: string;
  [key: string]: any;
}

function cleanEnvValue(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  return String(raw)
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .trim();
}

/**
 * Safely reads an environment variable from Cloudflare `env` bindings.
 * When `env` is provided by the Cloudflare Worker/Pages context, reads strictly from `env` (never `process.env`).
 */
export function getEnvBinding(key: string, env?: EnvBindings | null): string | undefined {
  if (env && typeof env === 'object') {
    if (env[key] !== undefined && env[key] !== null) {
      const val = cleanEnvValue(env[key]);
      if (val !== '') return val;
    }
    return undefined;
  }
  const globalCloudflareEnv = (globalThis as any)?.__CLOUDFLARE_ENV__;
  if (globalCloudflareEnv && globalCloudflareEnv[key]) {
    const val = cleanEnvValue(globalCloudflareEnv[key]);
    if (val !== '') return val;
  }
  const nodeEnv = (globalThis as any)?.process?.env;
  if (nodeEnv && typeof nodeEnv[key] === 'string') {
    const val = cleanEnvValue(nodeEnv[key]);
    if (val !== '') return val;
  }
  return undefined;
}

/**
 * Returns the configured ADMIN_EMAIL from Cloudflare `env` bindings (`env.ADMIN_EMAIL` or `env.VITE_ADMIN_EMAIL` or `env.NEXT_PUBLIC_ADMIN_EMAIL`),
 * falling back to client build-time `import.meta.env` in the browser.
 * Returns '' if not configured (fails closed).
 */
export function getAuthorizedAdminEmail(env?: EnvBindings | null): string {
  const directBinding =
    cleanEnvValue(env?.ADMIN_EMAIL) ||
    cleanEnvValue(env?.VITE_ADMIN_EMAIL) ||
    cleanEnvValue(env?.NEXT_PUBLIC_ADMIN_EMAIL);

  const serverEnvEmail =
    directBinding ||
    getEnvBinding('ADMIN_EMAIL', env) ||
    getEnvBinding('VITE_ADMIN_EMAIL', env) ||
    getEnvBinding('NEXT_PUBLIC_ADMIN_EMAIL', env);

  let clientEnvEmail: string | undefined;
  try {
    clientEnvEmail =
      cleanEnvValue((import.meta as any).env?.VITE_ADMIN_EMAIL) ||
      cleanEnvValue((import.meta as any).env?.NEXT_PUBLIC_ADMIN_EMAIL) ||
      cleanEnvValue((import.meta as any).env?.ADMIN_EMAIL);
  } catch {
    // import.meta.env may not exist in all runtimes
  }

  return (serverEnvEmail || clientEnvEmail || '').trim().toLowerCase();
}

/**
 * Validates whether a Clerk user object, verified claims object, or email string belongs to the authorized Admin.
 * Strictly requires ADMIN_EMAIL (or VITE_ADMIN_EMAIL) to be configured in `env` bindings AND,
 * for user/claim objects, strictly requires the primary email to be verified (`verification.status === 'verified'` or `email_verified === true`).
 */
export function isAuthorizedClerkAdmin(subject?: any, env?: EnvBindings | null): boolean {
  const authorizedEmail = getAuthorizedAdminEmail(env);
  if (!authorizedEmail || !subject) return false;

  if (typeof subject === 'string') {
    return cleanEnvValue(subject).toLowerCase() === authorizedEmail;
  }

  if (subject.id === 'guest') return false;
  if (subject.email_verified === false) return false;

  // Clerk User / UserResource shape: require primary email AND verification.status === 'verified'
  if (
    subject.primaryEmailAddress !== undefined ||
    Array.isArray(subject.emailAddresses) ||
    subject.primaryEmailAddressId !== undefined
  ) {
    const primaryEntry =
      (Array.isArray(subject.emailAddresses) && subject.primaryEmailAddressId
        ? subject.emailAddresses.find((e: any) => e?.id === subject.primaryEmailAddressId)
        : null) ||
      (subject.primaryEmailAddress && typeof subject.primaryEmailAddress === 'object'
        ? subject.primaryEmailAddress
        : null);

    if (!primaryEntry) return false;

    const primaryAddress = cleanEnvValue(primaryEntry.emailAddress || primaryEntry.email).toLowerCase();
    const isPrimaryVerified = primaryEntry?.verification?.status === 'verified';
    return Boolean(primaryAddress && primaryAddress === authorizedEmail && isPrimaryVerified);
  }

  // Verified JWT claim / session object shape: require email_verified === true
  const claimEmail = cleanEnvValue(
    subject.email ||
      subject.emailAddress ||
      subject.primary_email_address ||
      subject.user_email
  ).toLowerCase();
  if (!claimEmail) return false;

  const isClaimVerified =
    subject.email_verified === true || subject.verification?.status === 'verified';
  return Boolean(claimEmail === authorizedEmail && isClaimVerified);
}

/**
 * Extracts a well-formed 3-part bearer JWT, `__session` / `__session_*` cookie, or `?token=` WebSocket query token
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

  // 2. Check __session and suffixed __session_* cookies
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
      if (rawName === '__session' || (rawName && rawName.startsWith('__session_'))) {
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
  username?: string | null;
  clerkUser?: any;
  isAdmin: boolean;
  authenticated: boolean;
  isAuthenticated: boolean;
  claims: Record<string, any> | null;
  error?: string;
}

const BASE_AUTHORIZED_PARTIES = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://ais-dev-qwvw5bws5eviuuugfdklbn-712933804987.asia-southeast1.run.app',
  'https://ais-pre-qwvw5bws5eviuuugfdklbn-712933804987.asia-southeast1.run.app',
  'https://anidub.in',
  'https://www.anidub.in',
  'https://anidub-india.pages.dev',
  'https://anidub-india-a1y.pages.dev',
  'https://anidub-india.samayaprasanth0.workers.dev',
  'https://anidub-api.samayaprasanth0.workers.dev',
] as const;

function parseExactOrigin(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed || trimmed.includes('*')) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

function getApprovedOriginMap(env?: EnvBindings | null): Map<string, string> {
  const originMap = new Map<string, string>();

  for (const base of BASE_AUTHORIZED_PARTIES) {
    const normalized = parseExactOrigin(base);
    if (normalized) originMap.set(normalized, base);
  }

  const envListSources = [
    getEnvBinding('ALLOWED_ORIGINS', env),
    getEnvBinding('CLERK_AUTHORIZED_PARTIES', env),
    getEnvBinding('APP_URL', env),
  ];

  for (const rawList of envListSources) {
    if (!rawList) continue;
    for (const item of rawList.split(',')) {
      const normalized = parseExactOrigin(item);
      if (normalized && !originMap.has(normalized)) {
        originMap.set(normalized, normalized);
      }
    }
  }

  return originMap;
}

/**
 * Validates whether a given origin or URL strictly matches an exact approved local dev,
 * preview, Cloudflare deployment, or production AniDub origin (no broad suffix wildcards).
 */
export function isApprovedOrigin(originOrUrl?: string | null, env?: EnvBindings | null): boolean {
  const normalized = parseExactOrigin(originOrUrl);
  if (!normalized) return false;
  return getApprovedOriginMap(env).has(normalized);
}

/**
 * Builds the exact Clerk `authorizedParties` allowlist from approved origins and env configuration.
 */
export function buildAuthorizedParties(req?: any, env?: EnvBindings | null): string[] {
  const originMap = getApprovedOriginMap(env);

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

  // Keep only exact allowlisted origins (never auto-approve unknown request Origins/URLs)
  for (const candidate of candidateUrls) {
    const normalized = parseExactOrigin(candidate);
    if (normalized && originMap.has(normalized)) {
      originMap.set(normalized, originMap.get(normalized)!);
    }
  }

  return Array.from(originMap.values());
}

/**
 * Official backend Clerk `getAuth(req, env)` implementation.
 * Explicitly passes `secretKey: env.CLERK_SECRET_KEY` and
 * `publishableKey: (env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || env.VITE_CLERK_PUBLISHABLE_KEY)`
 * when initializing the Clerk backend client and verifying tokens.
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

  const secretKey =
    cleanEnvValue(resolvedEnv?.CLERK_SECRET_KEY) ||
    cleanEnvValue(resolvedEnv?.VITE_CLERK_SECRET_KEY) ||
    cleanEnvValue(resolvedEnv?.NEXT_PUBLIC_CLERK_SECRET_KEY) ||
    getEnvBinding('CLERK_SECRET_KEY', resolvedEnv) ||
    getEnvBinding('VITE_CLERK_SECRET_KEY', resolvedEnv) ||
    '';

  const publishableKey =
    cleanEnvValue(resolvedEnv?.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) ||
    cleanEnvValue(resolvedEnv?.VITE_CLERK_PUBLISHABLE_KEY) ||
    cleanEnvValue(resolvedEnv?.CLERK_PUBLISHABLE_KEY) ||
    getEnvBinding('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', resolvedEnv) ||
    getEnvBinding('VITE_CLERK_PUBLISHABLE_KEY', resolvedEnv) ||
    getEnvBinding('CLERK_PUBLISHABLE_KEY', resolvedEnv) ||
    '';

  const jwtKey =
    cleanEnvValue(resolvedEnv?.CLERK_JWT_KEY) ||
    cleanEnvValue(resolvedEnv?.VITE_CLERK_JWT_KEY) ||
    getEnvBinding('CLERK_JWT_KEY', resolvedEnv) ||
    '';

  const configuredAdminEmail = getAuthorizedAdminEmail(resolvedEnv);

  // Strict verification: require CLERK_SECRET_KEY or CLERK_JWT_KEY in env bindings
  if (!secretKey && !jwtKey) {
    const boundKeys =
      resolvedEnv && typeof resolvedEnv === 'object'
        ? Object.keys(resolvedEnv).filter(
            (k) => resolvedEnv[k] !== undefined && resolvedEnv[k] !== null && resolvedEnv[k] !== ''
          )
        : [];
    return {
      ...emptySession,
      error: `Missing CLERK_SECRET_KEY in env bindings (bound keys: ${boundKeys.length ? boundKeys.join(', ') : 'none'})`,
    };
  }

  const clerkClient = secretKey
    ? createClerkClient({
        secretKey,
        publishableKey: publishableKey || undefined,
      })
    : null;

  let token = extractClerkJwtFromRequest(req);
  let verifiedPayload: Record<string, any> | null = null;
  let verifyErrorDetail = '';

  const authorizedParties = buildAuthorizedParties(req, resolvedEnv);

  if (token) {
    try {
      const verifyOptions: Record<string, any> = {
        secretKey: secretKey || undefined,
        publishableKey: publishableKey || undefined,
        authorizedParties,
        clockSkewInMs: 60000,
      };
      if (jwtKey) verifyOptions.jwtKey = jwtKey;

      const verified = await verifyToken(token, verifyOptions);
      if (verified && typeof verified.sub === 'string' && verified.sub.trim()) {
        verifiedPayload = verified as Record<string, any>;
      }
    } catch (err: any) {
      verifyErrorDetail = err?.message || 'Invalid or expired Clerk session token';
    }
  }

  // Fallback: if authenticateRequest is available on clerkClient and req is a standard Fetch Request
  if (!verifiedPayload && clerkClient && req && typeof req.url === 'string' && typeof req.headers?.get === 'function') {
    try {
      const requestState = await clerkClient.authenticateRequest(req as Request, {
        secretKey,
        publishableKey: publishableKey || undefined,
        authorizedParties,
      });
      const authObj = requestState?.toAuth?.();
      if (authObj?.userId) {
        verifiedPayload = {
          ...(authObj.sessionClaims || {}),
          sub: authObj.userId,
          sid: authObj.sessionId || null,
        };
      } else if (!verifyErrorDetail && requestState?.reason) {
        verifyErrorDetail = String(requestState.reason);
      }
    } catch (err: any) {
      if (!verifyErrorDetail) {
        verifyErrorDetail = err?.message || 'Clerk request authentication failed';
      }
    }
  }



  if (!verifiedPayload || typeof verifiedPayload.sub !== 'string' || !verifiedPayload.sub.trim()) {
    if (!token) {
      return {
        ...emptySession,
        error: 'Missing Clerk session token in Authorization header or __session cookie',
      };
    }
    return {
      ...emptySession,
      error: verifyErrorDetail
        ? `Clerk token verification failed: ${verifyErrorDetail}`
        : 'Clerk token verification failed',
    };
  }

  const userId = verifiedPayload.sub.trim();
  const sessionId = typeof verifiedPayload.sid === 'string' ? verifiedPayload.sid : null;

  // Extract email from verified token claims if present, and fetch authoritative Clerk user profile if secretKey exists
  const claimEmail: string | null =
    (typeof verifiedPayload.email === 'string' && verifiedPayload.email) ||
    (typeof verifiedPayload.email_address === 'string' && verifiedPayload.email_address) ||
    (typeof verifiedPayload.primary_email_address === 'string' && verifiedPayload.primary_email_address) ||
    (typeof verifiedPayload.user_email === 'string' && verifiedPayload.user_email) ||
    null;

  let clerkUserObj: any = null;
  let userLookupError = '';

  if (clerkClient) {
    try {
      clerkUserObj = await clerkClient.users.getUser(userId);
    } catch (err: any) {
      userLookupError = err?.message || 'Failed to fetch Clerk user profile';
    }
  }

  let primaryEmail: string | null = null;
  let primaryEmailVerified = false;

  if (clerkUserObj) {
    const primaryEntry =
      (Array.isArray(clerkUserObj.emailAddresses) && clerkUserObj.primaryEmailAddressId
        ? clerkUserObj.emailAddresses.find((e: any) => e?.id === clerkUserObj.primaryEmailAddressId)
        : null) ||
      (clerkUserObj.primaryEmailAddress && typeof clerkUserObj.primaryEmailAddress === 'object'
        ? clerkUserObj.primaryEmailAddress
        : null);

    if (primaryEntry && typeof (primaryEntry.emailAddress || primaryEntry.email) === 'string') {
      primaryEmail = primaryEntry.emailAddress || primaryEntry.email;
      primaryEmailVerified = primaryEntry?.verification?.status === 'verified';
    }
  } else {
    primaryEmail = claimEmail;
    primaryEmailVerified = verifiedPayload.email_verified === true;
  }

  // Never treat an explicitly unverified JWT claim as verified
  if (verifiedPayload.email_verified === false) {
    primaryEmailVerified = false;
  }

  const normalizedEmail = primaryEmail ? cleanEnvValue(primaryEmail).toLowerCase() : null;
  const isAdmin = Boolean(
    configuredAdminEmail &&
      normalizedEmail &&
      normalizedEmail === configuredAdminEmail &&
      primaryEmailVerified === true
  );

  let adminError: string | undefined;
  if (!isAdmin) {
    if (!configuredAdminEmail) {
      adminError = 'Missing ADMIN_EMAIL (or VITE_ADMIN_EMAIL) in env bindings';
    } else if (!normalizedEmail && userLookupError) {
      adminError = `Unauthorized: Unable to verify Clerk account email (${userLookupError})`;
    } else if (!normalizedEmail || normalizedEmail !== configuredAdminEmail) {
      adminError = 'Forbidden: Unauthorized access';
    } else if (!primaryEmailVerified) {
      adminError = 'Forbidden: Primary email is not verified (email_verified === true required)';
    }
  }

  const resolvedUsername =
    cleanEnvValue(clerkUserObj?.username) ||
    cleanEnvValue(verifiedPayload?.username) ||
    cleanEnvValue(verifiedPayload?.preferred_username) ||
    cleanEnvValue([clerkUserObj?.firstName, clerkUserObj?.lastName].filter(Boolean).join(' ')) ||
    cleanEnvValue(verifiedPayload?.name) ||
    cleanEnvValue(verifiedPayload?.full_name) ||
    cleanEnvValue(clerkUserObj?.firstName) ||
    cleanEnvValue(verifiedPayload?.first_name) ||
    (normalizedEmail && normalizedEmail.includes('@') ? normalizedEmail.split('@')[0].trim() : '') ||
    `User_${userId.slice(-6)}`;

  return {
    userId,
    sessionId,
    email: normalizedEmail,
    username: resolvedUsername || null,
    clerkUser: clerkUserObj || null,
    isAdmin,
    authenticated: true,
    isAuthenticated: true,
    claims: verifiedPayload,
    ...(adminError ? { error: adminError } : {}),
  };
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
