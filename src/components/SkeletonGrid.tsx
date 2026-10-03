import React from 'react';

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative rounded-2xl overflow-hidden bg-[#131926] border border-neutral-800/80 flex flex-col group ${className} animate-in fade-in duration-500`}>
      {/* Poster Skeleton with Shimmer Wave (Netflix Style) */}
      <div className="aspect-[3/4.2] w-full bg-neutral-800/40 relative overflow-hidden">
        {/* Continuous Shimmer Overlay */}
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
        
        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex gap-2 z-10">
          <div className="w-12 h-5 rounded-lg bg-neutral-700/60 animate-pulse" />
        </div>
        
        {/* Top Actions */}
        <div className="absolute top-3 right-3 flex gap-1.5 z-10">
          <div className="w-7 h-7 rounded-full bg-neutral-700/50 animate-pulse" />
          <div className="w-7 h-7 rounded-full bg-neutral-700/50 animate-pulse" />
        </div>

        {/* Bottom Metadata */}
        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center z-10">
          <div className="w-14 h-5 rounded-md bg-neutral-700/60 animate-pulse" />
          <div className="w-10 h-4 rounded-md bg-neutral-700/40 animate-pulse" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="p-4 space-y-4 flex-grow flex flex-col justify-between bg-[#131926]">
        <div className="space-y-3">
          {/* Dub Badges */}
          <div className="flex gap-1.5">
            <div className="w-8 h-4 rounded bg-neutral-800 animate-pulse" />
            <div className="w-8 h-4 rounded bg-neutral-800 animate-pulse" />
          </div>
          
          {/* Title */}
          <div className="h-5 bg-neutral-700/50 rounded-lg w-[85%] animate-pulse" />
          
          {/* Subtitle */}
          <div className="h-3.5 bg-neutral-800/60 rounded-md w-[40%] animate-pulse" />
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-neutral-800/70 flex items-center justify-between">
          <div className="flex gap-1.5">
            <div className="h-4 bg-neutral-800 rounded w-12 animate-pulse" />
            <div className="h-4 bg-neutral-800 rounded w-10 animate-pulse" />
          </div>
          <div className="h-6 bg-neutral-800/80 rounded-lg w-10 animate-pulse" />
        </div>
      </div>
    </div>
  );
};

export const SkeletonGrid: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};

export const AdminSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Analytics Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-[#161d30] border border-neutral-800 rounded-2xl p-4 flex flex-col justify-between">
            <div className="h-3 bg-neutral-700/60 rounded w-20" />
            <div className="h-6 bg-neutral-700/80 rounded w-12" />
          </div>
        ))}
      </div>

      {/* Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-44 bg-[#141a2b] border border-neutral-800 rounded-2xl p-4 flex gap-4">
            <div className="w-28 h-full bg-neutral-800 rounded-xl shrink-0" />
            <div className="flex-grow space-y-3">
              <div className="h-5 bg-neutral-700/70 rounded w-3/4" />
              <div className="h-3 bg-neutral-800 rounded w-1/3" />
              <div className="h-3 bg-neutral-800 rounded w-full" />
              <div className="h-8 bg-neutral-800/50 rounded-xl mt-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
