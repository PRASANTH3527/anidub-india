export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const MIME_TO_EXTENSIONS: Record<AllowedImageMimeType, readonly string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export interface ImageUploadValidationResult {
  ok: boolean;
  status: number;
  error?: string;
  mimeType?: AllowedImageMimeType;
  extension?: string;
  sizeBytes?: number;
  cleanBase64?: string;
  sanitizedFilename?: string;
}

export function normalizeImageMimeType(rawMime?: string | null): AllowedImageMimeType | null {
  if (!rawMime || typeof rawMime !== 'string') return null;
  const cleaned = rawMime.split(';')[0].trim().toLowerCase();
  if (cleaned === 'image/jpg' || cleaned === 'image/jpeg') return 'image/jpeg';
  if (cleaned === 'image/png') return 'image/png';
  if (cleaned === 'image/webp') return 'image/webp';
  return null;
}

export function extractFileExtension(filename?: string | null): string | null {
  if (!filename || typeof filename !== 'string') return null;
  const baseName = filename.trim().split(/[\\/]/).pop() || '';
  const dotIdx = baseName.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === baseName.length - 1) return null;
  return baseName.slice(dotIdx + 1).trim().toLowerCase();
}

export function sanitizeImageFilename(filename?: string | null, fallbackExt = 'png'): string {
  const baseName = (filename || `poster.${fallbackExt}`).trim().split(/[\\/]/).pop() || `poster.${fallbackExt}`;
  const ext = extractFileExtension(baseName) || fallbackExt;
  const stem = baseName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'poster';
  return `${stem.slice(0, 64)}.${ext}`;
}

export function decodeBase64ToBytes(base64: string): Uint8Array | null {
  const normalized = base64.replace(/\s+/g, '');
  if (!normalized || normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    return null;
  }
  try {
    if (typeof atob === 'function') {
      const binary = atob(normalized);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
    const buf = Buffer.from(normalized, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch {
    return null;
  }
}

/**
 * Inspects file magic bytes to verify the binary signature matches one of JPEG, PNG, or WebP.
 */
export function detectImageMimeFromMagicBytes(bytes: Uint8Array): AllowedImageMimeType | null {
  if (!bytes || bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: "RIFF" (52 49 46 46) .... "WEBP" (57 45 42 50)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Strict server-side image upload validator for both JSON base64 payloads and multipart files.
 * Enforces:
 * - MIME type allowlist (`image/jpeg`, `image/png`, `image/webp`)
 * - Filename extension validation & consistency with MIME type
 * - Decoded byte size bounds (1 byte .. maxSizeBytes)
 * - Magic-byte signature verification matching declared MIME type
 */
export function validateServerImageUpload(
  input: {
    image?: unknown;
    bytes?: Uint8Array;
    filename?: unknown;
    mimeType?: unknown;
  },
  options?: { maxSizeBytes?: number }
): ImageUploadValidationResult {
  const maxSizeBytes = options?.maxSizeBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  const rawFilename = typeof input.filename === 'string' ? input.filename.trim() : '';

  let rawDeclaredMime = typeof input.mimeType === 'string' ? input.mimeType.trim() : '';
  let cleanBase64 = '';
  let bytes: Uint8Array | null = input.bytes ?? null;

  if (!bytes) {
    if (typeof input.image !== 'string' || !input.image.trim()) {
      return { ok: false, status: 400, error: 'Missing image data' };
    }
    const rawImage = input.image.trim();
    const dataUriMatch = rawImage.match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/i);
    if (rawImage.toLowerCase().startsWith('data:')) {
      if (!dataUriMatch) {
        return { ok: false, status: 400, error: 'Malformed image data URI payload' };
      }
      const dataUriMime = dataUriMatch[1].trim().toLowerCase();
      if (rawDeclaredMime && normalizeImageMimeType(rawDeclaredMime) !== normalizeImageMimeType(dataUriMime)) {
        return { ok: false, status: 400, error: 'Image MIME type mismatch between payload header and metadata' };
      }
      rawDeclaredMime = dataUriMime;
      cleanBase64 = dataUriMatch[2].replace(/\s+/g, '');
    } else {
      cleanBase64 = rawImage.replace(/\s+/g, '');
    }

    // Fast length guard prior to decoding to prevent memory exhaustion
    const maxBase64Chars = Math.ceil(maxSizeBytes / 3) * 4 + 16;
    if (cleanBase64.length > maxBase64Chars) {
      return {
        ok: false,
        status: 413,
        error: `Image size exceeds maximum allowed limit of ${Math.round(maxSizeBytes / (1024 * 1024))}MB`,
      };
    }

    bytes = decodeBase64ToBytes(cleanBase64);
    if (!bytes) {
      return { ok: false, status: 400, error: 'Invalid base64 image encoding' };
    }
  }

  // 1. Validate decoded byte size
  if (bytes.length <= 0) {
    return { ok: false, status: 400, error: 'Image file is empty' };
  }
  if (bytes.length > maxSizeBytes) {
    return {
      ok: false,
      status: 413,
      error: `Image size exceeds maximum allowed limit of ${Math.round(maxSizeBytes / (1024 * 1024))}MB`,
    };
  }

  // 2. Validate declared MIME type strictly against allowlist
  const normalizedMime = normalizeImageMimeType(rawDeclaredMime);
  if (!normalizedMime) {
    return {
      ok: false,
      status: 400,
      error: rawDeclaredMime
        ? `Unsupported image MIME type "${rawDeclaredMime}". Allowed types: image/jpeg, image/png, image/webp`
        : 'Missing image MIME type. Allowed types: image/jpeg, image/png, image/webp',
    };
  }

  // 3. Validate filename extension if filename was supplied
  let ext = extractFileExtension(rawFilename);
  if (rawFilename) {
    if (!ext || !(ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
      return {
        ok: false,
        status: 400,
        error: `Invalid image file extension${ext ? ` ".${ext}"` : ''}. Allowed extensions: .jpg, .jpeg, .png, .webp`,
      };
    }
    const expectedExts = MIME_TO_EXTENSIONS[normalizedMime];
    if (!expectedExts.includes(ext)) {
      return {
        ok: false,
        status: 400,
        error: `File extension ".${ext}" does not match image MIME type "${normalizedMime}"`,
      };
    }
  } else {
    ext = MIME_TO_EXTENSIONS[normalizedMime][0];
  }

  // 4. Verify binary magic bytes match declared MIME type
  const detectedMime = detectImageMimeFromMagicBytes(bytes);
  if (!detectedMime || detectedMime !== normalizedMime) {
    return {
      ok: false,
      status: 400,
      error: `Image binary signature does not match declared format "${normalizedMime}"`,
    };
  }

  return {
    ok: true,
    status: 200,
    mimeType: normalizedMime,
    extension: ext,
    sizeBytes: bytes.length,
    cleanBase64: cleanBase64 || undefined,
    sanitizedFilename: sanitizeImageFilename(rawFilename, ext),
  };
}

function isPrivateOrDisallowedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!lower) return true;

  if (
    lower === 'localhost' ||
    lower === 'ip6-localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.localdomain')
  ) {
    return true;
  }

  // Single-label hostnames (e.g. http://metadata)
  if (!lower.includes('.') && !lower.includes(':')) {
    return true;
  }

  // IPv4 literals
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  // IPv6 loopback / link-local / ULA
  if (lower.includes(':')) {
    if (lower === '::1' || lower === '::' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
      return true;
    }
  }

  return false;
}

const DISALLOWED_EXTERNAL_IMAGE_EXTENSIONS = [
  '.html',
  '.htm',
  '.js',
  '.mjs',
  '.cjs',
  '.php',
  '.asp',
  '.aspx',
  '.jsp',
  '.svg',
  '.exe',
  '.sh',
  '.bat',
  '.cmd',
  '.msi',
  '.zip',
];

/**
 * Validates external image URLs (`cover_image`, `banner_image`, `avatar_url`, ImgBB response URLs).
 * Rejects non-HTTPS schemes (`http:`, `javascript:`, `data:`, `file:`), SSRF targets, embedded credentials,
 * and dangerous non-image file extensions.
 */
export function validateExternalImageUrl(
  rawUrl: unknown,
  options?: { required?: boolean; fieldName?: string; maxLength?: number }
): { ok: boolean; url?: string; error?: string } {
  const fieldName = options?.fieldName || 'Image URL';
  const maxLength = options?.maxLength ?? 1000;

  if (rawUrl === undefined || rawUrl === null || String(rawUrl).trim() === '') {
    if (options?.required) {
      return { ok: false, error: `${fieldName} is required.` };
    }
    return { ok: true, url: '' };
  }

  if (typeof rawUrl !== 'string') {
    return { ok: false, error: `${fieldName} must be a valid URL string.` };
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length > maxLength) {
    return { ok: false, error: `${fieldName} exceeds maximum length of ${maxLength} characters.` };
  }
  if (/[\s\u0000-\u001F\u007F]/.test(trimmed)) {
    return { ok: false, error: `${fieldName} contains invalid whitespace or control characters.` };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: `${fieldName} must be a valid HTTPS URL (e.g., https://example.com/poster.jpg).` };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: `${fieldName} must use HTTPS (received "${parsed.protocol}").` };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: `${fieldName} must not contain embedded credentials.` };
  }

  if (isPrivateOrDisallowedHostname(parsed.hostname)) {
    return { ok: false, error: `${fieldName} points to a disallowed or private host.` };
  }

  const lowerPath = parsed.pathname.toLowerCase();
  if (DISALLOWED_EXTERNAL_IMAGE_EXTENSIONS.some((ext) => lowerPath.endsWith(ext))) {
    return { ok: false, error: `${fieldName} points to an unsupported or unsafe file extension.` };
  }

  return { ok: true, url: parsed.toString() };
}

/**
 * Validates optional streaming/watch URLs (`https://` public URLs only).
 */
export function validateOptionalExternalWebUrl(
  rawUrl: unknown,
  fieldName = 'Watch URL'
): { ok: boolean; url?: string; error?: string } {
  if (rawUrl === undefined || rawUrl === null || String(rawUrl).trim() === '') {
    return { ok: true, url: '' };
  }
  if (typeof rawUrl !== 'string') {
    return { ok: false, error: `${fieldName} must be a valid URL string.` };
  }
  const trimmed = rawUrl.trim();
  if (trimmed.length > 1000) {
    return { ok: false, error: `${fieldName} exceeds maximum length of 1000 characters.` };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: `${fieldName} must be a valid HTTPS URL.` };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, error: `${fieldName} must use HTTPS.` };
  }
  if (parsed.username || parsed.password || isPrivateOrDisallowedHostname(parsed.hostname)) {
    return { ok: false, error: `${fieldName} points to a disallowed host.` };
  }
  return { ok: true, url: parsed.toString() };
}

export const DEFAULT_MIN_ACCOUNT_AGE_MS = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_SUBMISSION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_MAX_USER_SUBMISSIONS_PER_WINDOW = 3;
export const DEFAULT_MAX_IP_SUBMISSIONS_PER_WINDOW = 5;

export interface AccountEligibilityResult {
  ok: boolean;
  status: number;
  error?: string;
}

/**
 * Verifies that a non-admin community submitter has a verified email address
 * and meets the minimum account age threshold to prevent throwaway spam accounts.
 */
export function validateCommunitySubmissionAccount(
  session: {
    userId: string | null;
    email?: string | null;
    isAdmin?: boolean;
    clerkUser?: any;
    claims?: Record<string, any> | null;
  },
  options?: {
    minAccountAgeMs?: number;
    now?: number;
  }
): AccountEligibilityResult {
  if (!session?.userId) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized: Active Clerk user session required to submit anime',
    };
  }

  if (session.isAdmin) {
    return { ok: true, status: 200 };
  }

  const now = options?.now ?? Date.now();
  const minAccountAgeMs = options?.minAccountAgeMs ?? DEFAULT_MIN_ACCOUNT_AGE_MS;

  // 1. Verified email requirement
  const clerkUser = session.clerkUser;
  if (clerkUser && Array.isArray(clerkUser.emailAddresses)) {
    const hasVerifiedEmail = clerkUser.emailAddresses.some(
      (entry: any) =>
        entry?.verification?.status === 'verified' &&
        typeof entry?.emailAddress === 'string' &&
        entry.emailAddress.trim() !== ''
    );
    if (!hasVerifiedEmail) {
      return {
        ok: false,
        status: 403,
        error: 'A verified email address is required before submitting community entries.',
      };
    }
  } else {
    if (session.claims?.email_verified === false || !session.email || !session.email.includes('@')) {
      return {
        ok: false,
        status: 403,
        error: 'A verified email address is required before submitting community entries.',
      };
    }
  }

  // 2. Minimum account age requirement (when Clerk user metadata provides createdAt)
  const rawCreatedAt = clerkUser?.createdAt ?? session.claims?.user_created_at;
  if (rawCreatedAt !== undefined && rawCreatedAt !== null && minAccountAgeMs > 0) {
    const createdAtMs =
      typeof rawCreatedAt === 'number'
        ? (rawCreatedAt < 1e12 ? rawCreatedAt * 1000 : rawCreatedAt)
        : Date.parse(String(rawCreatedAt));

    if (Number.isFinite(createdAtMs)) {
      const accountAgeMs = now - createdAtMs;
      if (accountAgeMs < minAccountAgeMs) {
        const waitMinutes = Math.max(1, Math.ceil((minAccountAgeMs - accountAgeMs) / 60000));
        return {
          ok: false,
          status: 403,
          error: `Account too new: please wait ${waitMinutes} minute${waitMinutes === 1 ? '' : 's'} after signup before submitting community entries.`,
        };
      }
    }
  }

  return { ok: true, status: 200 };
}

export interface SubmissionRateLimitEntry {
  timestamps: number[];
}

const defaultUserSubmissionStore = new Map<string, SubmissionRateLimitEntry>();
const defaultIpSubmissionStore = new Map<string, SubmissionRateLimitEntry>();

/**
 * Checks & records per-user and per-IP sliding-window rate limits for community submissions.
 * Uses D1 persistence when `db` is bound, and falls back/mirrors to an in-memory sliding window store.
 */
export async function checkAndRecordSubmissionRateLimit(params: {
  userId: string;
  clientIp: string;
  titleSlug: string;
  db?: any;
  isAdmin?: boolean;
  windowMs?: number;
  maxPerUser?: number;
  maxPerIp?: number;
  now?: number;
  userStore?: Map<string, SubmissionRateLimitEntry>;
  ipStore?: Map<string, SubmissionRateLimitEntry>;
}): Promise<{ ok: boolean; status: number; retryAfterSeconds?: number; error?: string }> {
  if (params.isAdmin) {
    return { ok: true, status: 200 };
  }

  const now = params.now ?? Date.now();
  const windowMs = params.windowMs ?? DEFAULT_SUBMISSION_WINDOW_MS;
  const maxPerUser = params.maxPerUser ?? DEFAULT_MAX_USER_SUBMISSIONS_PER_WINDOW;
  const maxPerIp = params.maxPerIp ?? DEFAULT_MAX_IP_SUBMISSIONS_PER_WINDOW;
  const cutoffIso = new Date(now - windowMs).toISOString();
  const retryAfterSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  // 1. D1-backed persistent rate limit across Cloudflare isolates (schema managed via migrations/0004_add_community_submissions.sql)
  if (params.db && typeof params.db.prepare === 'function') {
    try {
      const cutoffMs = now - windowMs;
      const userCountRes = await params.db
        .prepare(
          `SELECT COUNT(*) as total, MIN(created_at_ms) as oldest FROM community_submission_logs WHERE user_id = ? AND created_at_ms >= ?`
        )
        .bind(params.userId, cutoffMs)
        .first();

      const userCount = Number(userCountRes?.total || 0);
      if (userCount >= maxPerUser) {
        const oldest = Number(userCountRes?.oldest || now);
        const waitSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        return {
          ok: false,
          status: 429,
          retryAfterSeconds: waitSec,
          error: `Rate limit exceeded: You can submit up to ${maxPerUser} entries every ${Math.round(windowMs / 60000)} minutes. Please try again later.`,
        };
      }

      const ipCountRes = await params.db
        .prepare(
          `SELECT COUNT(*) as total, MIN(created_at_ms) as oldest FROM community_submission_logs WHERE client_ip = ? AND created_at_ms >= ?`
        )
        .bind(params.clientIp, cutoffMs)
        .first();

      const ipCount = Number(ipCountRes?.total || 0);
      if (ipCount >= maxPerIp) {
        const oldest = Number(ipCountRes?.oldest || now);
        const waitSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        return {
          ok: false,
          status: 429,
          retryAfterSeconds: waitSec,
          error: 'Rate limit exceeded: Too many community submissions from this network. Please try again later.',
        };
      }

      await params.db
        .prepare(
          `INSERT INTO community_submission_logs (user_id, client_ip, title_slug, created_at_ms) VALUES (?, ?, ?, ?)`
        )
        .bind(params.userId, params.clientIp, params.titleSlug.slice(0, 120), now)
        .run();

      return { ok: true, status: 200 };
    } catch {
      // Fall through to in-memory sliding-window limiter if D1 log query fails
    }
  }

  // 2. In-memory sliding-window limiter (always active for Node/tests or D1 fallback)
  const userStore = params.userStore || defaultUserSubmissionStore;
  const ipStore = params.ipStore || defaultIpSubmissionStore;
  const cutoffMs = now - windowMs;

  const userEntry = userStore.get(params.userId) || { timestamps: [] };
  userEntry.timestamps = userEntry.timestamps.filter((ts) => ts >= cutoffMs);
  if (userEntry.timestamps.length >= maxPerUser) {
    userStore.set(params.userId, userEntry);
    const oldest = userEntry.timestamps[0] || now;
    const waitSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      ok: false,
      status: 429,
      retryAfterSeconds: waitSec || retryAfterSeconds,
      error: `Rate limit exceeded: You can submit up to ${maxPerUser} entries every ${Math.round(windowMs / 60000)} minutes. Please try again later (cutoff ${cutoffIso}).`,
    };
  }

  const ipEntry = ipStore.get(params.clientIp) || { timestamps: [] };
  ipEntry.timestamps = ipEntry.timestamps.filter((ts) => ts >= cutoffMs);
  if (ipEntry.timestamps.length >= maxPerIp) {
    ipStore.set(params.clientIp, ipEntry);
    const oldest = ipEntry.timestamps[0] || now;
    const waitSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      ok: false,
      status: 429,
      retryAfterSeconds: waitSec || retryAfterSeconds,
      error: 'Rate limit exceeded: Too many community submissions from this network. Please try again later.',
    };
  }

  userEntry.timestamps.push(now);
  userStore.set(params.userId, userEntry);
  ipEntry.timestamps.push(now);
  ipStore.set(params.clientIp, ipEntry);

  return { ok: true, status: 200 };
}

export interface SanitizedCommunitySubmission {
  title: string;
  slug: string;
  synopsis: string;
  cover_image: string;
  banner_image: string;
  watch_url: string;
  rating: number;
  episodes_count: number;
  season: string;
  year: number;
  genres: string;
  languages: string;
  platform: string;
  type: string;
  studio: string;
}

const DEFAULT_SUBMISSION_COVER_URL =
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800';

/**
 * Validates and sanitizes community anime submission payloads (`POST /api/anime/submit`).
 * Checks honeypots, XSS/SQLi patterns, spam heuristics, numeric bounds, and external image URLs.
 */
export function validateAndSanitizeCommunitySubmission(
  body: any
): { ok: boolean; status: number; error?: string; data?: SanitizedCommunitySubmission } {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, error: 'Invalid submission payload.' };
  }

  // 1. Honeypot check for automated bots
  const honeypot = body.website || body.honeypot || body.bot_field || body.company_url;
  if (honeypot !== undefined && honeypot !== null && String(honeypot).trim() !== '') {
    return { ok: false, status: 400, error: 'Spam detected.' };
  }

  const rawTitle = typeof body.title === 'string' ? body.title : '';
  const rawSynopsis = typeof body.synopsis === 'string' ? body.synopsis : '';

  // 2. XSS / SQLi pattern guard
  const combinedRaw = `${rawTitle} ${rawSynopsis} ${body.studio || ''}`;
  if (/<\s*script|javascript:|onerror\s*=|onload\s*=|union\s+select|drop\s+table/i.test(combinedRaw)) {
    return { ok: false, status: 400, error: 'Invalid characters or script content detected.' };
  }

  const cleanTitle = rawTitle.replace(/<[^>]*>/g, '').trim();
  const cleanSynopsis = rawSynopsis.replace(/<[^>]*>/g, '').trim();

  if (cleanTitle.length < 2) {
    return { ok: false, status: 400, error: 'Anime title must be at least 2 characters.' };
  }
  if (cleanTitle.length > 150) {
    return { ok: false, status: 400, error: 'Anime title exceeds maximum length of 150 characters.' };
  }
  if (cleanSynopsis.length > 3000) {
    return { ok: false, status: 400, error: 'Synopsis exceeds maximum length of 3000 characters.' };
  }

  // 3. Spam heuristics (excessive URLs or character flooding)
  const titleUrls = cleanTitle.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || [];
  if (titleUrls.length > 0) {
    return { ok: false, status: 400, error: 'Anime title must not contain URLs.' };
  }
  const synopsisUrls = cleanSynopsis.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || [];
  if (synopsisUrls.length > 2) {
    return { ok: false, status: 400, error: 'Spam detected: Too many links in synopsis.' };
  }
  if (/(.)\1{19,}/.test(cleanTitle) || /(.)\1{19,}/.test(cleanSynopsis)) {
    return { ok: false, status: 400, error: 'Spam detected: Repetitive character pattern.' };
  }

  // 4. External image URL & watch URL format validation
  const rawCover = body.cover_image ?? body.poster_url ?? body.posterUrl ?? body.image ?? body.poster ?? '';
  const coverCheck = validateExternalImageUrl(rawCover, { required: false, fieldName: 'Cover Image URL' });
  if (!coverCheck.ok) {
    return { ok: false, status: 400, error: coverCheck.error };
  }
  const finalCover = coverCheck.url || DEFAULT_SUBMISSION_COVER_URL;

  const rawBanner = body.banner_image ?? body.bannerUrl ?? '';
  const bannerCheck = validateExternalImageUrl(rawBanner, { required: false, fieldName: 'Banner Image URL' });
  if (!bannerCheck.ok) {
    return { ok: false, status: 400, error: bannerCheck.error };
  }
  const finalBanner = bannerCheck.url || finalCover;

  const rawWatchUrl = body.watch_url ?? body.watchUrl ?? '';
  const watchCheck = validateOptionalExternalWebUrl(rawWatchUrl, 'Watch URL');
  if (!watchCheck.ok) {
    return { ok: false, status: 400, error: watchCheck.error };
  }

  // 5. Numeric bounds & metadata sanitization
  const parsedRating = body.rating !== undefined && body.rating !== '' ? Number(body.rating) : 8.0;
  if (!Number.isFinite(parsedRating) || parsedRating < 0 || parsedRating > 10) {
    return { ok: false, status: 400, error: 'Rating must be between 0 and 10.' };
  }

  const rawEp = body.episodes_count ?? body.episodes;
  const parsedEpisodes = rawEp !== undefined && rawEp !== '' ? parseInt(String(rawEp), 10) : 12;
  if (!Number.isFinite(parsedEpisodes) || parsedEpisodes < 1 || parsedEpisodes > 5000) {
    return { ok: false, status: 400, error: 'Episode count must be between 1 and 5000.' };
  }

  const parsedYear = body.year !== undefined && body.year !== '' ? parseInt(String(body.year), 10) : 2026;
  if (!Number.isFinite(parsedYear) || parsedYear < 1950 || parsedYear > 2100) {
    return { ok: false, status: 400, error: 'Release year must be between 1950 and 2100.' };
  }

  const slug = cleanTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `anime-${Date.now()}`;

  const cleanField = (val: unknown, fallback: string, maxLen: number) => {
    if (typeof val !== 'string') return fallback;
    const stripped = val.replace(/<[^>]*>/g, '').trim();
    return (stripped || fallback).slice(0, maxLen);
  };

  return {
    ok: true,
    status: 200,
    data: {
      title: cleanTitle,
      slug,
      synopsis: cleanSynopsis,
      cover_image: finalCover,
      banner_image: finalBanner,
      watch_url: watchCheck.url || '',
      rating: Number(parsedRating.toFixed(1)),
      episodes_count: parsedEpisodes,
      season: cleanField(body.season, 'Spring', 30),
      year: parsedYear,
      genres: cleanField(Array.isArray(body.genres) ? body.genres.join(',') : body.genres, 'Action', 250),
      languages: cleanField(Array.isArray(body.languages) ? body.languages.join(',') : body.languages, 'Tamil, Hindi', 200),
      platform: cleanField(Array.isArray(body.platform) ? body.platform.join(',') : body.platform, 'Crunchyroll', 150),
      type: cleanField(body.type, 'TV Series', 40),
      studio: cleanField(body.studio, 'Unknown Studio', 100),
    },
  };
}
