import { Anime } from '@/src/types/anime';

// Initial state completely empty by default for fresh real data entries
export const ANIME_DATABASE: Anime[] = [];

export const ALL_GENRES = [
  'All Genres',
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Isekai',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Shonen',
  'Seinen',
  'Shoujo',
  'Josei',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
  'Mecha',
  'Psychological',
  'Music',
  'Military',
  'Historical',
  'Martial Arts',
  'Ecchi',
  'Gourmet',
  'Workplace',
];

export const ALL_TYPES = ['All Types', 'TV Series', 'Movie', 'Special', 'OVA', 'ONA'];

export const ALL_STATUSES = ['All', 'Ongoing', 'Completed', 'Airing', 'Upcoming'];

export const ALL_PLATFORMS = [
  'All Platforms',
  'Crunchyroll',
  'Netflix',
  'JioCinema',
  'JioHotstar',
  'YouTube',
  'YouTube (Muse India)',
  'YouTube (Ani-One)',
  'Disney+ Hotstar',
  'Prime Video',
  'Anime Times',
  'Sony YAY!',
  'Sony LIV',
  'Bilibili',
  'Cartoon Network India',
  'ETV Bal Bharat',
  'Zee5',
];

export const ALL_LANGUAGES: { name: string; short: string; bg: string; text: string; border: string }[] = [
  { name: 'All', short: 'All', bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-500' },
  { name: 'Tamil', short: 'Tam', bg: 'bg-amber-600', text: 'text-amber-100', border: 'border-amber-500' },
  { name: 'Telugu', short: 'Tel', bg: 'bg-sky-600', text: 'text-sky-100', border: 'border-sky-500' },
  { name: 'Hindi', short: 'Hin', bg: 'bg-emerald-600', text: 'text-emerald-100', border: 'border-emerald-500' },
  { name: 'Malayalam', short: 'Mal', bg: 'bg-violet-600', text: 'text-violet-100', border: 'border-violet-500' },
  { name: 'Kannada', short: 'Kan', bg: 'bg-indigo-600', text: 'text-indigo-100', border: 'border-indigo-500' },
  { name: 'Bengali', short: 'Ben', bg: 'bg-pink-600', text: 'text-pink-100', border: 'border-pink-500' },
];
