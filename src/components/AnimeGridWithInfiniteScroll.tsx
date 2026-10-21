import React from 'react';
import { RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';

export interface AnimeGridWithInfiniteScrollProps {
  isLoadingMore: boolean;
  hasMore: boolean;
  totalCount: number;
  displayedCount: number;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  renderSkeletonBatch?: () => React.ReactNode;
}

export const AnimeGridWithInfiniteScroll: React.FC<AnimeGridWithInfiniteScrollProps> = ({
  isLoadingMore,
  hasMore,
  totalCount,
  displayedCount,
  sentinelRef,
  renderSkeletonBatch
}) => {
  return (
    <div className="space-y-8 font-sans">
      
      {/* INFINITE SCROLL SENTINEL & LOADING STATE */}
      <div ref={sentinelRef} className="pt-8 pb-12 flex flex-col items-center justify-center min-h-[160px]">
        
        {isLoadingMore && (
          <div className="w-full space-y-6">
            {/* NEXT BATCH SKELETONS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-6 w-full opacity-30 grayscale pointer-events-none">
              {renderSkeletonBatch ? renderSkeletonBatch() : (
                <>
                  <div className="aspect-[3/4.2] bg-neutral-800 rounded-2xl animate-pulse" />
                  <div className="aspect-[3/4.2] bg-neutral-800 rounded-2xl animate-pulse" />
                  <div className="aspect-[3/4.2] bg-neutral-800 rounded-2xl animate-pulse" />
                  <div className="aspect-[3/4.2] bg-neutral-800 rounded-2xl animate-pulse" />
                </>
              )}
            </div>

            {/* LOADING BUTTON */}
            <div className="flex justify-center">
              <div className="flex items-center gap-3 px-6 py-3.5 rounded-full bg-[#131929]/95 border border-purple-500/30 text-xs font-black text-neutral-200 shadow-2xl backdrop-blur-md animate-bounce">
                <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
                <span>Loading more official regional dubs...</span>
              </div>
            </div>
          </div>
        )}

        {!hasMore && totalCount > 0 && (
          <div className="text-center pt-8 pb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 text-[11px] font-black text-neutral-300 shadow-lg">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>You have reached the end of the catalog ({displayedCount} of {totalCount} titles loaded)</span>
            </div>
          </div>
        )}

        <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-6 opacity-60">
          Anidub India Authorized OTT Index • 60fps Virtualized Grid
        </div>

      </div>

    </div>
  );
};
