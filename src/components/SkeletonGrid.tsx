import React from 'react';

export const SkeletonCard: React.FC = () => {
  return (
    <div className="rounded-xl overflow-hidden bg-[#131926] border border-neutral-800/80 animate-pulse flex flex-col">
      {/* Poster Skeleton */}
      <div className="aspect-[3/4.2] w-full bg-neutral-800/60 relative">
        <div className="absolute top-2.5 left-2.5 flex gap-1">
          <div className="w-8 h-4 rounded bg-neutral-700/80" />
          <div className="w-8 h-4 rounded bg-neutral-700/80" />
        </div>
      </div>
      {/* Content Skeleton */}
      <div className="p-3 space-y-2">
        <div className="h-4 bg-neutral-700/70 rounded w-3/4" />
        <div className="h-3 bg-neutral-800 rounded w-1/2" />
        <div className="pt-2 flex justify-between">
          <div className="h-3 bg-neutral-800 rounded w-1/3" />
          <div className="h-3 bg-neutral-800 rounded w-4" />
        </div>
      </div>
    </div>
  );
};

export const SkeletonGrid: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};
