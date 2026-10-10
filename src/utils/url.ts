/**
 * Utility to sanitize and format site base URL cleanly.
 * Strips any accidental markdown brackets or trailing slashes.
 */
export function getBaseUrl(): string {
  let raw = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://anidub.in';
  
  // Clean markdown wrapping like [https://anidub.in](https://anidub.in)
  if (raw.includes('[') || raw.includes('(')) {
    const match = raw.match(/https?:\/\/[^\s)\]]+/);
    if (match) {
      raw = match[0];
    }
  }

  // Fallback if empty or invalid
  if (!raw || !raw.startsWith('http')) {
    raw = 'https://anidub.in';
  }

  return raw.replace(/\/+$/, '');
}
