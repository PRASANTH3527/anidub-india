import React from 'react';
import { AnimeDetailPage } from './AnimeDetailPage';

export interface AnimeDetailModalProps {
  animeId: number;
  onClose: () => void;
  watchlist: number[];
  onToggleWatchlist: (animeId: number) => void;
}

export const AnimeDetailModal: React.FC<AnimeDetailModalProps> = ({
  animeId,
  onClose,
  watchlist,
  onToggleWatchlist
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-[#0b0f17]/95 backdrop-blur-xl overflow-y-auto flex items-start justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl my-2 sm:my-6">
        <AnimeDetailPage
          animeId={animeId}
          onClose={onClose}
          onBack={onClose}
          watchlist={watchlist}
          onToggleWatchlist={onToggleWatchlist}
        />
      </div>
    </div>
  );
};
