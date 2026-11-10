/**
 * Utility to clean watch links and streaming URLs by stripping tracking parameters,
 * UTM tags, query strings, and hashes, leaving only the clean canonical base URL.
 *
 * Example:
 * 'https://www.crunchyroll.com/series/G6W4QKX0R/the-rising-of-the-shield-hero?utm_medium=android&utm_source=share'
 *  -> 'https://www.crunchyroll.com/series/G6W4QKX0R/the-rising-of-the-shield-hero'
 */
export const cleanWatchUrl = (rawUrl?: string | null): string => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      // Return origin + pathname, stripping query string (?) and hash fragments (#)
      return `${parsed.origin}${parsed.pathname}`;
    }
    return trimmed.split('?')[0].split('#')[0].trim();
  } catch {
    // Fallback if URL constructor fails (e.g. malformed or relative link)
    return trimmed.split('?')[0].split('#')[0].trim();
  }
};
