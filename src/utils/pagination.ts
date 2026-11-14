/**
 * Pure pagination and catalog filtering logic for Cloudflare D1 queries
 */

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  offset: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  pages: number[];
}

export interface CatalogPaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function parsePaginationQuery(
  searchParams: URLSearchParams,
  options?: { defaultLimit?: number; maxLimit?: number }
): { page: number; limit: number; offset: number } {
  const defaultLimit = options?.defaultLimit ?? 12;
  const maxLimit = options?.maxLimit ?? 100;

  const rawPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const rawLimit = Number.parseInt(searchParams.get('limit') || String(defaultLimit), 10);
  const clampedLimit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(maxLimit, Math.max(1, rawLimit))
    : defaultLimit;

  return {
    page,
    limit: clampedLimit,
    offset: (page - 1) * clampedLimit,
  };
}

export function buildPaginatedMeta(
  totalItems: number,
  page: number,
  limit: number
): CatalogPaginationMeta {
  const safeTotal = Math.max(0, Number(totalItems) || 0);
  const safeLimit = Math.max(1, Number(limit) || 12);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));
  const currentPage = Math.max(1, Number(page) || 1);

  return {
    currentPage,
    totalPages,
    totalItems: safeTotal,
    limit: safeLimit,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}

const LANGUAGE_SQL_ALIASES: Record<string, string[]> = {
  hindi: ['%hindi%', '%hin%'],
  hin: ['%hindi%', '%hin%'],
  tamil: ['%tamil%', '%tam%'],
  tam: ['%tamil%', '%tam%'],
  telugu: ['%telugu%', '%tel%'],
  tel: ['%telugu%', '%tel%'],
  malayalam: ['%malayalam%', '%mal%'],
  mal: ['%malayalam%', '%mal%'],
  kannada: ['%kannada%', '%kan%'],
  kan: ['%kannada%', '%kan%'],
  bengali: ['%bengali%', '%ben%'],
  ben: ['%bengali%', '%ben%'],
  marathi: ['%marathi%', '%mar%'],
  mar: ['%marathi%', '%mar%'],
  gujarati: ['%gujarati%', '%guj%'],
  guj: ['%gujarati%', '%guj%'],
  punjabi: ['%punjabi%', '%pan%'],
  pan: ['%punjabi%', '%pan%'],
};

export function buildLanguageLikePatterns(language?: string | null): string[] {
  const raw = (language || '').trim().toLowerCase();
  if (!raw || raw === 'all') return [];
  if (LANGUAGE_SQL_ALIASES[raw]) return LANGUAGE_SQL_ALIASES[raw];
  const shortCode = raw.slice(0, 3);
  if (shortCode && shortCode !== raw) {
    return [`%${raw}%`, `%${shortCode}%`];
  }
  return [`%${raw}%`];
}

export function getVisiblePageNumbers(
  currentPage: number,
  totalPages: number,
  maxButtons: number = 5
): (number | 'ellipsis')[] {
  const safeTotal = Math.max(1, totalPages);
  const safeCurrent = Math.min(Math.max(1, currentPage), safeTotal);

  if (safeTotal <= maxButtons) {
    return Array.from({ length: safeTotal }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];
  const half = Math.floor((maxButtons - 2) / 2);
  let start = Math.max(2, safeCurrent - half);
  let end = Math.min(safeTotal - 1, safeCurrent + half);

  if (safeCurrent <= 1 + half + 1) {
    start = 2;
    end = Math.min(safeTotal - 1, Math.max(2, maxButtons - 2));
  } else if (safeCurrent >= safeTotal - half - 1) {
    end = safeTotal - 1;
    start = Math.max(2, safeTotal - Math.max(1, maxButtons - 3));
  }

  if (start > 2) pages.push('ellipsis');
  for (let p = start; p <= end; p++) {
    pages.push(p);
  }
  if (end < safeTotal - 1) pages.push('ellipsis');
  pages.push(safeTotal);

  return pages;
}

export function calculatePagination(total: number, page: number, limit: number): PaginationResult {
  const safeLimit = Math.max(1, limit || 8);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.min(Math.max(1, page || 1), totalPages);
  const offset = (safePage - 1) * safeLimit;

  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
    offset,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
    pages,
  };
}

export interface CatalogFilterOptions {
  genre?: string;
  status?: string;
  language?: string; // 'All', 'Tamil', 'Telugu', 'Hindi', 'HIN', 'TAM', 'TEL'
  platform?: string;
  type?: string;
  search?: string;
  sort?: 'popularity' | 'rating' | 'newest' | 'title' | string;
}

export function filterAndSortCatalog<T extends {
  title: string;
  synopsis?: string;
  genres: string;
  status: string;
  rating: number;
  popularity: number;
  year: number;
  languages?: string;
  platform?: string;
  type?: string;
}>(
  items: T[],
  options: CatalogFilterOptions
): T[] {
  let filtered = [...items].filter(item => {
    const subS = ((item as any).submissionStatus || (item as any).approval_status || '').toLowerCase();
    return subS !== 'pending';
  });

  // Regional Dub Language Filter
  if (options.language && options.language !== 'All') {
    const langKey = options.language.toUpperCase().substring(0, 3); // 'HIN', 'TAM', 'TEL'
    filtered = filtered.filter(item => {
      const langs = (item.languages || 'HIN,TAM,TEL').toUpperCase();
      return langs.includes(langKey) || langs.includes(options.language!.toUpperCase());
    });
  }

  // Genre filter
  if (options.genre && options.genre !== 'All') {
    const targetGenre = options.genre.toLowerCase();
    filtered = filtered.filter(item => 
      item.genres.toLowerCase().includes(targetGenre)
    );
  }

  // Platform filter
  if (options.platform && options.platform !== 'All') {
    const targetPlatform = options.platform.toLowerCase();
    filtered = filtered.filter(item => 
      (item.platform || 'Crunchyroll').toLowerCase().includes(targetPlatform)
    );
  }

  // Type filter
  if (options.type && options.type !== 'All') {
    const targetType = options.type.toLowerCase();
    filtered = filtered.filter(item => 
      (item.type || 'TV Series').toLowerCase().includes(targetType)
    );
  }

  // Status filter
  if (options.status && options.status !== 'All') {
    const targetStatus = options.status.toLowerCase();
    filtered = filtered.filter(item => {
      const itemStatus = ((item as any).airing_status || item.status || '').toLowerCase();
      if (targetStatus === 'airing') {
        return itemStatus === 'airing' || itemStatus === 'ongoing' || itemStatus.includes('simulcast');
      }
      if (targetStatus === 'completed') {
        return itemStatus.includes('complete') || itemStatus.includes('finished');
      }
      return itemStatus === targetStatus;
    });
  }

  // Search filter (ignores secret admin commands starting with /admin)
  if (options.search && options.search.trim() && !options.search.trim().toLowerCase().startsWith('/admin')) {
    const q = options.search.toLowerCase().trim();
    filtered = filtered.filter(item => 
      item.title.toLowerCase().includes(q) ||
      (item.synopsis && item.synopsis.toLowerCase().includes(q)) ||
      item.genres.toLowerCase().includes(q)
    );
  }

  // Sort
  const sort = options.sort || 'popularity';
  filtered.sort((a, b) => {
    if (sort === 'rating') return b.rating - a.rating;
    if (sort === 'newest') return b.year - a.year;
    if (sort === 'title') return a.title.localeCompare(b.title);
    return b.popularity - a.popularity;
  });

  return filtered;
}
