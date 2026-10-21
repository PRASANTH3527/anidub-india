import React, { useRef } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useResponsiveColumns } from '../utils/useResponsiveColumns';
import { AnimeCard } from './AnimeCard';
import { Anime } from './CatalogView';

export interface VirtualizedAnimeGridProps {
  animeList: Anime[];
  onSelectAnime: (anime: Anime) => void;
  watchlist: number[];
  onToggleWatchlist: (animeId: number) => void;
}

export const VirtualizedAnimeGrid: React.FC<VirtualizedAnimeGridProps> = ({
  animeList,
  onSelectAnime,
  watchlist,
  onToggleWatchlist
}) => {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const columns = useResponsiveColumns();
  const rowCount = Math.ceil(animeList.length / columns);

  const rowVirtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => 380,
    overscan: 3,
  });

  return (
    <div className="w-full space-y-6 font-sans" ref={parentRef}>
      
      {/* VIRTUALIZATION METRICS HEADER */}
      <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
        <span>Virtualizing {animeList.length} titles across {columns} responsive columns</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary-theme">60fps Smooth Scroll</span>
      </div>

      {/* VIRTUALIZED CONTAINER */}
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
        className="will-change-transform"
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowIndex = virtualRow.index;
          const startIndex = rowIndex * columns;
          const rowItems = animeList.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="absolute top-0 left-0 w-full pb-4 sm:pb-6"
            >
              {/* RESPONSIVE GRID ROW */}
              <div 
                className="grid gap-4 sm:gap-6"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {rowItems.map((anime) => {
                  const isBookmarked = watchlist.includes(anime.id);
                  return (
                    <AnimeCard
                      key={anime.id}
                      anime={anime}
                      onSelect={(a) => onSelectAnime(a as any)}
                      isBookmarked={isBookmarked}
                      onToggleBookmark={onToggleWatchlist}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
