import { getAuthorizedAdminEmail, type EnvBindings } from './auth';

export const RESERVED_CHAT_NAMES = new Set<string>([
  'admin',
  'administrator',
  'system',
  'moderator',
  'mod',
  'staff',
  'support',
  'official',
  'owner',
  'superadmin',
  'root',
  'anidub',
  'anidub_bot',
  'anidub bot',
  'anidubbot',
  'anidub admin',
  'system admin',
]);

export interface ChatIdentityInput {
  userId?: string | null;
  username?: string | null;
  email?: string | null;
  isAdmin?: boolean;
  claims?: Record<string, any> | null;
  clerkUser?: any;
}

export interface VerifiedChatIdentity {
  userId: string;
  username: string;
  allowedUsernames: string[];
  email: string | null;
  isAdmin: boolean;
}

function cleanStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/**
 * Checks whether a candidate chat username is a reserved administrative/system identifier
 * or matches the configured ADMIN_EMAIL.
 */
export function isReservedChatName(candidateName?: string | null, env?: EnvBindings | null): boolean {
  const raw = cleanStr(candidateName);
  if (!raw) return false;

  const lower = raw.toLowerCase();
  if (RESERVED_CHAT_NAMES.has(lower)) return true;

  // Compact alphanumeric representation catches obfuscations like "A_d.m-i n" or "Admin!"
  const compact = lower.replace(/[^a-z0-9]/g, '');
  if (
    compact === 'admin' ||
    compact === 'administrator' ||
    compact === 'system' ||
    compact === 'moderator' ||
    compact === 'superadmin' ||
    compact === 'anidubbot' ||
    compact === 'anidubadmin' ||
    compact === 'systemadmin'
  ) {
    return true;
  }

  // Word-boundary token check catches combinations like "AniDub Admin" or "Fake Moderator"
  const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean);
  for (const token of tokens) {
    if (
      token === 'admin' ||
      token === 'administrator' ||
      token === 'system' ||
      token === 'moderator' ||
      token === 'superadmin'
    ) {
      return true;
    }
  }

  // Configured ADMIN_EMAIL protection
  const configuredAdminEmail = getAuthorizedAdminEmail(env);
  if (configuredAdminEmail) {
    if (lower === configuredAdminEmail) return true;
    const adminLocalPart = configuredAdminEmail.split('@')[0]?.trim().toLowerCase();
    if (adminLocalPart && lower === adminLocalPart) return true;
  }

  return false;
}

/**
 * Deterministically computes the verified display username from a Clerk user profile or JWT claims.
 * Shared across frontend (useUser()) and backend (getAuth() / ChatRoom) so both sides match exactly.
 */
export function getVerifiedClerkUsername(
  clerkUserOrProfile?: any,
  claims?: Record<string, any> | null,
  fallbackEmail?: string | null,
  fallbackUserId?: string | null
): string {
  const userObj = clerkUserOrProfile || {};
  const tokenClaims = claims || {};

  const username =
    cleanStr(userObj.username) ||
    cleanStr(tokenClaims.username) ||
    cleanStr(tokenClaims.preferred_username);
  if (username) return username.slice(0, 50);

  const combinedName =
    cleanStr([userObj.firstName, userObj.lastName].filter(Boolean).join(' ')) ||
    cleanStr(userObj.fullName) ||
    cleanStr(tokenClaims.name) ||
    cleanStr(tokenClaims.full_name) ||
    cleanStr([tokenClaims.first_name || tokenClaims.given_name, tokenClaims.last_name || tokenClaims.family_name].filter(Boolean).join(' '));
  if (combinedName) return combinedName.slice(0, 50);

  const firstName =
    cleanStr(userObj.firstName) ||
    cleanStr(tokenClaims.first_name) ||
    cleanStr(tokenClaims.given_name);
  if (firstName) return firstName.slice(0, 50);

  const email =
    cleanStr(userObj.primaryEmailAddress?.emailAddress) ||
    cleanStr(fallbackEmail) ||
    cleanStr(tokenClaims.email) ||
    cleanStr(tokenClaims.email_address);
  if (email && email.includes('@')) {
    const local = email.split('@')[0].trim();
    if (local) return local.slice(0, 50);
  }

  const uid = cleanStr(userObj.id) || cleanStr(fallbackUserId) || cleanStr(tokenClaims.sub);
  if (uid) {
    return `User_${uid.slice(-6)}`.slice(0, 50);
  }

  return '';
}

/**
 * Builds the complete verified chat identity and list of exact allowed profile usernames.
 */
export function buildVerifiedChatIdentity(input: ChatIdentityInput): VerifiedChatIdentity | null {
  const userId = cleanStr(input.userId || input.clerkUser?.id || input.claims?.sub);
  if (!userId) return null;

  const email =
    cleanStr(input.email) ||
    cleanStr(input.clerkUser?.primaryEmailAddress?.emailAddress) ||
    cleanStr(input.claims?.email) ||
    null;

  const derivedFromProfileOrClaims = getVerifiedClerkUsername(
    input.clerkUser,
    input.claims,
    null,
    null
  );

  const canonicalUsername =
    derivedFromProfileOrClaims ||
    cleanStr(input.username).slice(0, 50) ||
    getVerifiedClerkUsername(null, null, email, userId);

  const candidates = new Set<string>();
  const addCandidate = (val: unknown) => {
    const cleaned = cleanStr(val).slice(0, 50);
    if (cleaned) candidates.add(cleaned);
  };

  addCandidate(canonicalUsername);
  addCandidate(input.username);
  addCandidate(input.clerkUser?.username);
  addCandidate(input.clerkUser?.fullName);
  addCandidate([input.clerkUser?.firstName, input.clerkUser?.lastName].filter(Boolean).join(' '));
  addCandidate(input.claims?.username);
  addCandidate(input.claims?.preferred_username);
  addCandidate(input.claims?.name);
  addCandidate(input.claims?.full_name);

  if (email && email.includes('@')) {
    addCandidate(email.split('@')[0]);
    if (input.isAdmin) {
      addCandidate(email);
    }
  }

  const primaryName = canonicalUsername || Array.from(candidates)[0] || `User_${userId.slice(-6)}`;

  return {
    userId,
    username: primaryName,
    allowedUsernames: Array.from(candidates),
    email: email ? email.toLowerCase() : null,
    isAdmin: Boolean(input.isAdmin),
  };
}

export interface ChatSenderValidationResult {
  ok: boolean;
  status: number;
  code?: string;
  error?: string;
  verifiedUsername?: string;
}

/**
 * Strictly validates an incoming chat or WebSocket message sender against the
 * verified Clerk session/profile and reserved admin names.
 */
export function validateChatSender(params: {
  claimedUsername?: unknown;
  identity: VerifiedChatIdentity | null | undefined;
  env?: EnvBindings | null;
}): ChatSenderValidationResult {
  const { claimedUsername, identity, env } = params;

  if (!identity || !identity.userId) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      error: 'Unauthorized: Active Clerk user session required to send chat messages.',
    };
  }

  const submitted = cleanStr(claimedUsername);

  // Reserved names protection: non-admin users can never claim Admin/System/Moderator or ADMIN_EMAIL
  if (submitted && isReservedChatName(submitted, env) && !identity.isAdmin) {
    return {
      ok: false,
      status: 403,
      code: 'RESERVED_USERNAME',
      error: `Username "${submitted}" is reserved and cannot be claimed.`,
    };
  }

  // If the user's verified Clerk profile itself resolves to a reserved name while non-admin,
  // use a safe non-reserved fallback identifier.
  const safeCanonicalUsername =
    isReservedChatName(identity.username, env) && !identity.isAdmin
      ? `User_${identity.userId.slice(-6)}`
      : identity.username;

  if (!submitted) {
    return {
      ok: false,
      status: 400,
      code: 'MISSING_USERNAME',
      error: `Missing username: Expected verified Clerk username "${safeCanonicalUsername}".`,
    };
  }

  const submittedLower = submitted.toLowerCase();
  const allowedMatch = identity.allowedUsernames.some((allowed) => {
    if (!identity.isAdmin && isReservedChatName(allowed, env)) {
      return false;
    }
    return allowed.toLowerCase() === submittedLower;
  });

  if (!allowedMatch) {
    return {
      ok: false,
      status: 403,
      code: 'USERNAME_MISMATCH',
      error: `Username impersonation rejected: "${submitted}" does not match your verified Clerk username "${safeCanonicalUsername}".`,
    };
  }

  return {
    ok: true,
    status: 200,
    verifiedUsername: safeCanonicalUsername,
  };
}
