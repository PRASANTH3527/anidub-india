/**
 * SSRF-safe URL validation & HTTP link health classification for Admin Link Health Checker.
 *
 * SECURITY:
 * - Strictly restricts outbound checks to public http/https URLs.
 * - Blocks localhost, loopback, RFC1918 private IPv4 ranges, link-local / cloud metadata IPs
 *   (169.254.169.254), carrier-grade NAT (100.64.0.0/10), IPv6 loopback/ULA/link-local,
 *   and internal hostnames (.local, .internal, .localhost).
 */

export type LinkHealthStatus =
  | 'Active'
  | 'Redirected'
  | 'Broken'
  | 'Region-restricted'
  | 'Unverified';

export interface LinkUrlValidationResult {
  ok: boolean;
  url?: string;
  reason?: string;
}

const PRIVATE_HOST_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.home', '.arpa'];

function isPrivateOrReservedIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;

  const [a, b] = nums;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // multicast & reserved
  return false;
}

function isPrivateOrReservedIpv6(host: string): boolean {
  const clean = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!clean.includes(':')) return false;
  if (clean === '::' || clean === '::1') return true;
  if (clean.startsWith('fc') || clean.startsWith('fd')) return true; // Unique local fc00::/7
  if (clean.startsWith('fe8') || clean.startsWith('fe9') || clean.startsWith('fea') || clean.startsWith('feb')) {
    return true; // Link-local fe80::/10
  }
  if (clean.startsWith('::ffff:')) {
    const mapped = clean.slice('::ffff:'.length);
    if (isPrivateOrReservedIpv4(mapped)) return true;
  }
  return false;
}

export function isSafePublicHttpUrl(rawUrl: unknown): LinkUrlValidationResult {
  if (typeof rawUrl !== 'string') {
    return { ok: false, reason: 'URL is missing' };
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, reason: 'URL is empty' };
  }
  if (trimmed.length > 2048) {
    return { ok: false, reason: 'URL exceeds maximum allowed length' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'Malformed URL' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'Only http and https URLs are permitted' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'URLs with embedded credentials are not allowed' };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || host === 'localhost' || host === 'metadata.google.internal' || host === 'metadata') {
    return { ok: false, reason: 'Internal or loopback host is blocked' };
  }

  if (PRIVATE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return { ok: false, reason: 'Private network hostname is blocked' };
  }

  if (!host.includes('.') && !host.includes(':')) {
    return { ok: false, reason: 'Single-label internal hostname is blocked' };
  }

  if (isPrivateOrReservedIpv4(host) || isPrivateOrReservedIpv6(host)) {
    return { ok: false, reason: 'Private or reserved IP address is blocked' };
  }

  // Block integer/hex IP encodings like http://2130706433 or http://0x7f000001
  if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) {
    return { ok: false, reason: 'Numeric IP encoding is blocked' };
  }

  return { ok: true, url: parsed.toString() };
}

export function classifyLinkHealthStatus(
  httpStatus: number | null,
  options?: { errorMessage?: string | null; locationHeader?: string | null }
): { status: LinkHealthStatus; detail: string } {
  const err = (options?.errorMessage || '').trim();
  if (httpStatus === null || !Number.isFinite(httpStatus)) {
    if (err.toLowerCase().includes('abort') || err.toLowerCase().includes('timeout')) {
      return { status: 'Unverified', detail: 'Request timed out before response' };
    }
    return { status: 'Unverified', detail: err || 'Network unreachable or blocked by remote host' };
  }

  if (httpStatus >= 200 && httpStatus < 300) {
    return {
      status: 'Active',
      detail: `HTTP ${httpStatus} OK — URL responds (dub audio still requires manual check)`,
    };
  }

  if (httpStatus >= 300 && httpStatus < 400) {
    const loc = options?.locationHeader ? ` → ${options.locationHeader.slice(0, 90)}` : '';
    return {
      status: 'Redirected',
      detail: `HTTP ${httpStatus} Redirect${loc}`,
    };
  }

  if (httpStatus === 403 || httpStatus === 451) {
    return {
      status: 'Region-restricted',
      detail: `HTTP ${httpStatus} — Likely geo-blocked or bot-protected by OTT provider`,
    };
  }

  if (httpStatus === 404 || httpStatus === 410 || httpStatus >= 500) {
    return {
      status: 'Broken',
      detail: `HTTP ${httpStatus} — Link unavailable or server error`,
    };
  }

  if (httpStatus === 405 || httpStatus === 429) {
    return {
      status: 'Unverified',
      detail: `HTTP ${httpStatus} — Remote server rate-limited or disallowed probe`,
    };
  }

  return {
    status: 'Unverified',
    detail: `HTTP ${httpStatus} — Manual check recommended`,
  };
}
