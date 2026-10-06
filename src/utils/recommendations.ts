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

export interface RelatedAnimeMatch {
  anime: Anime;
  score: number;
  matchPercentage: number;
  matchReasons: string[];
  isSameStudio: boolean;
  sharedDubs: DubLanguage[];
  studioName: string;
}

/**
 * Smart 'More Like This' Recommendation Engine
 * Ranks and suggests 5-10 related animes without relying on 'genres',
 * placing the highest weight on animationStudio and shared dub languages.
 */
export function getMoreLikeThisRecommendations(
  targetAnime: Anime,
  allAnime: Anime[],
  options: {
    limit?: number; // 5 to 10 recommendations (default 8)
    minScore?: number;
  } = {}
): RelatedAnimeMatch[] {
  const { limit = 8, minScore = 10 } = options;

  if (!targetAnime || !allAnime || allAnime.length === 0) {
    return [];
  }

  // Normalize target attributes
  const targetStudio = String((targetAnime as any).animationStudio || targetAnime.studio || '')
    .trim()
    .toLowerCase();
  const targetDubs = (targetAnime.dubs || []).map((d) => d.toLowerCase());
  const targetType = targetAnime.type;
  const targetYear = Number(targetAnime.releaseYear) || 2023;
  const targetPlatforms = (targetAnime.platforms || []).map((p) => p.name.toLowerCase());

  const candidates = allAnime.filter(
    (a) => a.id !== targetAnime.id && !((a as any).isDeleted || (a as any).status === 'rejected')
  );

  const scoredMatches: RelatedAnimeMatch[] = candidates.map((candidate) => {
    let score = 0;
    const matchReasons: string[] = [];
    const sharedDubs: DubLanguage[] = [];

    // 1. Animation Studio Match (HIGHEST WEIGHT: +55 points)
    const candidateStudio = String((candidate as any).animationStudio || candidate.studio || '')
      .trim();
    const candidateStudioLower = candidateStudio.toLowerCase();
    const isSameStudio =
      Boolean(targetStudio) &&
      targetStudio !== 'unknown' &&
      candidateStudioLower === targetStudio;

    if (isSameStudio) {
      score += 55;
      matchReasons.push(`Same Studio (${candidateStudio})`);
    }

    // 2. Shared Regional Dub Languages (+16 points per shared language)
    (candidate.dubs || []).forEach((dub) => {
      if (targetDubs.includes(dub.toLowerCase())) {
        score += 16;
        sharedDubs.push(dub);
      }
    });

    if (sharedDubs.length > 0) {
      if (sharedDubs.length === targetDubs.length && targetDubs.length > 1) {
        score += 12; // Complete language parity bonus
        matchReasons.push(`All ${sharedDubs.length} Dubs Match (${sharedDubs.join(', ')})`);
      } else {
        matchReasons.push(`Shares ${sharedDubs.join(' & ')} Audio`);
      }

      // First/primary dub language match bonus
      if (
        targetAnime.dubs?.[0] &&
        candidate.dubs?.[0] &&
        targetAnime.dubs[0].toLowerCase() === candidate.dubs[0].toLowerCase()
      ) {
        score += 8;
      }
    }

    // 3. Same Format Match (TV Series, Movie, etc.: +10 points)
    if (candidate.type && targetType && candidate.type === targetType) {
      score += 10;
      matchReasons.push(`Same Format (${candidate.type})`);
    }

    // 4. Release Era Proximity (+8 to +4 points)
    const candYear = Number(candidate.releaseYear) || targetYear;
    const yearDiff = Math.abs(targetYear - candYear);
    if (yearDiff <= 1) {
      score += 8;
      matchReasons.push(`Contemporary Release (${candYear})`);
    } else if (yearDiff <= 4) {
      score += 4;
      matchReasons.push(`Similar Era (${candYear})`);
    }

    // 5. Shared Streaming Platform (+6 points)
    const candPlatforms = (candidate.platforms || []).map((p) => p.name.toLowerCase());
    const commonPlatform = targetPlatforms.find((p) => candPlatforms.includes(p));
    if (commonPlatform) {
      score += 6;
      const formattedName =
        candidate.platforms?.find((p) => p.name.toLowerCase() === commonPlatform)?.name ||
        commonPlatform;
      matchReasons.push(`Stream on ${formattedName}`);
    }

    // 6. Airing / Status Consistency (+4 points)
    if (candidate.status && targetAnime.status && candidate.status === targetAnime.status) {
      score += 4;
    }

    // 7. Rating quality weighting (Normalized tie-breaker: up to 10 points)
    const rating = Number(candidate.rating || 8.0);
    score += Math.min(10, Math.round(rating));

    // Calculate normalized percentage (cap at 99% for realism)
    const maxTheoreticalScore = 120;
    const matchPercentage = Math.min(99, Math.max(45, Math.round((score / maxTheoreticalScore) * 100)));

    return {
      anime: candidate,
      score,
      matchPercentage,
      matchReasons: matchReasons.slice(0, 3), // Keep top 3 most compelling reasons
      isSameStudio,
      sharedDubs,
      studioName: candidateStudio || 'Anime Studio',
    };
  });

  // Sort descending by calculated score
  scoredMatches.sort((a, b) => b.score - a.score);

  // Return the desired slice between 5 and 10 items (clamped by user request)
  const targetCount = Math.max(5, Math.min(10, limit));
  const filtered = scoredMatches.filter((m) => m.score >= minScore);

  // If filtered has fewer than 5 items, fallback to top scored items
  if (filtered.length < 5 && scoredMatches.length > 0) {
    return scoredMatches.slice(0, Math.min(targetCount, scoredMatches.length));
  }

  return filtered.slice(0, targetCount);
}

