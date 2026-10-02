// Smart 'For You' Recommendation Engine analyzing local activity & preferences
import { Anime, DubLanguage } from '../types/anime';
import { LocalUserProfile } from '../components/LocalProfileModal';

export interface ForYouAnalysis {
  recommendedAnime: Anime[];
  preferredLanguage: DubLanguage | string;
  topGenres: string[];
  totalAnalyzed: number;
}

/**
 * Calculates personalized 'For You' recommendations by inspecting local user data
 */
export function computeForYouRecommendations(
  allApprovedAnime: Anime[],
  watchlistAnimeIds: string[],
  recentlyViewedIds: string[],
  userProfile?: LocalUserProfile
): ForYouAnalysis {
  if (!allApprovedAnime || allApprovedAnime.length === 0) {
    return {
      recommendedAnime: [],
      preferredLanguage: 'Tamil',
      topGenres: [],
      totalAnalyzed: 0,
    };
  }

  // 1. Calculate Language Frequency & Affinity
  const languageWeights: Record<string, number> = {
    Tamil: 0,
    Telugu: 0,
    Hindi: 0,
    Malayalam: 0,
    Kannada: 0,
  };

  const genreWeights: Record<string, number> = {};

  // Base profile preference
  if (userProfile?.favoriteLanguage && userProfile.favoriteLanguage !== 'All') {
    languageWeights[userProfile.favoriteLanguage] = (languageWeights[userProfile.favoriteLanguage] || 0) + 15;
  }

  // Factor in Watchlist items (high intent: +6 per language, +4 per genre)
  const animeMap = new Map<string, Anime>();
  allApprovedAnime.forEach((a) => animeMap.set(a.id, a));

  watchlistAnimeIds.forEach((id) => {
    const item = animeMap.get(id);
    if (item) {
      (item.dubs || []).forEach((dub) => {
        languageWeights[dub] = (languageWeights[dub] || 0) + 6;
      });
      (item.genres || []).forEach((g) => {
        genreWeights[g] = (genreWeights[g] || 0) + 4;
      });
    }
  });

  // Factor in Recently Viewed items (engagement: +4 per language, +3 per genre)
  recentlyViewedIds.forEach((id, index) => {
    const item = animeMap.get(id);
    if (item) {
      const recencyBoost = Math.max(1, 10 - index); // Most recent items carry more weight
      (item.dubs || []).forEach((dub) => {
        languageWeights[dub] = (languageWeights[dub] || 0) + 4 + recencyBoost;
      });
      (item.genres || []).forEach((g) => {
        genreWeights[g] = (genreWeights[g] || 0) + 3;
      });
    }
  });

  // Find top preferred language
  let preferredLanguage: DubLanguage | string = 'Tamil';
  let maxLangScore = -1;
  Object.entries(languageWeights).forEach(([lang, score]) => {
    if (score > maxLangScore) {
      maxLangScore = score;
      preferredLanguage = lang;
    }
  });

  // Default to Tamil if no interaction yet
  if (maxLangScore <= 0) {
    preferredLanguage = userProfile?.favoriteLanguage && userProfile.favoriteLanguage !== 'All' 
      ? userProfile.favoriteLanguage 
      : 'Tamil';
  }

  // Find top 3 genres
  const sortedGenres = Object.entries(genreWeights)
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g)
    .slice(0, 3);

  // 2. Score Every Anime in the Approved Catalog
  const scoredList = allApprovedAnime.map((anime) => {
    let score = 0;

    // Language Match Boost
    const hasPreferredDub = (anime.dubs || []).some(
      (d) => d.toLowerCase() === preferredLanguage.toLowerCase()
    );
    if (hasPreferredDub) {
      score += 60;
    }

    // Secondary Language Matches
    (anime.dubs || []).forEach((d) => {
      score += (languageWeights[d] || 0) * 2;
    });

    // Genre Affinity Boost
    (anime.genres || []).forEach((g) => {
      if (sortedGenres.includes(g)) {
        score += 25;
      } else if (genreWeights[g]) {
        score += (genreWeights[g] || 0) * 2;
      }
    });

    // Trending & Community Votes Boost
    const upvotes = Number(anime.upvotes || anime.likes || 0);
    score += Math.min(upvotes, 30);

    // Rating boost
    const rating = Number(anime.rating || 4.5);
    score += rating * 4;

    // Prioritize unwatched or saved anime
    const isSaved = watchlistAnimeIds.includes(anime.id);
    if (isSaved) {
      score += 15;
    }

    return { anime, score };
  });

  // Sort descending by calculated affinity score
  scoredList.sort((a, b) => b.score - a.score);

  return {
    recommendedAnime: scoredList.map((item) => item.anime),
    preferredLanguage,
    topGenres: sortedGenres.length > 0 ? sortedGenres : ['Action', 'Shonen', 'Fantasy'],
    totalAnalyzed: watchlistAnimeIds.length + recentlyViewedIds.length,
  };
}
