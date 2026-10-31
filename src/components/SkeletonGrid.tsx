import React from 'react';

export const SkeletonCard: React.FC = () => {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-[#131926] border border-neutral-800/80 flex flex-col group animate-in fade-in duration-500 shadow-lg">
      
      {/* POSTER AREA */}
      <div className="aspect-[3/4.2] w-full bg-neutral-800/40 relative overflow-hidden">
        {/* SHIMMER OVERLAY */}
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />

        {/* TOP BADGES PULSE */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <div className="w-12 h-5 rounded-full bg-neutral-700/60 animate-pulse" />
          <div className="w-10 h-5 rounded-full bg-neutral-700/60 animate-pulse" />
        </div>

        {/* TOP ACTIONS PULSE */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-xl bg-neutral-700/60 animate-pulse" />
          <div className="w-7 h-7 rounded-xl bg-neutral-700/60 animate-pulse" />
        </div>

        {/* BOTTOM METADATA PULSE */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="w-16 h-4 rounded bg-neutral-700/60 animate-pulse" />
          <div className="w-10 h-4 rounded bg-neutral-700/60 animate-pulse" />
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="p-4 space-y-4 flex-grow flex flex-col justify-between bg-[#131926]">
        <div className="space-y-2">
          {/* DUB BADGES */}
          <div className="flex items-center gap-1">
            <div className="w-8 h-4 rounded bg-neutral-700/50 animate-pulse" />
            <div className="w-8 h-4 rounded bg-neutral-700/50 animate-pulse" />
            <div className="w-8 h-4 rounded bg-neutral-700/50 animate-pulse" />
          </div>

          {/* TITLE */}
          <div className="h-5 bg-neutral-700/50 rounded-lg w-[85%] animate-pulse" />
        </div>

        {/* FOOTER */}
        <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between">
          <div className="w-20 h-3 rounded bg-neutral-700/40 animate-pulse" />
          <div className="w-12 h-3 rounded bg-neutral-700/40 animate-pulse" />
        </div>
      </div>

    </div>
  );
};

export interface SkeletonGridProps {
  count?: number;
}

export const SkeletonGrid: React.FC<SkeletonGridProps> = ({ count = 8 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={`skeleton_card_${index}`} />
      ))}
    </div>
  );
};

export const AdminSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* Analytics Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="h-20 bg-[#161d30] border border-neutral-800 rounded-2xl p-4 animate-pulse" />
        <div className="h-20 bg-[#161d30] border border-neutral-800 rounded-2xl p-4 animate-pulse" />
        <div className="h-20 bg-[#161d30] border border-neutral-800 rounded-2xl p-4 animate-pulse" />
        <div className="h-20 bg-[#161d30] border border-neutral-800 rounded-2xl p-4 animate-pulse" />
      </div>

      {/* Cards Boxes */}
      <div className="space-y-3">
        <div className="h-44 bg-[#141a2b] border border-neutral-800 rounded-2xl p-4 flex gap-4 animate-pulse" />
        <div className="h-44 bg-[#141a2b] border border-neutral-800 rounded-2xl p-4 flex gap-4 animate-pulse" />
        <div className="h-44 bg-[#141a2b] border border-neutral-800 rounded-2xl p-4 flex gap-4 animate-pulse" />
      </div>
    </div>
  );
};
