import Fuse, { type IFuseOptions } from 'fuse.js';
import { AnimeRecord } from '../types/database';
import { Anime } from '../types/anime';

// Known Anime Acronyms & Short Names Dictionary
export const KNOWN_ACRONYMS: Record<string, string[]> = {
  // Attack on Titan
  'attack on titan': ['aot', 'snk', 'shingeki no kyojin'],
  'shingeki no kyojin': ['aot', 'snk', 'attack on titan'],
  // Jujutsu Kaisen
  'jujutsu kaisen': ['jjk', 'sorcery fight'],
  // Demon Slayer
  'demon slayer': ['kny', 'ds', 'kimetsu no yaiba', 'kimetsu'],
  'kimetsu no yaiba': ['kny', 'ds', 'demon slayer'],
  // My Hero Academia
  'my hero academia': ['mha', 'bnha', 'boku no hero academia'],
  'boku no hero academia': ['mha', 'bnha', 'my hero academia'],
  // One Piece
  'one piece': ['op', 'luffy'],
  // One Punch Man
  'one punch man': ['opm', 'saitama'],
  // Sword Art Online
  'sword art online': ['sao', 'kirito'],
  // Fullmetal Alchemist
  'fullmetal alchemist': ['fma', 'fmab', 'brotherhood', 'hagane no renkinjutsushi'],
  // Death Note
  'death note': ['dn', 'kira'],
  // Naruto
  'naruto': ['ns', 'shippuden', 'boruto'],
  // Dragon Ball
  'dragon ball': ['db', 'dbz', 'dbs', 'dragon ball z', 'dragon ball super'],
  // Bleach
  'bleach': ['tybw', 'thousand year blood war', 'ichigo'],
  // Solo Leveling
  'solo leveling': ['sl', 'ore dake level up na ken', 'jinwoo'],
  // Chainsaw Man
  'chainsaw man': ['csm', 'denji'],
  // Tokyo Ghoul
  'tokyo ghoul': ['tg', 'kaneki'],
  // Hunter x Hunter
  'hunter x hunter': ['hxh', 'gon'],
  // Black Clover
  'black clover': ['bc', 'asta'],
  // Spy x Family
  'spy x family': ['sxf', 'spy family', 'anya'],
  // Code Geass
  'code geass': ['cg', 'lelouch'],
  // Haikyuu
  'haikyuu': ['hq', 'haikyu', 'karasuno'],
  // That Time I Got Reincarnated as a Slime
  'that time i got reincarnated as a slime': ['tensura', 'slime', 'rimuru'],
  // Classroom of the Elite
  'classroom of the elite': ['cote', 'ayanokoji'],
  // Oshi no Ko
  'oshi no ko': ['onk'],
  // Steins;Gate
  'steins;gate': ['sg', 'steins gate'],
  // JoJo's Bizarre Adventure
  "jojo's bizarre adventure": ['jojo', 'jjba'],
  // Vinland Saga
  'vinland saga': ['vs', 'thorfinn'],
  // Mushoku Tensei
  'mushoku tensei': ['mt', 'jobless reincarnation', 'rudeus'],
  // Neon Genesis Evangelion
  'neon genesis evangelion': ['nge', 'evangelion', 'eva'],
  // Mob Psycho 100
  'mob psycho 100': ['mp100', 'mob psycho', 'shigeo'],
  // Blue Lock
  'blue lock': ['bl', 'isagi'],
  // Dr. Stone
  'dr. stone': ['dr stone', 'senku'],
  // Hell's Paradise
  "hell's paradise": ['jigokuraku', 'gabimaru'],
  // Wind Breaker
  'wind breaker': ['wb', 'sakura'],
  // Kaiju No. 8
  'kaiju no. 8': ['kaiju 8', 'kn8', 'kafka'],
};

/**
 * Extracts initials/acronym from any title string
 * e.g., "Attack on Titan" -> "AOT", "Solo Leveling" -> "SL"
 */
export function extractInitials(title: string): string[] {
  if (!title) return [];
  const clean = title.replace(/[^a-zA-Z0-9\s]/g, ' ');
  const words = clean.split(/\s+/).filter(Boolean);
  
  const initialsAll = words.map(w => w[0]).join('').toLowerCase();
  
  // Filter out common stop words to create standard anime acronyms
  const stopWords = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'no', 'wa', 'ga']);
  const initialsMeaningful = words
    .filter(w => !stopWords.has(w.toLowerCase()))
    .map(w => w[0])
    .join('')
    .toLowerCase();

  const results = new Set<string>();
  if (initialsAll.length >= 2) results.add(initialsAll);
  if (initialsMeaningful.length >= 2) results.add(initialsMeaningful);
  return Array.from(results);
}

export interface EnrichedSearchItem {
  raw: AnimeRecord | Anime;
  title: string;
  romajiTitle: string;
  nativeTitle: string;
  acronyms: string[];
  dubs: string[];
  platformNames: string[];
  genres: string[];
  studio: string;
}

/**
 * Prepares searchable document representation with all required fields
 */
export function prepareSearchItem(item: AnimeRecord | Anime): EnrichedSearchItem {
  const title = (item.title || '').trim();
  const romajiTitle = (item.romajiTitle || (item as any).romaji_title || '').trim();
  const nativeTitle = (item.nativeTitle || (item as any).native_title || '').trim();
  
  const titleLower = title.toLowerCase();
  const romajiLower = romajiTitle.toLowerCase();

  // Combine predefined dictionary acronyms + algorithmic initials
  const acronymsSet = new Set<string>();
  
  extractInitials(title).forEach(a => acronymsSet.add(a));
  if (romajiTitle) {
    extractInitials(romajiTitle).forEach(a => acronymsSet.add(a));
  }

  for (const [key, aliases] of Object.entries(KNOWN_ACRONYMS)) {
    if (titleLower.includes(key) || romajiLower.includes(key)) {
      aliases.forEach(alias => acronymsSet.add(alias.toLowerCase()));
    }
  }

  // Dubs
  const dubs = Array.isArray(item.dubs) ? item.dubs.map(d => String(d)) : [];

  // Platforms
  const platformNames: string[] = [];
  if (Array.isArray(item.platforms)) {
    item.platforms.forEach((p: any) => {
      const name = typeof p === 'string' ? p : p?.name;
      if (name) platformNames.push(String(name));
    });
  }

  // Genres
  const genres = Array.isArray(item.genres) ? item.genres.map(g => String(g)) : [];
  const studio = item.studio || (item as any).animationStudio || (item as any).animation_studio || '';

  return {
    raw: item,
    title,
    romajiTitle,
    nativeTitle,
    acronyms: Array.from(acronymsSet),
    dubs,
    platformNames,
    genres,
    studio,
  };
}

let cachedFuseInstance: { listRef: any[]; fuse: Fuse<EnrichedSearchItem> } | null = null;

/**
 * Creates or retrieves a memoized Fuse index for high performance
 */
export function getFuseIndex(animeList: (AnimeRecord | Anime)[]): Fuse<EnrichedSearchItem> {
  if (cachedFuseInstance && cachedFuseInstance.listRef === animeList) {
    return cachedFuseInstance.fuse;
  }

  const enrichedItems = animeList.map(prepareSearchItem);

  const options: IFuseOptions<EnrichedSearchItem> = {
    includeScore: true,
    shouldSort: true,
    threshold: 0.38, // 0.0 is perfect match, 1.0 matches anything. 0.38 is ideal for typo tolerance
    distance: 100,
    minMatchCharLength: 2,
    ignoreLocation: true,
    keys: [
      { name: 'title', weight: 0.35 },
      { name: 'acronyms', weight: 0.25 },
      { name: 'romajiTitle', weight: 0.20 },
      { name: 'dubs', weight: 0.15 },
      { name: 'platformNames', weight: 0.10 },
      { name: 'nativeTitle', weight: 0.08 },
      { name: 'genres', weight: 0.05 },
      { name: 'studio', weight: 0.05 },
    ],
  };

  const fuse = new Fuse(enrichedItems, options);
  cachedFuseInstance = { listRef: animeList, fuse };
  return fuse;
}

/**
 * Performs fuzzy search with typo tolerance and multiple field matching
 */
export function searchAnimeFuzzy<T extends AnimeRecord | Anime>(
  animeList: T[],
  query: string,
  limit?: number
): T[] {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    return limit ? animeList.slice(0, limit) : animeList;
  }

  // 1. Check exact/prefix matches first for optimal instant ranking
  const exactOrPrefixMatches: T[] = [];
  const remainingList: T[] = [];

  for (const item of animeList) {
    const titleLower = (item.title || '').toLowerCase();
    const romajiLower = (item.romajiTitle || (item as any).romaji_title || '').toLowerCase();
    const dubs = Array.isArray(item.dubs) ? item.dubs.map(d => String(d).toLowerCase()) : [];
    const platforms = Array.isArray(item.platforms)
      ? item.platforms.map((p: any) => (typeof p === 'string' ? p : p?.name || '').toLowerCase())
      : [];

    const isExact =
      titleLower === cleanQuery ||
      romajiLower === cleanQuery ||
      titleLower.startsWith(cleanQuery) ||
      romajiLower.startsWith(cleanQuery);

    const isAcronymMatch = KNOWN_ACRONYMS[cleanQuery]?.some(alias => titleLower.includes(alias) || romajiLower.includes(alias)) ||
      extractInitials(item.title).includes(cleanQuery);

    if (isExact || isAcronymMatch) {
      exactOrPrefixMatches.push(item);
    } else {
      remainingList.push(item);
    }
  }

  // 2. Perform fuzzy search with Fuse.js
  const fuse = getFuseIndex(animeList);
  const fuseResults = fuse.search(cleanQuery);
  const fuzzyItems = fuseResults.map(res => res.item.raw as T);

  // 3. Deduplicate combined results (exact/prefix first, then fuzzy ranking)
  const seenIds = new Set<string>();
  const combined: T[] = [];

  for (const item of exactOrPrefixMatches) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      combined.push(item);
    }
  }

  for (const item of fuzzyItems) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      combined.push(item);
    }
  }

  return limit ? combined.slice(0, limit) : combined;
}
