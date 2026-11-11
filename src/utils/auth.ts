import { verifyToken, createClerkClient } from '@clerk/backend';

export interface ClerkAuthResult {
  authenticated: boolean;
  userId: string | null;
  sessionId: string | null;
  email: string | null;
  isAdmin: boolean;
}

export interface ClerkUserSubject {
  id?: string | null;
  email?: string | null;
  primaryEmailAddress?: {
    emailAddress?: string | null;
  } | null;
  emailAddresses?: Array<{
    emailAddress?: string | null;
  }>;
}

/**
 * Reads the authorized Administrator email strictly from the ADMIN_EMAIL environment variable.
 * Contains ZERO hardcoded fallback emails.
 */
export function getAuthorizedAdminEmail(): string {
  const serverEnvEmail =
    typeof process !== 'undefined' && process.env ? process.env.ADMIN_EMAIL : undefined;
  const clientEnvEmail =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? (import.meta as any).env.NEXT_PUBLIC_ADMIN_EMAIL ||
        (import.meta as any).env.VITE_ADMIN_EMAIL
      : undefined;

  const raw = serverEnvEmail || clientEnvEmail || '';
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/**
 * Checks whether a verified Clerk user object or email matches the ADMIN_EMAIL environment variable.
 * If ADMIN_EMAIL is not configured in the environment, always returns false.
 */
export function isAuthorizedClerkAdmin(subject?: ClerkUserSubject | string | null): boolean {
  const adminEmail = getAuthorizedAdminEmail();
  if (!adminEmail || !adminEmail.includes('@')) {
    return false;
  }
  if (!subject) {
    return false;
  }

  if (typeof subject === 'string') {
    const clean = subject.trim().toLowerCase();
    return Boolean(clean && clean === adminEmail);
  }

  const email = (
    subject.primaryEmailAddress?.emailAddress ||
    subject.email ||
    subject.emailAddresses?.[0]?.emailAddress ||
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

  return email === adminEmail;
}

function getHeader(
  headers: Record<string, string | string[] | undefined> | Headers | undefined,
  name: string
): string {
  if (!headers) return '';
  if (typeof (headers as Headers).get === 'function') {
    return ((headers as Headers).get(name) || (headers as Headers).get(name.toLowerCase()) || '').trim();
  }
  const record = headers as Record<string, string | string[] | undefined>;
  const val = record[name] ?? record[name.toLowerCase()];
  if (Array.isArray(val)) return (val[0] || '').trim();
  return typeof val === 'string' ? val.trim() : '';
}

export interface ClerkRequestLike {
  headers?: Record<string, string | string[] | undefined> | Headers;
  [key: string]: any;
}

/**
 * Extracts the raw Clerk JWT strictly from the Authorization Bearer header or __session cookie.
 * Never reads tokens, user IDs, or emails from request bodies or custom client headers.
 */
export function extractClerkJwtFromRequest(req?: ClerkRequestLike): string | null {
  if (!req?.headers) return null;

  const authHeader = getHeader(req.headers, 'authorization');
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token && token.split('.').length === 3) return token;
  }

  const cookieHeader = getHeader(req.headers, 'cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';');
    for (const part of cookies) {
      const [rawKey, ...rawValParts] = part.trim().split('=');
      if (rawKey === '__session') {
        const val = decodeURIComponent(rawValParts.join('=').trim());
        if (val && val.split('.').length === 3) return val;
      }
    }
  }

  return null;
}

/**
 * Cryptographically verifies a Clerk session JWT using Clerk's official @clerk/backend SDK.
 * Never trusts client-supplied user IDs or emails from the request body or custom headers.
 */
export async function getAuth(req?: ClerkRequestLike): Promise<ClerkAuthResult> {
  const unauthenticated: ClerkAuthResult = {
    authenticated: false,
    userId: null,
    sessionId: null,
    email: null,
    isAdmin: false,
  };

  const token = extractClerkJwtFromRequest(req);
  if (!token) {
    return unauthenticated;
  }

  const secretKey =
    typeof process !== 'undefined' && process.env?.CLERK_SECRET_KEY
      ? process.env.CLERK_SECRET_KEY.trim()
      : '';
  const jwtKey =
    typeof process !== 'undefined' && process.env?.CLERK_JWT_KEY
      ? process.env.CLERK_JWT_KEY.trim()
      : '';

  if (!secretKey && !jwtKey) {
    return unauthenticated;
  }

  try {
    const verifiedPayload: any = await verifyToken(token, {
      secretKey: secretKey || undefined,
      jwtKey: jwtKey || undefined,
    });

    const userId = typeof verifiedPayload?.sub === 'string' ? verifiedPayload.sub.trim() : '';
    if (!userId) {
      return unauthenticated;
    }

    const sessionId =
      typeof verifiedPayload?.sid === 'string' ? verifiedPayload.sid.trim() : null;

    let verifiedEmail: string | null =
      typeof verifiedPayload?.email === 'string'
        ? verifiedPayload.email.trim().toLowerCase()
        : typeof verifiedPayload?.primary_email_address === 'string'
          ? verifiedPayload.primary_email_address.trim().toLowerCase()
          : null;

    // If email is not embedded in custom JWT claims and CLERK_SECRET_KEY is configured, fetch from Clerk Backend API
    if (!verifiedEmail && secretKey) {
      try {
        const clerkClient = createClerkClient({ secretKey });
        const user = await clerkClient.users.getUser(userId);
        const primaryEmail =
          user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ||
          user.emailAddresses[0]?.emailAddress ||
          null;
        if (primaryEmail) {
          verifiedEmail = primaryEmail.trim().toLowerCase();
        }
      } catch {
        // Unable to fetch user profile from Clerk API
      }
    }

    const isAdmin = isAuthorizedClerkAdmin({
      id: userId,
      email: verifiedEmail,
    });

    return {
      authenticated: true,
      userId,
      sessionId,
      email: verifiedEmail,
      isAdmin,
    };
  } catch {
    return unauthenticated;
  }
}

/**
 * Official Clerk auth() helper alias for server-side route handlers.
 */
export async function auth(req?: ClerkRequestLike): Promise<ClerkAuthResult> {
  return getAuth(req);
}
