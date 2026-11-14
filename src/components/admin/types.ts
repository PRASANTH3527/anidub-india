import type { LucideIcon } from 'lucide-react';

export type AdminTabId =
  | 'overview'
  | 'pending'
  | 'catalog'
  | 'feedback'
  | 'data_health'
  | 'analytics'
  | 'settings';

export interface StreamingPartnerPayload {
  name?: string;
  url?: string;
}

export interface MixedSeasonEntry {
  type?: string;
  name?: string;
  episodes?: number | string | null;
  episodeCount?: number | string | null;
}

export interface AdminAnimeRecord {
  id: number | string;
  _id?: number | string;
  title: string;
  hindiTitle?: string;
  slug?: string;
  synopsis?: string;
  description?: string;
  cover_image?: string;
  banner_image?: string;
  posterUrl?: string;
  poster_url?: string;
  poster?: string;
  image?: string;
  rating?: number | string | null;
  popularity?: number;
  episodes_count?: number;
  episodes?: number | null;
  episodes_per_season?: string;
  status?: string;
  airing_status?: string;
  submissionStatus?: string;
  approval_status?: string;
  is_published?: boolean | number;
  season?: string;
  year?: number | null;
  release_year?: number;
  genres?: string;
  genre?: string;
  languages?: string | string[];
  platform?: string;
  watch_url?: string;
  platforms_data?: StreamingPartnerPayload[] | string;
  streaming_partners?: StreamingPartnerPayload[];
  mixedEntries?: MixedSeasonEntry[] | string;
  mixed_entries?: MixedSeasonEntry[] | string;
  type?: string;
  Type?: string;
  studio?: string;
  hindi?: boolean;
  tamil?: boolean;
  telugu?: boolean;
  imdbID?: string;
  imdb_id?: string;
  imdbId?: string;
}

export interface RatingCorrection {
  anime: AdminAnimeRecord;
  currentLocalRating: number;
  realImdbRating: number;
  imdbID: string;
}

export interface FeedbackTicket {
  id?: number | string;
  name_or_insta?: string;
  email?: string;
  feedback_text?: string;
  created_at?: string;
}

export interface TelegramSettingsStatus {
  configured: boolean;
  hasToken: boolean;
  hasChatId: boolean;
  tokenMasked?: string;
  chatId?: string;
}

export interface TelegramNotice {
  type: 'success' | 'error';
  message: string;
}

export interface TerminalLogEntry {
  id: string;
  time: string;
  level: string;
  msg: string;
}

export interface CommandPaletteActionItem {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  action: () => void;
}

export interface CommandPaletteNavItem {
  id: string;
  title: string;
  desc: string;
  tab: AdminTabId;
  icon: LucideIcon;
}

export interface CommandPaletteResults {
  actions: CommandPaletteActionItem[];
  nav: CommandPaletteNavItem[];
  animes: AdminAnimeRecord[];
}

export const KNOWN_IMDB_MAP: Record<
  string,
  { id: string; alternateIds?: string[]; fallbackTitle: string; benchmarkRating: number }
> = {
  'dr. stone': {
    id: 'tt9679542',
    alternateIds: ['tt13001680', 'tt9679542'],
    fallbackTitle: 'Dr. Stone',
    benchmarkRating: 8.1,
  },
  'dr stone': {
    id: 'tt9679542',
    alternateIds: ['tt13001680', 'tt9679542'],
    fallbackTitle: 'Dr. Stone',
    benchmarkRating: 8.1,
  },
  'cyberpunk: edgerunners': {
    id: 'tt12590266',
    fallbackTitle: 'Cyberpunk: Edgerunners',
    benchmarkRating: 8.3,
  },
  'cyberpunk edgerunners': {
    id: 'tt12590266',
    fallbackTitle: 'Cyberpunk: Edgerunners',
    benchmarkRating: 8.3,
  },
  'tokyo revengers': {
    id: 'tt13196080',
    alternateIds: ['tt13291074', 'tt13196080'],
    fallbackTitle: 'Tokyo Revengers',
    benchmarkRating: 7.7,
  },
  'demon slayer': {
    id: 'tt9335498',
    fallbackTitle: 'Demon Slayer: Kimetsu no Yaiba',
    benchmarkRating: 8.6,
  },
  'jujutsu kaisen': {
    id: 'tt12343534',
    fallbackTitle: 'Jujutsu Kaisen',
    benchmarkRating: 8.5,
  },
  'solo leveling': {
    id: 'tt21209876',
    fallbackTitle: 'Solo Leveling',
    benchmarkRating: 8.3,
  },
  'attack on titan': {
    id: 'tt2560140',
    fallbackTitle: 'Attack on Titan',
    benchmarkRating: 9.1,
  },
  naruto: {
    id: 'tt0409591',
    fallbackTitle: 'Naruto',
    benchmarkRating: 8.4,
  },
  'one piece': {
    id: 'tt0388629',
    fallbackTitle: 'One Piece',
    benchmarkRating: 8.9,
  },
  'death note': {
    id: 'tt0877057',
    fallbackTitle: 'Death Note',
    benchmarkRating: 8.9,
  },
  bleach: {
    id: 'tt0434665',
    fallbackTitle: 'Bleach',
    benchmarkRating: 8.2,
  },
  'chainsaw man': {
    id: 'tt13616990',
    fallbackTitle: 'Chainsaw Man',
    benchmarkRating: 8.4,
  },
  frieren: {
    id: 'tt22248374',
    fallbackTitle: "Frieren: Beyond Journey's End",
    benchmarkRating: 8.9,
  },
  'spy x family': {
    id: 'tt13706018',
    fallbackTitle: 'Spy x Family',
    benchmarkRating: 8.3,
  },
};

/**
 * Title Sanitizer & Candidate Generator for OMDb Queries.
 * Strips seasons, regional dub tags, subtitles, and returns prioritized search queries.
 */
export const getCleanOmdbQueryTitles = (rawTitle: string): string[] => {
  if (!rawTitle) return [];
  const list: string[] = [];
  const trimmed = rawTitle.trim();
  list.push(trimmed);

  const noTags = trimmed.replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/gi, '').trim();
  if (noTags && !list.includes(noTags)) list.push(noTags);

  const noSeason = (noTags || trimmed)
    .replace(/\s+(?:season\s+\d+|\d+(?:st|nd|rd|th)\s+season|part\s+\d+|cour\s+\d+|s\d+)\b/gi, '')
    .trim();
  if (noSeason && !list.includes(noSeason)) list.push(noSeason);

  const root = (noSeason || noTags || trimmed).split(/[:\-\—\|]/)[0].trim();
  if (root && !list.includes(root)) list.push(root);

  const alphaClean = root.replace(/[^a-zA-Z0-9\s\.]/g, ' ').replace(/\s+/g, ' ').trim();
  if (alphaClean && !list.includes(alphaClean)) list.push(alphaClean);

  return list;
};

export function formatLanguageText(languages?: string | string[]): string {
  if (Array.isArray(languages)) return languages.join(', ');
  return typeof languages === 'string' ? languages : '';
}
