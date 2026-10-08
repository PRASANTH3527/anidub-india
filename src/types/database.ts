import { DubLanguage, StreamingPlatform, AnimeType, AnimeStatus, CharacterVoiceActor } from './anime';

export type { DubLanguage, StreamingPlatform };

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface DubReview {
  id: string;
  animeId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  language: DubLanguage;
  rating: number; // 0 to 10
  comment: string;
  isSpoiler?: boolean;
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
  rating?: number;
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
    languages?: DubLanguage[];
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
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  likes?: number;
  upvotes?: number;
  views?: number;
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

export interface AnimeCollection {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  title: string;
  description: string;
  animeIds: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  likes: number;
  views: number;
}

