import React from 'react';

export const SkeletonCard: React.FC = () => {
  return (
    <div
      data-testid="eclipse-skeleton-card"
      className="relative h-full rounded-[12px] overflow-hidden bg-[#12141E] border border-[#292B39] flex flex-col transition-opacity duration-180 motion-reduce:transition-none"
    >
      {/* STRICT 2:3 POSTER AREA MATCHING ANIMECARD DIMENSIONS */}
      <div className="aspect-[2/3] w-full bg-[#191C29] relative overflow-hidden shrink-0">
        <div className="absolute top-2 left-2">
          <div className="w-11 h-5 rounded-[8px] bg-[#292B39] animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="absolute top-1.5 right-1.5">
          <div className="w-9 h-9 rounded-[10px] bg-[#292B39] animate-pulse motion-reduce:animate-none" />
        </div>
      </div>

      {/* METADATA FOOTER MATCHING 12PX PADDING & 40PX TITLE MIN-HEIGHT */}
      <div className="p-3 flex flex-col flex-1 justify-between gap-2 bg-[#12141E]">
        <div className="space-y-1.5">
          <div className="min-h-[40px] space-y-1.5">
            <div className="h-4 bg-[#191C29] rounded-md w-[88%] animate-pulse motion-reduce:animate-none" />
            <div className="h-4 bg-[#191C29] rounded-md w-[60%] animate-pulse motion-reduce:animate-none" />
          </div>
          <div className="h-5 bg-[#191C29] rounded-md w-[72%] animate-pulse motion-reduce:animate-none" />
        </div>

        <div className="pt-2 border-t border-[#292B39] flex items-center justify-between min-h-[36px]">
          <div className="w-20 h-3.5 rounded bg-[#191C29] animate-pulse motion-reduce:animate-none" />
          <div className="w-8 h-8 rounded-[10px] bg-[#191C29] animate-pulse motion-reduce:animate-none" />
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
    <div
      data-testid="eclipse-skeleton-grid"
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5"
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={`skeleton_card_${index}`} />
      ))}
    </div>
  );
};

export const DetailModalSkeleton: React.FC = () => (
  <div
    data-testid="eclipse-detail-skeleton"
    className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80"
  >
    <div className="w-full max-w-4xl rounded-[12px] bg-[#12141E] border border-[#292B39] overflow-hidden p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        <div className="w-28 sm:w-40 aspect-[2/3] rounded-[12px] bg-[#191C29] border border-[#292B39] animate-pulse shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-6 w-2/3 rounded-lg bg-[#191C29] animate-pulse" />
          <div className="h-4 w-1/3 rounded-lg bg-[#191C29] animate-pulse" />
          <div className="h-20 w-full rounded-[12px] bg-[#191C29] border border-[#292B39] animate-pulse" />
        </div>
      </div>
      <div className="flex gap-2 border-b border-[#292B39] pb-3">
        <div className="h-9 w-24 rounded-[12px] bg-[#191C29] animate-pulse" />
        <div className="h-9 w-28 rounded-[12px] bg-[#191C29] animate-pulse" />
        <div className="h-9 w-28 rounded-[12px] bg-[#191C29] animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="h-28 rounded-[12px] bg-[#191C29] animate-pulse" />
        <div className="h-28 rounded-[12px] bg-[#191C29] animate-pulse" />
      </div>
    </div>
  </div>
);

export const SchedulePageSkeleton: React.FC = () => (
  <div
    data-testid="eclipse-schedule-skeleton"
    className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 space-y-4"
  >
    <div className="h-16 rounded-[12px] bg-[#12141E] border border-[#292B39] p-4 animate-pulse" />
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: 7 }).map((_, idx) => (
        <div key={idx} className="h-11 w-24 rounded-[12px] bg-[#12141E] border border-[#292B39] animate-pulse shrink-0" />
      ))}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="h-32 rounded-[12px] bg-[#12141E] border border-[#292B39] p-4 animate-pulse" />
      ))}
    </div>
  </div>
);

export const LibraryPageSkeleton: React.FC = () => (
  <div
    data-testid="eclipse-library-skeleton"
    className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 space-y-4"
  >
    <div className="h-16 rounded-[12px] bg-[#12141E] border border-[#292B39] p-4 animate-pulse" />
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="h-11 w-28 rounded-[12px] bg-[#12141E] border border-[#292B39] animate-pulse shrink-0" />
      ))}
    </div>
    <SkeletonGrid count={6} />
  </div>
);

export const ProfilePageSkeleton: React.FC = () => (
  <div
    data-testid="eclipse-profile-skeleton"
    className="w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 space-y-4"
  >
    <div className="h-32 rounded-[12px] bg-[#12141E] border border-[#292B39] p-5 animate-pulse" />
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="h-24 rounded-[12px] bg-[#12141E] border border-[#292B39] p-4 animate-pulse" />
      ))}
    </div>
    <div className="h-64 rounded-[12px] bg-[#12141E] border border-[#292B39] p-5 animate-pulse" />
  </div>
);

export const ChatPageSkeleton: React.FC = () => (
  <div
    data-testid="eclipse-chat-skeleton"
    className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-3"
  >
    <div className="h-14 rounded-[12px] bg-[#12141E] border border-[#292B39] animate-pulse" />
    <div className="h-[55vh] rounded-[12px] bg-[#12141E] border border-[#292B39] p-4 space-y-3">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="h-14 rounded-[12px] bg-[#191C29] animate-pulse" />
      ))}
    </div>
  </div>
);

export const PageViewSkeleton: React.FC<{ tab?: string }> = ({ tab }) => {
  switch (tab) {
    case 'schedule':
      return <SchedulePageSkeleton />;
    case 'watchlist':
    case 'library':
      return <LibraryPageSkeleton />;
    case 'profile':
      return <ProfilePageSkeleton />;
    case 'chat':
      return <ChatPageSkeleton />;
    default:
      return (
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 space-y-4">
          <div className="h-14 rounded-[12px] bg-[#12141E] border border-[#292B39] animate-pulse" />
          <SkeletonGrid count={6} />
        </div>
      );
  }
};

export const AdminSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 font-sans">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="h-20 bg-[#12141E] border border-[#292B39] rounded-[12px] p-4 animate-pulse" />
        <div className="h-20 bg-[#12141E] border border-[#292B39] rounded-[12px] p-4 animate-pulse" />
        <div className="h-20 bg-[#12141E] border border-[#292B39] rounded-[12px] p-4 animate-pulse" />
        <div className="h-20 bg-[#12141E] border border-[#292B39] rounded-[12px] p-4 animate-pulse" />
      </div>

      <div className="space-y-3">
        <div className="h-40 bg-[#12141E] border border-[#292B39] rounded-[12px] p-4 flex gap-4 animate-pulse" />
        <div className="h-40 bg-[#12141E] border border-[#292B39] rounded-[12px] p-4 flex gap-4 animate-pulse" />
        <div className="h-40 bg-[#12141E] border border-[#292B39] rounded-[12px] p-4 flex gap-4 animate-pulse" />
      </div>
    </div>
  );
};
