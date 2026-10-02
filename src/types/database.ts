import { DubLanguage, StreamingPlatform, AnimeType, AnimeStatus, CharacterVoiceActor } from './anime';

export type { DubLanguage };

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface DubReview {
  id: string;
  animeId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  language: DubLanguage;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
  likes: number;
}

export interface AnimeRecord {
  id: string;
  title: string;
  romajiTitle?: string;
  nativeTitle?: string;
  poster: string;
  imageUrl?: string;
  banner?: string;
  type: AnimeType;
  releaseYear: number;
  originalReleaseDate?: string;
  rating: number;
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
  releaseDay?: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  submissionStatus: SubmissionStatus;
  rejectionReason?: string;
  genres: string[];
  themes: string[];
  studio: string;
  synopsis: string;
  characters: CharacterVoiceActor[];
  dubs: DubLanguage[];
  dubDetails: {
    language: DubLanguage;
    available: boolean;
    platform: StreamingPlatform[];
    dubStudio?: string;
    notes?: string;
  }[];
  platforms: {
    name: StreamingPlatform;
    url: string;
  }[];
  airingDay?: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  featured?: boolean;
  addedDate?: string;
  submittedBy?: {
    userId: string;
    userName: string;
    userEmail?: string;
  };
  submittedAt: string;
  updatedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  likes?: number;
  upvotes?: number;
}

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'user' | 'admin';
  favoriteLanguage: DubLanguage;
  createdAt: string;
}

export interface WatchlistEntry {
  userId: string;
  animeId: string;
  status: 'plan_to_watch' | 'watched';
  addedAt: string;
  completedAt?: string;
}

export interface JikanAnimeResult {
  mal_id: number;
  title: string;
  title_english?: string;
  title_japanese?: string;
  images: {
    jpg: {
      image_url: string;
      large_image_url: string;
    };
    webp?: {
      image_url: string;
      large_image_url: string;
    };
  };
  synopsis?: string;
  year?: number;
  episodes?: number;
  type?: string;
  status?: string;
  airing?: boolean;
  broadcast?: { day?: string; time?: string; timezone?: string };
  score?: number;
  studios?: { name: string }[];
  genres?: { name: string }[];
  themes?: { name: string }[];
  aired?: {
    string?: string;
    from?: string;
  };
}
