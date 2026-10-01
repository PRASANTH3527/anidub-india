import { CharacterVoiceActor } from '../types/anime';

export interface AnimeEnrichmentInfo {
  originalReleaseDate: string;
  themes: string[];
  characters: CharacterVoiceActor[];
}

export const ANIME_ENRICHMENT_MAP: Record<string, AnimeEnrichmentInfo> = {};

// General themes list for recommendation wizard
export const ALL_RECOMMENDATION_THEMES = [
  'Underdog to OP',
  'Dark Fantasy',
  'Mind Games & Strategy',
  'High Stakes Survival',
  'Sports Tournament',
  'Espionage & Family',
  'Demons & Exorcism',
  'Cursed Energy & Spirits',
  'Revenge',
  'Grand Adventure',
  'Wholesome Romance',
  'Overpowered Hero Parody',
  'Reincarnation / Isekai',
  'Ghosts & Aliens',
  'Vikings & War',
  'Disaster & Doors',
  'Dungeon Crawling',
  'School Life & Youth',
  'Magic & Humanity',
  'Quiet Pilgrimage',
];
