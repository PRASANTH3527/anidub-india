import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Globe, Search, X } from 'lucide-react';
import { cloudflareApi, type CatalogMeta } from '../services/cloudflareApi';
import { normalizeLanguageName } from '../utils/languages';
import { filterAndSortCatalog } from '../utils/pagination';
import { proxyUrl } from '../utils/imgbb';
import {
  FEATURED_SEO_LANGUAGES,
  SITE_ORIGIN,
  filterAnimeByLanguage,
  getLanguageSlug,
} from '../utils/seoMeta';
import { AnimeCard, type AnimeCardData } from './AnimeCard';
import { SkeletonGrid } from './SkeletonGrid';

export interface LanguageLandingViewProps {
  language: string;
  catalogList?: AnimeCardData[];
  watchlist: number[];
  onSelectAnime: (anime: AnimeCardData) => void;
  onToggleWatchlist: (animeId: number) => void;
  onToggleLike?: (animeId: number, liked?: boolean, count?: number) => void;
  onToggleUpvote?: (animeId: number, upvoted?: boolean, count?: number) => void;
  onNavigateLanguage: (language: string) => void;
  onNavigateHome: () => void;
}

const PAGE_SIZE = 24;

const PLATFORMS = [
  'All Platforms',
  'Crunchyroll',
  'Netflix',
  'JioHotstar',
  'JioCinema',
  'Prime Video',
  'YouTube (Muse India)',
  'YouTube (Ani-One)',
  'Sony LIV',
  'Sony YAY!',
];

const SORTS = [
  { label: 'Most Upvoted', value: 'popularity' },
  { label: 'Highest Rated', value: 'rating' },
  { label: 'Newest Release', value: 'newest' },
  { label: 'Title (A-Z)', value: 'title' },
];

export const LanguageLandingView: React.FC<LanguageLandingViewProps> = ({
  language,
  catalogList = [],
  watchlist,
  onSelectAnime,
  onToggleWatchlist,
  onToggleLike,
  onToggleUpvote,
  onNavigateLanguage,
  onNavigateHome,
}) => {
  const displayLanguage = useMemo(
    () => normalizeLanguageName(language) || 'Hindi',
    [language]
  );
  const languageSlug = useMemo(
    () => getLanguageSlug(displayLanguage),
    [displayLanguage]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('All Platforms');
  const [selectedSort, setSelectedSort] = useState('popularity');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AnimeCardData[]>([]);
  const [meta, setMeta] = useState<CatalogMeta>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: PAGE_SIZE,
    hasNextPage: false,
    hasPrevPage: false,
  });

  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedPlatform('All Platforms');
  }, [displayLanguage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedPlatform, selectedSort]);

  const loadLanguageCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const response = await cloudflareApi.fetchCatalog({
        page: currentPage,
        limit: PAGE_SIZE,
        language: displayLanguage,
        platform: selectedPlatform,
        search: debouncedSearch,
        sort: selectedSort,
      });

      const apiData = Array.isArray(response?.data) ? response.data : [];
      const apiMeta = response?.meta;

      if (apiData.length > 0 || (apiMeta && apiMeta.totalItems > 0)) {
        const normalized = apiData
          .filter(
            (item: any) =>
              item.status !== 'pending' && item.submissionStatus !== 'pending'
          )
          .map((item: any) => ({
            ...item,
            cover_image: proxyUrl(item.cover_image),
            banner_image: proxyUrl(item.banner_image),
          }));

        setItems(normalized);
        if (apiMeta) {
          setMeta(apiMeta);
        } else {
          setMeta({
            currentPage: 1,
            totalPages: 1,
            totalItems: normalized.length,
            limit: PAGE_SIZE,
            hasNextPage: false,
            hasPrevPage: false,
          });
        }
        return;
      }

      // Fallback to client-side filtering over preloaded catalog
      const matchingLanguage = filterAnimeByLanguage(catalogList, displayLanguage).map(
        (item) => ({
          ...item,
          genres: item.genres || '',
          status: item.status || '',
          rating: Number(item.rating ?? 0),
          popularity: Number(item.popularity ?? 0),
          year: Number(item.year ?? 0),
          languages: Array.isArray(item.languages)
            ? item.languages.join(', ')
            : item.languages,
          platform: Array.isArray(item.platform)
            ? item.platform.join('|')
            : item.platform,
        })
      );
      const filtered = filterAndSortCatalog(matchingLanguage, {
        language: displayLanguage,
        platform: selectedPlatform === 'All Platforms' ? 'All' : selectedPlatform,
        search: debouncedSearch,
        sort: selectedSort,
      });

      const start = (currentPage - 1) * PAGE_SIZE;
      const paged = filtered.slice(start, start + PAGE_SIZE);
      const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

      setItems(paged);
      setMeta({
        currentPage,
        totalPages,
        totalItems: filtered.length,
        limit: PAGE_SIZE,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      });
    } catch {
      const matchingLanguage = filterAnimeByLanguage(catalogList, displayLanguage);
      setItems(matchingLanguage.slice(0, PAGE_SIZE));
      setMeta({
        currentPage: 1,
        totalPages: 1,
        totalItems: matchingLanguage.length,
        limit: PAGE_SIZE,
        hasNextPage: false,
        hasPrevPage: false,
      });
    } finally {
      setLoading(false);
    }
  }, [
    catalogList,
    currentPage,
    debouncedSearch,
    displayLanguage,
    selectedPlatform,
    selectedSort,
  ]);

  useEffect(() => {
    loadLanguageCatalog();
  }, [loadLanguageCatalog]);

  const jsonLd = useMemo(
    () =>
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `Best ${displayLanguage} Dubbed Anime in India`,
        url: `${SITE_ORIGIN}/dubbed-anime/${languageSlug}`,
        description: `Browse ${meta.totalItems} anime with official ${displayLanguage} audio dubs streaming legally in India.`,
        inLanguage: displayLanguage,
      }),
    [displayLanguage, languageSlug, meta.totalItems]
  );

  return (
    <section
      aria-labelledby="language-landing-heading"
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-8"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      {/* Breadcrumb & Back Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs text-neutral-400"
        >
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigateHome();
            }}
            className="hover:text-white transition-colors underline-offset-4 hover:underline"
          >
            Home
          </a>
          <span aria-hidden="true">/</span>
          <span>Dubbed Anime</span>
          <span aria-hidden="true">/</span>
          <span className="text-neutral-200 font-medium">{displayLanguage}</span>
        </nav>

        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigateHome();
          }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-800 bg-[#121827] hover:bg-[#192238] text-xs font-medium text-neutral-200 transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Full Catalog</span>
        </a>
      </div>

      {/* Editorial Hero Header */}
      <header className="space-y-4 border-b border-neutral-800/80 pb-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-purple-300">
          <Globe className="w-4 h-4 shrink-0" />
          <span>Official Indian Regional Audio Directory</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums text-neutral-300 whitespace-nowrap">
            {meta.totalItems} {meta.totalItems === 1 ? 'Title' : 'Titles'} Available
          </span>
        </div>

        <h1
          id="language-landing-heading"
          className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white [text-wrap:balance]"
        >
          Best {displayLanguage} Dubbed Anime in India
        </h1>

        <p className="text-sm sm:text-base text-neutral-300 max-w-3xl leading-relaxed">
          Explore verified anime series and movies streaming legally in India with official{' '}
          {displayLanguage} audio dubs across Crunchyroll, Netflix, JioHotstar, Prime Video,
          and Muse India.
        </p>

        {/* Cross-Language Navigation Strip */}
        <nav
          aria-label="Browse by Indian Language"
          className="pt-2 flex flex-wrap items-center gap-2"
        >
          {FEATURED_SEO_LANGUAGES.map((langName) => {
            const slug = getLanguageSlug(langName);
            const isActive =
              langName.toLowerCase() === displayLanguage.toLowerCase();
            return (
              <a
                key={langName}
                href={`/dubbed-anime/${slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigateLanguage(langName);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
                  isActive
                    ? 'bg-purple-600/20 text-purple-200 border-purple-500/60'
                    : 'bg-[#121827] text-neutral-300 border-neutral-800 hover:border-neutral-700 hover:text-white'
                }`}
              >
                {langName} Dubbed
              </a>
            );
          })}
        </nav>
      </header>

      {/* Filter & Sort Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-6 relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${displayLanguage} dubbed anime by title or studio...`}
            aria-label={`Search ${displayLanguage} dubbed anime`}
            className="w-full bg-[#121827] border border-neutral-800 focus:border-purple-500 rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-neutral-500 outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search query"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="md:col-span-3">
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            aria-label="Filter by streaming platform"
            className="w-full bg-[#121827] border border-neutral-800 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 outline-none cursor-pointer"
          >
            {PLATFORMS.map((plat) => (
              <option key={plat} value={plat}>
                {plat}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={selectedSort}
            onChange={(e) => setSelectedSort(e.target.value)}
            aria-label="Sort dubbed anime results"
            className="w-full bg-[#121827] border border-neutral-800 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 outline-none cursor-pointer"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span>
          Showing <strong className="text-white tabular-nums">{items.length}</strong> of{' '}
          <strong className="text-white tabular-nums">{meta.totalItems}</strong>{' '}
          {displayLanguage} dubbed titles
        </span>
        <span className="tabular-nums">
          Page {meta.currentPage} of {meta.totalPages}
        </span>
      </div>

      {/* Anime Grid / Loading / Empty State */}
      {loading ? (
        <SkeletonGrid count={12} />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-[#111726] p-10 text-center space-y-4">
          <h2 className="text-lg font-bold text-white">
            {searchQuery || selectedPlatform !== 'All Platforms'
              ? `No ${displayLanguage} dubbed titles matched these filters`
              : `No ${displayLanguage} dubbed titles listed yet`}
          </h2>
          <p className="text-sm text-neutral-400 max-w-md mx-auto">
            {searchQuery || selectedPlatform !== 'All Platforms'
              ? 'Try clearing your search or switching to another streaming platform or regional dub language.'
              : `Explore the full catalog or switch to another Indian regional audio dub below.`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {(searchQuery || selectedPlatform !== 'All Platforms') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedPlatform('All Platforms');
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigateHome();
              }}
              className="px-4 py-2 rounded-xl border border-neutral-700 hover:border-neutral-600 text-neutral-200 text-xs font-semibold transition-colors"
            >
              Browse All Dubs
            </a>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((anime, index) => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              index={index}
              priority={index < 6}
              onSelect={onSelectAnime}
              isBookmarked={watchlist.some((id) => String(id) === String(anime.id))}
              onToggleBookmark={onToggleWatchlist}
              onToggleLike={onToggleLike}
              onToggleUpvote={onToggleUpvote}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            type="button"
            disabled={!meta.hasPrevPage}
            onClick={() => {
              setCurrentPage((p) => Math.max(1, p - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-800 bg-[#121827] text-xs font-semibold text-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed hover:border-purple-500/50 cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <span className="text-xs text-neutral-400 tabular-nums">
            Page {meta.currentPage} of {meta.totalPages}
          </span>

          <button
            type="button"
            disabled={!meta.hasNextPage}
            onClick={() => {
              setCurrentPage((p) => Math.min(meta.totalPages, p + 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-800 bg-[#121827] text-xs font-semibold text-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed hover:border-purple-500/50 cursor-pointer transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </section>
  );
};
