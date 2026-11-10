/**
 * Streaming Watch URL Utility
 * Preserves platform streaming URLs (Crunchyroll, Netflix, JioCinema, Hotstar, Prime Video, YouTube, etc.)
 * EXACTLY as entered by the admin/user, retaining all query parameters, session IDs, and deep links.
 */
export const cleanWatchUrl = (rawUrl?: string | null): string => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  return rawUrl.trim();
};
