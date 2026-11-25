/**
 * Search, Saved Language Preference, Shareable Filter URLs & Alias Matching for AniDub India.
 */
import { normalizeLanguageName } from './languages';
import { normalizeCanonicalOttName } from './ottHub';
import {
  readScopedJson,
  readScopedString,
  writeScopedJson,
  writeScopedString,
  type SimpleStorageLike,
} from './accountIsolation';

export const PREFERRED_LANGUAGE_STORAGE_KEY = 'anidub_preferred_language_v1';
export const RECENT_SEARCHES_STORAGE_KEY = 'anidub_recent_searches_v1';
export const MAX_RECENT_SEARCHES = 8;

export interface CatalogUrlFilterState {
  search?: string;
  language?: string;
  platform?: string;
  genre?: string;
  type?: string;
  status?: string;
  sort?: string;
}

/**
 * Curated bidirectional English <-> Japanese/Romaji/popular alias dictionary
 * so users searching either "Kimetsu no Yaiba" or "Demon Slayer" (or "JJK", "AOT", etc.)
 * reliably discover the matching anime in both client filtering and backend SQL search.
 */
export const ANIME_TITLE_ALIAS_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  ['attack on titan', 'shingeki no kyojin', 'aot'],
  ['demon slayer', 'kimetsu no yaiba', 'kny'],
  ['jujutsu kaisen', 'jjk', 'sorcery fight'],
  ['my hero academia', 'boku no hero academia', 'mha', 'bnha'],
  ['one piece', 'wan pisu'],
  ['naruto', 'naruto shippuden', 'naruto shippuuden'],
  ['spy x family', 'spy family'],
  ['chainsaw man', 'csm'],
  ['solo leveling', 'ore dake level up na ken', 'na honjaman level up'],
  ['vinland saga'],
  ['bleach', 'bleach thousand year blood war', 'tybw'],
  ['dragon ball', 'dragon ball z', 'dragon ball super', 'dbz', 'dbs'],
  ['fullmetal alchemist', 'hagane no renkinjutsushi', 'fma', 'fmab'],
  ['death note', 'desu noto'],
  ['hunter x hunter', 'hxh'],
  ['dandadan', 'dan da dan'],
  ['kaiju no. 8', 'kaiju no 8', 'kaijuu 8-gou'],
  ['frieren', 'sousou no frieren', 'beyond journeys end'],
  ['oshi no ko', 'my star'],
  ['blue lock', 'bururokku'],
  ['haikyuu', 'haikyu'],
  ['tokyo revengers'],
  ['black clover'],
  ['dr. stone', 'dr stone', 'doctor stone'],
  ['mashle', 'magic and muscles'],
  ['wind breaker'],
  ['sakamoto days'],
  ['shangri-la frontier', 'shangrila frontier', 'shanfro'],
  ['re:zero', 're zero', 'rezero'],
  ['sword art online', 'sao'],
  ['mushoku tensei', 'jobless reincarnation'],
  ['that time i got reincarnated as a slime', 'tensei shitara slime datta ken', 'tensura'],
  ["hell's paradise", 'hells paradise', 'jigokuraku'],
  ['tower of god', 'kami no tou'],
  ['classroom of the elite', 'youkoso jitsuryoku shijou shugi no kyoushitsu e', 'cote'],
  ['mob psycho 100', 'mob psycho'],
  ['one punch man', 'one-punch man', 'wanpanman', 'opm'],
  ['cowboy bebop'],
  ['neon genesis evangelion', 'shinseiki evangelion', 'eva'],
  ['steins;gate', 'steins gate'],
  ['code geass', 'lelouch of the rebellion'],
  ['gintama'],
  ["jojo's bizarre adventure", 'jojos bizarre adventure', 'jojo', 'jjba'],
  ['detective conan', 'meitantei conan', 'case closed'],
  ['pokemon', 'pocket monsters'],
  ['doraemon'],
  ['shin chan', 'crayon shin-chan', 'crayon shinchan'],
  ['your name', 'kimi no na wa'],
  ['suzume', 'suzume no tojimari'],
  ['spirited away', 'sen to chihiro no kamikakushi'],
  ['weathering with you', 'tenki no ko'],
  ['a silent voice', 'koe no katachi'],
  ['i want to eat your pancreas', 'kimi no suizou wo tabetai'],
  ['grave of the fireflies', 'hotaru no haka'],
  ['my neighbor totoro', 'tonari no totoro'],
  ['ranking of kings', 'ousama ranking'],
  ['apothecary diaries', 'kusuriya no hitorigoto'],
  ['delicious in dungeon', 'dungeon meshi'],
  ['zom 100', 'bucket list of the dead'],
  ['cyberpunk edgerunners', 'edgerunners'],
  ['parasyte', 'kiseijuu'],
  ['tokyo ghoul'],
  ['black butler', 'kuroshitsuji'],
  ['fairy tail'],
  ['seven deadly sins', 'nanatsu no taizai'],
  ['fire force', 'enen no shouboutai'],
  ['soul eater'],
  ['blue exorcist', 'ao no exorcist'],
  ['noragami'],
  ['assassination classroom', 'ansatsu kyoushitsu'],
  ['horimiya'],
  ['kaguya-sama', 'kaguya sama', 'love is war'],
  ['fruits basket', 'furuba'],
  ['my dress-up darling', 'sono bisque doll'],
  ['bocchi the rock'],
];

function normalizeSearchToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\s:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Expands a search query into normalized variants including English/Japanese/Romaji aliases.
 * Always returns the cleaned original query first.
 */
export function expandSearchQueryVariants(rawQuery: string): string[] {
  const clean = (rawQuery || '').trim();
  if (!clean) return [];

  const lower = clean.toLowerCase();
  const normalized = normalizeSearchToken(clean);
  const variants = new Set<string>([lower]);
  if (normalized) variants.add(normalized);

  if (normalized.length >= 2) {
    for (const group of ANIME_TITLE_ALIAS_GROUPS) {
      const matched = group.some((alias) => {
        const normAlias = normalizeSearchToken(alias);
        if (!normAlias) return false;
        if (normAlias === normalized) return true;
        // Substring match for longer queries (>= 4 chars) to support partial Japanese/English input
        if (normalized.length >= 4 && (normAlias.includes(normalized) || normalized.includes(normAlias))) {
          return true;
        }
        return false;
      });
      if (matched) {
        for (const alias of group) {
          variants.add(alias.toLowerCase());
        }
      }
    }
  }

  return Array.from(variants).slice(0, 8);
}

/**
 * Checks whether an anime record matches a search query across English title,
 * Japanese/Romaji title, alias fields, genres, studio, and synopsis.
 */
export function matchesAnimeSearchQuery(
  anime: {
    title?: string;
    english_title?: string;
    japanese_title?: string;
    romaji_title?: string;
    alt_titles?: string | string[];
    aliases?: string | string[];
    synopsis?: string;
    genres?: string;
    studio?: string;
  },
  rawQuery: string
): boolean {
  const clean = (rawQuery || '').trim();
  if (!clean) return true;
  if (clean.toLowerCase().startsWith('/admin')) return true;

  const variants = expandSearchQueryVariants(clean);
  const altStr = Array.isArray(anime.alt_titles)
    ? anime.alt_titles.join(' ')
    : String(anime.alt_titles || '');
  const aliasStr = Array.isArray(anime.aliases)
    ? anime.aliases.join(' ')
    : String(anime.aliases || '');

  const haystack = [
    anime.title || '',
    anime.english_title || '',
    anime.japanese_title || '',
    anime.romaji_title || '',
    altStr,
    aliasStr,
    anime.genres || '',
    anime.studio || '',
    anime.synopsis || '',
  ]
    .join(' ')
    .toLowerCase();

  const normalizedHaystack = normalizeSearchToken(haystack);

  return variants.some((v) => {
    const normV = normalizeSearchToken(v);
    return haystack.includes(v) || (normV.length >= 2 && normalizedHaystack.includes(normV));
  });
}

// ---------------------------------------------------------------------------
// Saved Language Preference (per-account scoped)
// ---------------------------------------------------------------------------

export function readPreferredLanguage(
  userId?: string | null,
  storage?: SimpleStorageLike | null
): string {
  const saved = readScopedString(PREFERRED_LANGUAGE_STORAGE_KEY, userId, '', storage).trim();
  if (!saved || saved.toLowerCase() === 'all') return 'All';
  return normalizeLanguageName(saved) || 'All';
}

export function writePreferredLanguage(
  language: string,
  userId?: string | null,
  storage?: SimpleStorageLike | null
): string {
  const clean = (language || '').trim();
  const normalized = !clean || clean.toLowerCase() === 'all'
    ? 'All'
    : normalizeLanguageName(clean) || 'All';
  writeScopedString(PREFERRED_LANGUAGE_STORAGE_KEY, normalized, userId, storage);
  return normalized;
}

// ---------------------------------------------------------------------------
// Shareable Filter URL Parsing & Serialization
// ---------------------------------------------------------------------------

export function parseFiltersFromSearchParams(searchStr: string): CatalogUrlFilterState {
  const params = new URLSearchParams(searchStr || '');
  const result: CatalogUrlFilterState = {};

  const q = (params.get('q') || params.get('search') || '').trim();
  if (q) result.search = q.slice(0, 120);

  const rawLang = (params.get('lang') || params.get('language') || '').trim();
  if (rawLang && rawLang.toLowerCase() !== 'all') {
    const normLang = normalizeLanguageName(rawLang);
    if (normLang) result.language = normLang;
  }

  const rawOtt = (params.get('ott') || params.get('platform') || '').trim();
  if (rawOtt && rawOtt.toLowerCase() !== 'all' && rawOtt.toLowerCase() !== 'all platforms') {
    const normOtt = normalizeCanonicalOttName(rawOtt);
    if (normOtt) result.platform = normOtt;
  }

  const rawGenre = (params.get('genre') || '').trim();
  if (rawGenre && rawGenre.toLowerCase() !== 'all' && rawGenre.toLowerCase() !== 'all genres') {
    result.genre = rawGenre.slice(0, 40);
  }

  const rawType = (params.get('type') || '').trim();
  if (rawType && rawType.toLowerCase() !== 'all' && rawType.toLowerCase() !== 'all types') {
    result.type = rawType.slice(0, 40);
  }

  const rawStatus = (params.get('status') || '').trim();
  if (rawStatus && rawStatus.toLowerCase() !== 'all' && rawStatus.toLowerCase() !== 'all status') {
    result.status = rawStatus.slice(0, 40);
  }

  const rawSort = (params.get('sort') || '').trim().toLowerCase();
  if (rawSort && ['popularity', 'rating', 'newest', 'title'].includes(rawSort)) {
    result.sort = rawSort;
  }

  return result;
}

export function buildShareableFilterQuery(filters: CatalogUrlFilterState): string {
  const params = new URLSearchParams();

  if (filters.search && filters.search.trim()) {
    params.set('q', filters.search.trim());
  }
  if (filters.language && filters.language !== 'All') {
    params.set('lang', filters.language);
  }
  if (filters.platform && filters.platform !== 'All' && filters.platform !== 'All Platforms') {
    params.set('ott', normalizeCanonicalOttName(filters.platform) || filters.platform);
  }
  if (filters.genre && filters.genre !== 'All' && filters.genre !== 'All Genres') {
    params.set('genre', filters.genre);
  }
  if (filters.type && filters.type !== 'All' && filters.type !== 'All Types') {
    params.set('type', filters.type);
  }
  if (filters.status && filters.status !== 'All' && filters.status !== 'All Status') {
    params.set('status', filters.status);
  }
  if (filters.sort && filters.sort !== 'popularity') {
    params.set('sort', filters.sort);
  }

  return params.toString();
}

// ---------------------------------------------------------------------------
// Recent Searches (per-account scoped)
// ---------------------------------------------------------------------------

export function readRecentSearches(
  userId?: string | null,
  storage?: SimpleStorageLike | null
): string[] {
  const parsed = readScopedJson<unknown>(RECENT_SEARCHES_STORAGE_KEY, [], userId, storage);
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const item of parsed) {
    const val = String(item || '').trim();
    if (!val || val.length < 2) continue;
    const key = val.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      clean.push(val.slice(0, 80));
    }
    if (clean.length >= MAX_RECENT_SEARCHES) break;
  }
  return clean;
}

export function addRecentSearch(
  query: string,
  userId?: string | null,
  storage?: SimpleStorageLike | null
): string[] {
  const clean = (query || '').trim().slice(0, 80);
  if (clean.length < 2 || clean.toLowerCase().startsWith('/admin')) {
    return readRecentSearches(userId, storage);
  }
  const existing = readRecentSearches(userId, storage).filter(
    (item) => item.toLowerCase() !== clean.toLowerCase()
  );
  const next = [clean, ...existing].slice(0, MAX_RECENT_SEARCHES);
  writeScopedJson(RECENT_SEARCHES_STORAGE_KEY, next, userId, storage);
  return next;
}

export function removeRecentSearch(
  query: string,
  userId?: string | null,
  storage?: SimpleStorageLike | null
): string[] {
  const target = (query || '').trim().toLowerCase();
  const next = readRecentSearches(userId, storage).filter(
    (item) => item.toLowerCase() !== target
  );
  writeScopedJson(RECENT_SEARCHES_STORAGE_KEY, next, userId, storage);
  return next;
}

export function clearRecentSearches(
  userId?: string | null,
  storage?: SimpleStorageLike | null
): string[] {
  writeScopedJson(RECENT_SEARCHES_STORAGE_KEY, [], userId, storage);
  return [];
}
