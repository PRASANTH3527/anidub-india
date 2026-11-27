import { normalizeLanguageName, isExcludedLanguage } from './utils/languages';
import { normalizeCanonicalOttList } from './utils/ottHub';
import { resolveCanonicalAnimeStatus } from './utils/animeStatus';

export type DubLanguage =
  | 'Tamil'
  | 'Hindi'
  | 'Telugu'
  | 'Malayalam'
  | 'Kannada'
  | 'Bengali'
  | 'Marathi'
  | 'Gujarati'
  | 'Punjabi'
  | 'English'
  | 'Japanese'
  | string;

export type StreamingPlatform =
  | 'Crunchyroll'
  | 'Netflix'
  | 'Prime Video'
  | 'JioHotstar'
  | 'JioCinema'
  | 'Disney+ Hotstar'
  | 'Muse Asia'
  | 'Ani-One Asia'
  | 'SonyLIV'
  | 'YouTube'
  | string;

export type WatchlistStatus =
  | 'Watching'
  | 'Completed'
  | 'On Hold'
  | 'Dropped'
  | 'Plan to Watch'
  | 'Rewatching';

export interface WatchlistItem {
  id: string;
  status: WatchlistStatus;
  addedAt: number;
  progress?: number;
}

export interface Anime {
  id: string;
  slug?: string;
  title: string;
  japaneseTitle?: string;
  synopsis: string;
  poster: string;
  cover_image?: string;
  image?: string;
  bannerImage?: string;
  releaseYear?: number;
  status: 'Airing' | 'Completed' | 'Upcoming' | string;
  episodesCount?: number;
  rating?: number;
  userRatingsCount?: number;
  userRatingsSum?: number;
  languages: DubLanguage[];
  platforms: StreamingPlatform[];
  streamingLinks?: Record<string, string>;
  genres: string[];
  studio?: string;
  broadcastDay?: string;
  broadcastTime?: string;
  lastUpdated?: string;
  localizedTitle?: string | null;
  localizedSynopsis?: string | null;
  localizedDescription?: string | null;
  translationLocale?: string | null;
  hasPublishedTranslation?: boolean;
  [key: string]: any;
}

export function parseLanguageArray(rawLangs: unknown): string[] {
  const tokens: string[] = [];
  if (Array.isArray(rawLangs)) {
    for (const item of rawLangs) {
      if (typeof item === 'string') {
        tokens.push(...item.split(/[,/|•+·]+/));
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        if (typeof obj.language === 'string') tokens.push(obj.language);
        if (typeof obj.name === 'string') tokens.push(obj.name);
      }
    }
  } else if (typeof rawLangs === 'string') {
    tokens.push(...rawLangs.split(/[,/|•+·]+/));
  }

  const order: Record<string, number> = {
    Tamil: 1,
    Hindi: 2,
    Telugu: 3,
    Malayalam: 4,
    Kannada: 5,
    Bengali: 6,
    Marathi: 7,
    Gujarati: 8,
    Punjabi: 9,
  };

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const tok of tokens) {
    const norm = normalizeLanguageName(tok);
    if (!norm || isExcludedLanguage(norm)) continue;
    if (!seen.has(norm)) {
      seen.add(norm);
      unique.push(norm);
    }
  }
  return unique.sort((a, b) => (order[a] ?? 99) - (order[b] ?? 99));
}

export function parseGenreArray(rawGenres: unknown): string[] {
  if (Array.isArray(rawGenres)) {
    return rawGenres.map((g) => String(g || '').trim()).filter(Boolean);
  }
  if (typeof rawGenres === 'string' && rawGenres.trim()) {
    return rawGenres
      .split(/[,/|•]+/)
      .map((g) => g.trim())
      .filter(Boolean);
  }
  return [];
}

export function extractStreamingLinksMap(raw: any): Record<string, string> {
  const map: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return map;

  if (raw.streamingLinks && typeof raw.streamingLinks === 'object') {
    for (const [k, v] of Object.entries(raw.streamingLinks)) {
      if (typeof v === 'string' && v.trim().startsWith('http')) {
        map[k] = v.trim();
      }
    }
  }

  const parsePartnerArray = (candidate: unknown) => {
    let arr = candidate;
    if (typeof candidate === 'string' && candidate.trim().startsWith('[')) {
      try {
        arr = JSON.parse(candidate);
      } catch {
        arr = [];
      }
    }
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (item && typeof item === 'object') {
          const name = String((item as any).name || (item as any).platform || '').trim();
          const url = String((item as any).url || '').trim();
          if (name && url.startsWith('http')) {
            map[name] = url;
          }
        }
      }
    }
  };

  parsePartnerArray(raw.platforms_data);
  parsePartnerArray(raw.streaming_partners);
  parsePartnerArray(raw.streamingPartners);
  parsePartnerArray(raw.platforms);

  return map;
}

export function normalizeAnimeRecord(raw: any): Anime {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '0',
      title: 'Unknown Anime',
      synopsis: '',
      poster: '/logo.png',
      status: 'Completed',
      languages: [],
      platforms: [],
      genres: [],
    };
  }

  const idStr = String(raw.id ?? raw.anime_id ?? raw._id ?? '');
  const poster =
    String(
      raw.poster ||
        raw.cover_image ||
        raw.image ||
        raw.posterUrl ||
        raw.poster_url ||
        raw.banner_image ||
        ''
    ).trim() || '/logo.png';

  const languages = parseLanguageArray(raw.languages);
  const canonicalPlatforms = normalizeCanonicalOttList(raw);
  const explicitPlatforms = Array.isArray(raw.platforms)
    ? raw.platforms
        .map((p: any) => (typeof p === 'string' ? p.trim() : String(p?.name || p?.platform || '').trim()))
        .filter((p: string) => Boolean(p && p.toLowerCase() !== 'unknown' && p.toLowerCase() !== 'not verified'))
    : [];
  const platforms = canonicalPlatforms.length > 0 ? canonicalPlatforms : explicitPlatforms;

  const streamingLinks = extractStreamingLinksMap(raw);
  const genres = parseGenreArray(raw.genres ?? raw.genre);

  const rawEps = Number(raw.episodesCount ?? raw.episodes_count ?? raw.episodes ?? raw.episode_count);
  const episodesCount = Number.isFinite(rawEps) && rawEps > 0 ? Math.round(rawEps) : undefined;

  const rawYear = Number(raw.releaseYear ?? raw.year ?? raw.release_year);
  const releaseYear = Number.isFinite(rawYear) && rawYear > 1900 ? Math.round(rawYear) : undefined;

  const rawRating = Number(raw.rating);
  const rating = Number.isFinite(rawRating) && rawRating > 0 ? rawRating : undefined;

  const canonicalStatus = resolveCanonicalAnimeStatus(raw);
  const status =
    canonicalStatus === 'Airing'
      ? 'Airing'
      : canonicalStatus === 'Upcoming'
        ? 'Upcoming'
        : raw.status === 'Airing' || raw.status === 'Upcoming'
          ? raw.status
          : 'Completed';

  const broadcastDay =
    String(raw.broadcastDay ?? raw.broadcast_day ?? raw.releaseDay ?? '').trim() || undefined;
  const broadcastTime =
    String(raw.broadcastTime ?? raw.broadcast_time ?? raw.airTime ?? '').trim() || undefined;

  return {
    ...raw,
    id: idStr,
    title: String(raw.title || 'Untitled Anime').trim(),
    japaneseTitle: raw.japaneseTitle || raw.hindiTitle || undefined,
    synopsis: String(raw.synopsis || raw.description || '').trim(),
    poster,
    cover_image: raw.cover_image || poster,
    image: raw.image || poster,
    releaseYear,
    status,
    episodesCount,
    rating,
    userRatingsCount: Number(raw.userRatingsCount ?? raw.community_votes ?? raw.communityVotes) || undefined,
    userRatingsSum:
      raw.userRatingsSum ??
      (raw.community_rating && raw.community_votes
        ? Number(raw.community_rating) * Number(raw.community_votes)
        : undefined),
    languages,
    platforms,
    streamingLinks,
    genres,
    studio: typeof raw.studio === 'string' ? raw.studio.trim() : undefined,
    broadcastDay,
    broadcastTime,
    lastUpdated: raw.lastUpdated || raw.last_verified_at || raw.updated_at || raw.created_at || undefined,
    localizedTitle:
      typeof (raw.localizedTitle ?? raw.localized_title) === 'string' &&
      String(raw.localizedTitle ?? raw.localized_title).trim()
        ? String(raw.localizedTitle ?? raw.localized_title).trim()
        : null,
    localizedSynopsis:
      typeof (raw.localizedSynopsis ?? raw.localized_synopsis) === 'string' &&
      String(raw.localizedSynopsis ?? raw.localized_synopsis).trim()
        ? String(raw.localizedSynopsis ?? raw.localized_synopsis).trim()
        : null,
    localizedDescription:
      typeof (raw.localizedDescription ?? raw.localized_description) === 'string' &&
      String(raw.localizedDescription ?? raw.localized_description).trim()
        ? String(raw.localizedDescription ?? raw.localized_description).trim()
        : null,
    translationLocale:
      typeof (raw.translationLocale ?? raw.translation_locale) === 'string' &&
      String(raw.translationLocale ?? raw.translation_locale).trim()
        ? String(raw.translationLocale ?? raw.translation_locale).trim()
        : null,
    hasPublishedTranslation: Boolean(raw.hasPublishedTranslation ?? raw.has_published_translation),
  };
}

export function normalizeAnimeList(rawList: unknown): Anime[] {
  if (!Array.isArray(rawList)) return [];
  return rawList.filter(Boolean).map((item) => normalizeAnimeRecord(item));
}

export function normalizeWatchlistProp(
  rawWatchlist: unknown,
  rawCatalog?: unknown
): { items: WatchlistItem[]; animePool: Anime[] } {
  const catalogAnime = normalizeAnimeList(rawCatalog);
  const byId = new Map<string, Anime>();
  for (const a of catalogAnime) {
    byId.set(String(a.id), a);
  }

  let statusMap: Record<string, WatchlistStatus> = {};
  try {
    statusMap = JSON.parse(localStorage.getItem('anidub_watchlist_status_v2') || '{}');
  } catch {
    statusMap = {};
  }

  const items: WatchlistItem[] = [];
  if (Array.isArray(rawWatchlist)) {
    rawWatchlist.forEach((entry, idx) => {
      if (typeof entry === 'number' || typeof entry === 'string') {
        const id = String(entry);
        items.push({
          id,
          status: statusMap[id] || 'Plan to Watch',
          addedAt: Date.now() - idx * 1000,
        });
      } else if (entry && typeof entry === 'object') {
        const id = String((entry as any).id ?? (entry as any).anime_id ?? '');
        if (!id) return;
        // If entry itself is a full anime object (from App.tsx realSavedWatchlist), add it to animePool
        if ((entry as any).title) {
          const norm = normalizeAnimeRecord(entry);
          byId.set(String(norm.id), norm);
        }
        const rawStatus = (entry as any).watchStatus || statusMap[id];
        const validStatuses: WatchlistStatus[] = [
          'Watching',
          'Completed',
          'On Hold',
          'Dropped',
          'Plan to Watch',
          'Rewatching',
        ];
        const status: WatchlistStatus = validStatuses.includes(rawStatus)
          ? rawStatus
          : validStatuses.includes((entry as any).status)
            ? (entry as any).status
            : 'Plan to Watch';
        items.push({
          id,
          status,
          addedAt: Number((entry as any).addedAt) || Date.now() - idx * 1000,
          progress: Number((entry as any).progress) || undefined,
        });
      }
    });
  }

  return {
    items,
    animePool: Array.from(byId.values()),
  };
}
