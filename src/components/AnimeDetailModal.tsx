import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
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
  const shouldReduceMotion = useReducedMotion();

  // Escape key listener & body scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-0 sm:p-4 md:p-6 font-sans">
      {/* Backdrop fades in/out */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onClick={onClose}
        className="fixed inset-0 bg-[#0f1115]/90 backdrop-blur-xl"
      />

      {/* Modal Dialog slides up with spring (damping: 25, stiffness: 300) */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 50 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 45 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-5xl my-0 sm:my-6 rounded-none sm:rounded-3xl overflow-hidden shadow-2xl z-10 will-change-transform"
      >
        <AnimeDetailPage
          animeId={animeId}
          onClose={onClose}
          onBack={onClose}
          watchlist={watchlist}
          onToggleWatchlist={onToggleWatchlist}
        />
      </motion.div>
    </div>
  );
};
