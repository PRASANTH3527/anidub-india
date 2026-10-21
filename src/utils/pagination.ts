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
    const s = (item.status || '').toLowerCase();
    const subS = ((item as any).submissionStatus || '').toLowerCase();
    return s !== 'pending' && subS !== 'pending';
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
    filtered = filtered.filter(item => 
      item.status.toLowerCase() === options.status?.toLowerCase()
    );
  }

  // Search filter
  if (options.search && options.search.trim()) {
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
