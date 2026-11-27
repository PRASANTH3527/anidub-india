/**
 * Pure domain logic, validators, and safe URL parsers for AniDub India — Anime Details 2.0 (Phase 2).
 *
 * Covers:
 * - Regional 5-Slider Dub Quality Reviews (scoring, validation, real aggregates)
 * - Anime Universe & Smart Watch Order sorting
 * - Verified Characters & Indian Voice Actors grouping
 * - Strict YouTube official trailer parsing & privacy-enhanced embed URL construction
 */

export interface DubReviewScores {
  voice_acting: number;
  voice_casting: number;
  translation_quality: number;
  lip_sync: number;
  emotional_delivery: number;
}

export type DubReviewDimensionKey = keyof DubReviewScores;

export interface DubReviewDimensionMeta {
  key: DubReviewDimensionKey;
  label: string;
  shortLabel: string;
  description: string;
}

export const DUB_REVIEW_DIMENSIONS: readonly DubReviewDimensionMeta[] = [
  {
    key: 'voice_acting',
    label: 'Voice Acting',
    shortLabel: 'Acting',
    description: 'Performance energy, clarity, and consistency',
  },
  {
    key: 'voice_casting',
    label: 'Voice Casting',
    shortLabel: 'Casting',
    description: 'How well voices match each character',
  },
  {
    key: 'translation_quality',
    label: 'Translation Quality',
    shortLabel: 'Script',
    description: 'Natural Indian localization and dialogue flow',
  },
  {
    key: 'lip_sync',
    label: 'Lip Sync',
    shortLabel: 'Lip Sync',
    description: 'Timing alignment with mouth movements',
  },
  {
    key: 'emotional_delivery',
    label: 'Emotional Delivery',
    shortLabel: 'Emotion',
    description: 'Impact during dramatic and comedic scenes',
  },
] as const;

export interface DubReviewRecord extends DubReviewScores {
  id: number;
  anime_id: string;
  user_id?: string;
  user_name: string;
  dub_language: string;
  overall_score: number;
  review_text: string | null;
  has_spoilers: boolean;
  status: 'published' | 'hidden' | 'flagged';
  is_owner?: boolean;
  created_at: string;
  updated_at: string;
}

export interface DubReviewAggregate {
  count: number;
  overall: number | null;
  voice_acting: number | null;
  voice_casting: number | null;
  translation_quality: number | null;
  lip_sync: number | null;
  emotional_delivery: number | null;
}

export interface FranchiseLinkItem {
  id?: number;
  franchise_key: string;
  anime_id: string;
  relation_label: string;
  watch_order: number;
  note: string | null;
  title: string;
  slug?: string;
  poster?: string;
  release_year?: number;
  status?: string;
  episodes_count?: number;
  languages?: string[];
  is_current?: boolean;
}

export interface VerifiedCastEntry {
  id: number;
  anime_id: string;
  character_name: string;
  role: string;
  voice_actor_name: string;
  dub_language: string;
  character_image: string | null;
  actor_image: string | null;
  verified: boolean;
  updated_at?: string;
}

export interface OfficialTrailerInfo {
  videoId: string;
  embedUrl: string;
  thumbnailUrl: string;
  watchUrl: string;
}

export function isMissingDetailsV2TableError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '').toLowerCase();
  return (
    msg.includes('no such table') ||
    msg.includes('dub_reviews') ||
    msg.includes('anime_franchise_links') ||
    msg.includes('anime_cast_entries')
  );
}

function roundOneDecimal(val: number): number {
  return Math.round(val * 10) / 10;
}

/**
 * Computes deterministic 1-decimal overall dub quality score across all 5 criteria.
 */
export function computeOverallDubScore(scores: DubReviewScores): number {
  const sum =
    scores.voice_acting +
    scores.voice_casting +
    scores.translation_quality +
    scores.lip_sync +
    scores.emotional_delivery;
  return roundOneDecimal(sum / 5);
}

/**
 * Validates and sanitizes incoming regional 5-slider dub review payload.
 */
export function validateDubReviewPayload(input: Record<string, unknown>): {
  ok: true;
  data: DubReviewScores & {
    dub_language: string;
    overall_score: number;
    review_text: string | null;
    has_spoilers: number;
  };
} | {
  ok: false;
  error: string;
} {
  const dubLanguage = String(input.dub_language || '').trim();
  if (!dubLanguage || dubLanguage.length > 40) {
    return { ok: false, error: 'Please select a valid dub language.' };
  }

  const parseScore = (raw: unknown, label: string): number | string => {
    const num = Number(raw);
    if (!Number.isInteger(num) || num < 1 || num > 10) {
      return `${label} score must be an integer between 1 and 10.`;
    }
    return num;
  };

  const voice_acting = parseScore(input.voice_acting, 'Voice Acting');
  if (typeof voice_acting === 'string') return { ok: false, error: voice_acting };

  const voice_casting = parseScore(input.voice_casting, 'Voice Casting');
  if (typeof voice_casting === 'string') return { ok: false, error: voice_casting };

  const translation_quality = parseScore(input.translation_quality, 'Translation Quality');
  if (typeof translation_quality === 'string') return { ok: false, error: translation_quality };

  const lip_sync = parseScore(input.lip_sync, 'Lip Sync');
  if (typeof lip_sync === 'string') return { ok: false, error: lip_sync };

  const emotional_delivery = parseScore(input.emotional_delivery, 'Emotional Delivery');
  if (typeof emotional_delivery === 'string') return { ok: false, error: emotional_delivery };

  const rawText = typeof input.review_text === 'string' ? input.review_text.trim() : '';
  if (rawText.length > 2000) {
    return { ok: false, error: 'Review text must be 2000 characters or fewer.' };
  }

  const autoSpoiler = rawText.length > 0 && /spoiler|dies|death|ending|betray|final boss/i.test(rawText);
  const hasSpoilers = Boolean(input.has_spoilers) || autoSpoiler ? 1 : 0;

  const scores: DubReviewScores = {
    voice_acting,
    voice_casting,
    translation_quality,
    lip_sync,
    emotional_delivery,
  };

  return {
    ok: true,
    data: {
      dub_language: dubLanguage,
      ...scores,
      overall_score: computeOverallDubScore(scores),
      review_text: rawText.length > 0 ? rawText : null,
      has_spoilers: hasSpoilers,
    },
  };
}

/**
 * Computes strictly honest aggregate scores from real published reviews.
 * Returns null averages when zero reviews exist (never invents fake scores).
 */
export function computeDubReviewAggregates(reviews: DubReviewRecord[]): DubReviewAggregate {
  const published = reviews.filter((r) => r.status === 'published');
  if (published.length === 0) {
    return {
      count: 0,
      overall: null,
      voice_acting: null,
      voice_casting: null,
      translation_quality: null,
      lip_sync: null,
      emotional_delivery: null,
    };
  }

  const n = published.length;
  const avg = (picker: (r: DubReviewRecord) => number) =>
    roundOneDecimal(published.reduce((sum, item) => sum + picker(item), 0) / n);

  return {
    count: n,
    overall: avg((r) => Number(r.overall_score) || computeOverallDubScore(r)),
    voice_acting: avg((r) => r.voice_acting),
    voice_casting: avg((r) => r.voice_casting),
    translation_quality: avg((r) => r.translation_quality),
    lip_sync: avg((r) => r.lip_sync),
    emotional_delivery: avg((r) => r.emotional_delivery),
  };
}

/**
 * Computes per-language breakdown map from published dub reviews.
 */
export function computeDubReviewAggregatesByLanguage(
  reviews: DubReviewRecord[]
): Record<string, DubReviewAggregate> {
  const grouped = new Map<string, DubReviewRecord[]>();
  for (const rev of reviews) {
    if (rev.status !== 'published') continue;
    const lang = rev.dub_language.trim();
    if (!lang) continue;
    const list = grouped.get(lang) || [];
    list.push(rev);
    grouped.set(lang, list);
  }
  const result: Record<string, DubReviewAggregate> = {};
  for (const [lang, list] of grouped.entries()) {
    result[lang] = computeDubReviewAggregates(list);
  }
  return result;
}

/**
 * Strictly extracts a verified 11-character YouTube video ID from official YouTube URLs.
 * Rejects non-YouTube hosts, javascript:, data:, and arbitrary embed URLs.
 */
const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const ALLOWED_YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export function extractOfficialYouTubeVideoId(rawInput: unknown): string | null {
  if (typeof rawInput !== 'string') return null;
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  if (YOUTUBE_VIDEO_ID_RE.test(trimmed)) {
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_YOUTUBE_HOSTS.has(host)) {
    return null;
  }

  let candidate: string | null = null;
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    candidate = parsed.pathname.replace(/^\/+/, '').split('/')[0] || null;
  } else if (parsed.pathname === '/watch') {
    candidate = parsed.searchParams.get('v');
  } else if (
    parsed.pathname.startsWith('/embed/') ||
    parsed.pathname.startsWith('/shorts/') ||
    parsed.pathname.startsWith('/live/')
  ) {
    candidate = parsed.pathname.split('/')[2] || null;
  }

  if (candidate && YOUTUBE_VIDEO_ID_RE.test(candidate)) {
    return candidate;
  }
  return null;
}

export function buildOfficialTrailerInfo(rawInput: unknown): OfficialTrailerInfo | null {
  const videoId = extractOfficialYouTubeVideoId(rawInput);
  if (!videoId) return null;
  return {
    videoId,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

export function resolveOfficialTrailerFromAnime(
  anime: Record<string, any> | null | undefined
): OfficialTrailerInfo | null {
  if (!anime) return null;
  const candidates = [
    anime.trailerUrl,
    anime.trailer_url,
    anime.trailerYoutubeId,
    anime.trailer_youtube_id,
    anime.youtube_trailer,
    anime.trailer,
  ];
  for (const candidate of candidates) {
    const resolved = buildOfficialTrailerInfo(candidate);
    if (resolved) return resolved;
  }
  return null;
}

/**
 * Sorts Anime Universe entries strictly by watch_order ascending, then release_year.
 */
export function sortSmartWatchOrderEntries(
  entries: FranchiseLinkItem[],
  currentAnimeId?: string | number
): FranchiseLinkItem[] {
  const currentStr = currentAnimeId !== undefined ? String(currentAnimeId) : null;
  return [...entries]
    .sort((a, b) => {
      if (a.watch_order !== b.watch_order) return a.watch_order - b.watch_order;
      return (a.release_year || 9999) - (b.release_year || 9999);
    })
    .map((entry) => ({
      ...entry,
      is_current: currentStr !== null ? String(entry.anime_id) === currentStr : entry.is_current,
    }));
}

/**
 * Groups verified cast entries by dub language, ordering Main roles ahead of Supporting roles.
 */
export function groupVerifiedCastByLanguage(
  entries: VerifiedCastEntry[]
): { languages: string[]; byLanguage: Record<string, VerifiedCastEntry[]> } {
  const roleWeight = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('main')) return 1;
    if (r.includes('support')) return 2;
    return 3;
  };

  const langPriority: Record<string, number> = {
    Tamil: 1,
    Hindi: 2,
    Telugu: 3,
    Malayalam: 4,
    Kannada: 5,
    Bengali: 6,
  };

  const byLanguage: Record<string, VerifiedCastEntry[]> = {};
  for (const entry of entries) {
    if (!entry.verified) continue;
    const lang = String(entry.dub_language || '').trim();
    if (!lang) continue;
    if (!byLanguage[lang]) byLanguage[lang] = [];
    byLanguage[lang].push(entry);
  }

  for (const lang of Object.keys(byLanguage)) {
    byLanguage[lang].sort((a, b) => {
      const rw = roleWeight(a.role) - roleWeight(b.role);
      if (rw !== 0) return rw;
      return a.character_name.localeCompare(b.character_name);
    });
  }

  const languages = Object.keys(byLanguage).sort(
    (a, b) => (langPriority[a] ?? 99) - (langPriority[b] ?? 99) || a.localeCompare(b)
  );

  return { languages, byLanguage };
}

/**
 * Validates optional external HTTPS portrait URLs for cast entries (blocks javascript:/data:/http:).
 */
export function sanitizeOptionalHttpsImageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host === '169.254.169.254'
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
