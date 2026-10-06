import { Anime, DubLanguage } from '../types/anime';
import { AnimeRecord } from '../types/database';

export interface AnimeDNA {
  topStudios: { name: string; count: number; percentage: number }[];
  topLanguages: { name: string; count: number; percentage: number }[];
  topGenres: { name: string; count: number; percentage: number }[];
  totalWatched: number;
  totalTimeEstimated: number; // in minutes
}

/**
 * Analyzes a list of anime to extract "DNA" patterns (preferred studios, languages, etc.)
 */
export function calculateAnimeDNA(watchedAnime: Anime[]): AnimeDNA {
  const total = watchedAnime.length;
  if (total === 0) {
    return {
      topStudios: [],
      topLanguages: [],
      topGenres: [],
      totalWatched: 0,
      totalTimeEstimated: 0,
    };
  }

  const studios: Record<string, number> = {};
  const languages: Record<string, number> = {};
  const genres: Record<string, number> = {};
  let totalMinutes = 0;

  watchedAnime.forEach((anime) => {
    // Studio analysis
    const studio = anime.studio || (anime as any).animationStudio || 'Unknown';
    studios[studio] = (studios[studio] || 0) + 1;

    // Language analysis
    (anime.dubs || []).forEach((lang) => {
      languages[lang] = (languages[lang] || 0) + 1;
    });

    // Genre analysis
    (anime.genres || []).forEach((genre) => {
      genres[genre] = (genres[genre] || 0) + 1;
    });

    // Time estimation (Avg 24 mins per episode)
    const episodes = anime.episodes || 12;
    totalMinutes += episodes * 24;
  });

  const sortAndMap = (record: Record<string, number>) => {
    return Object.entries(record)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }));
  };

  return {
    topStudios: sortAndMap(studios),
    topLanguages: sortAndMap(languages),
    topGenres: sortAndMap(genres),
    totalWatched: total,
    totalTimeEstimated: totalMinutes,
  };
}
