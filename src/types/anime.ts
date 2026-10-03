export type DubLanguage = 'Tamil' | 'Telugu' | 'Hindi' | 'Malayalam' | 'Kannada';

export type AnimeType = 'TV Series' | 'Movie' | 'Special' | 'OVA' | 'ONA';

export type AnimeStatus = 'Ongoing' | 'Completed' | 'Airing' | 'Upcoming' | 'pending' | 'approved' | 'rejected';

export type ReleaseDay = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export type StreamingPlatform = 
  | 'Crunchyroll'
  | 'Netflix'
  | 'JioCinema'
  | 'YouTube (Muse India)'
  | 'YouTube (Ani-One)'
  | 'Prime Video'
  | 'Disney+ Hotstar';

export interface DubInfo {
  language: DubLanguage;
  available: boolean;
  platform: StreamingPlatform[];
  dubStudio?: string;
  notes?: string;
}

export interface CharacterVoiceActor {
  characterName: string;
  characterImage: string;
  role: 'Main' | 'Supporting';
  japaneseVA: string;
  indianVA?: {
    language: DubLanguage;
    actor: string;
  };
}

export interface WatchlistItem {
  animeId: string;
  status: 'plan_to_watch' | 'watched';
  addedAt: string;
  completedAt?: string;
  userRating?: number;
}

export interface UserProfile {
  username: string;
  bio: string;
  favoriteLanguage: DubLanguage;
  avatar: string;
}

export interface Anime {
  id: string;
  title: string;
  romajiTitle?: string;
  nativeTitle?: string;
  poster: string;
  imageUrl?: string;
  banner?: string;
  type: AnimeType;
  releaseYear: number;
  originalReleaseDate?: string; // e.g. "January 6, 2024"
  rating?: number; // e.g., 8.7
  episodes?: number;
  seasons?: number;
  totalSeasons?: number;
  episodesPerSeason?: number;
  currentSeason?: number;
  currentlyAiringEpisode?: number;
  seasonDetails?: { 
    type: 'Season' | 'OVA' | 'Movie' | 'Special' | 'ONA'; 
    label: string; 
    episodeCount: number;
    languages?: DubLanguage[];
  }[];
  status: AnimeStatus;
  airingStatus?: 'Ongoing' | 'Completed';
  releaseDay?: ReleaseDay;
  airingDay?: ReleaseDay;
  genres: string[];
  themes?: string[]; // e.g. "Underdog to OP", "Revenge", "Super Power"
  studio: string;
  synopsis: string;
  characters?: CharacterVoiceActor[];
  dubs: DubLanguage[]; // Array of languages with dubs
  dubDetails: DubInfo[];
  platforms: {
    name: StreamingPlatform;
    url: string;
  }[];
  featured?: boolean;
  addedDate?: string; // ISO date
  likes?: number;
  upvotes?: number;
}

export interface DubNews {
  id: string;
  title: string;
  date: string;
  tag: string;
  url?: string;
}

export interface FeedbackSubmission {
  id: string;
  nameOrInsta: string;
  email?: string;
  feedback: string;
  animeName?: string;
  language?: DubLanguage;
  timestamp: string;
}
