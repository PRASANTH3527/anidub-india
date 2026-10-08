// ==============================================================================
// AniDub India — High-Performance Virtualized Anime Grid
// Powered by @tanstack/react-virtual (useWindowVirtualizer)
// Butter-smooth 60/120fps scrolling for 300+ items with Responsive Multi-Column Layout
// ==============================================================================

'use client';

import React, { useRef, useState, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { AnimeCard } from './AnimeCard';
import { Anime } from '../types/anime';
import { Sparkles, Film } from 'lucide-react';
import { SkeletonGrid } from './SkeletonGrid';

export interface VirtualizedAnimeGridProps {
  animeList: Anime[];
  trendingAnimeIds?: string[];
  localWatchlistIds?: string[];
  onToggleWatchlist: (anime: Anime) => void;
  onOpenAnimeDetail: (anime: Anime) => void;
  onReport?: (anime: Anime) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

/**
 * Hook to detect responsive column count:
 * - Mobile (<640px): 2 columns
 * - Tablet (640px - 768px): 3 columns
 * - Laptop / Desktop (768px - 1280px): 4 columns
 * - Wide Desktop (>=1280px): 5 columns
 */
function useResponsiveColumns(containerRef: React.RefObject<HTMLDivElement | null>): number {
  const [columnCount, setColumnCount] = useState<number>(2);

  useEffect(() => {
    const calculateColumns = () => {
      const containerWidth = containerRef.current?.getBoundingClientRect().width 
        || (typeof window !== 'undefined' ? window.innerWidth : 1024);

      if (containerWidth < 640) {
        setColumnCount(2); // Mobile: 2 columns
      } else if (containerWidth < 768) {
        setColumnCount(3); // Small tablet: 3 columns
      } else if (containerWidth < 1280) {
        setColumnCount(4); // Medium / Large Desktop: 4 columns
      } else {
        setColumnCount(5); // Extra wide screens: 5 columns
      }
    };

    calculateColumns();

    if (!containerRef.current) {
      window.addEventListener('resize', calculateColumns);
      return () => window.removeEventListener('resize', calculateColumns);
    }

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        calculateColumns();
      });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef]);

  return columnCount;
}

export const VirtualizedAnimeGrid: React.FC<VirtualizedAnimeGridProps> = React.memo(({
  animeList,
  trendingAnimeIds = [],
  localWatchlistIds = [],
  onToggleWatchlist,
  onOpenAnimeDetail,
  onReport,
  isLoading = false,
  emptyMessage = 'No anime found matching your filters.',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // 1. Dynamic Responsive Columns
  const columnCount = useResponsiveColumns(containerRef);

  // 2. Measure parent top offset dynamically for window virtualizer
  useLayoutEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setScrollMargin(rect.top + scrollTop);
    }
  }, [animeList.length, columnCount]);

  // Update offset on window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        setScrollMargin(rect.top + scrollTop);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 3. Chunk flat anime list (300+ items) into rows matching the responsive column count
  const rows = useMemo(() => {
    const chunked: Anime[][] = [];
    for (let i = 0; i < animeList.length; i += columnCount) {
      chunked.push(animeList.slice(i, i + columnCount));
    }
    return chunked;
  }, [animeList, columnCount]);

  // 4. Initialize TanStack Window Virtualizer
  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 400, // Approximate height of an AnimeCard row + gaps
    overscan: 2, // Overscan buffer: pre-render 2 rows above & below viewport for zero-pop-in
    scrollMargin,
  });

  // Reset scroll if list drastically changes
  useEffect(() => {
    if (rowVirtualizer.scrollOffset > rowVirtualizer.getTotalSize()) {
      rowVirtualizer.scrollToOffset(0);
    }
  }, [animeList.length, rowVirtualizer]);

  if (isLoading) {
    return <SkeletonGrid count={8} />;
  }

  if (animeList.length === 0) {
    return (
      <div className="py-20 text-center space-y-3 bg-[#131926]/40 border border-neutral-800 rounded-3xl p-8 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
          <Film className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-neutral-300">{emptyMessage}</p>
        <p className="text-xs text-neutral-500">Try adjusting your language or genre filters.</p>
      </div>
    );
  }

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="w-full space-y-6">
      {/* Virtualization Metrics Header (Informative & Minimal) */}
      <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
        <span className="font-bold flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Showing <strong className="text-white">{animeList.length}</strong> Titles</span>
        </span>
        <span className="text-[11px] text-neutral-500 font-medium">
          {columnCount} Columns • Smooth 60fps Virtualized
        </span>
      </div>

      {/* Main Virtualized Container */}
      <div
        ref={containerRef}
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
        className="will-change-transform"
      >
        {virtualItems.map((virtualRow) => {
          const rowItems = rows[virtualRow.index];
          if (!rowItems) return null;

          const translateY = virtualRow.start - (rowVirtualizer.options.scrollMargin || 0);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translate3d(0, ${translateY}px, 0)`,
              }}
              className="pb-4 sm:pb-6"
            >
              {/* Responsive Grid Row */}
              <div
                className="grid gap-4 sm:gap-6"
                style={{
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                }}
              >
                {rowItems.map((anime) => (
                  <AnimeCard
                    key={anime.id}
                    anime={anime}
                    isBookmarked={localWatchlistIds.includes(anime.id)}
                    isTrending={trendingAnimeIds.includes(anime.id)}
                    onToggleBookmark={onToggleWatchlist}
                    onSelect={onOpenAnimeDetail}
                    onReport={onReport}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default VirtualizedAnimeGrid;
