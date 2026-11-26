/**
 * Builds an official Indian OTT platform redirect or search URL.
 * Always prioritizes a verified direct URL when present.
 */
export function generateOttUrl(
  platform: string,
  animeTitle: string,
  directUrl?: string | null
): string {
  if (directUrl && typeof directUrl === 'string' && directUrl.trim().startsWith('http')) {
    return directUrl.trim();
  }

  const encoded = encodeURIComponent((animeTitle || '').trim());
  const lower = (platform || '').toLowerCase();

  if (lower.includes('crunchyroll')) {
    return `https://www.crunchyroll.com/search?q=${encoded}`;
  }
  if (lower.includes('netflix')) {
    return `https://www.netflix.com/search?q=${encoded}`;
  }
  if (lower.includes('prime')) {
    return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encoded}`;
  }
  if (lower.includes('hotstar') || lower.includes('jio')) {
    return `https://www.hotstar.com/in/explore?search_query=${encoded}`;
  }
  if (lower.includes('sonyliv') || lower.includes('sony')) {
    return `https://www.sonyliv.com/search?q=${encoded}`;
  }
  if (lower.includes('muse')) {
    return `https://www.youtube.com/@MuseAsia/search?query=${encoded}`;
  }
  if (lower.includes('ani-one')) {
    return `https://www.youtube.com/@AniOneAsia/search?query=${encoded}`;
  }
  if (lower.includes('youtube')) {
    return `https://www.youtube.com/results?search_query=${encoded}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(`${animeTitle} ${platform} India stream`)}`;
}
