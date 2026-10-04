import React, { Suspense } from 'react';
import { Metadata } from 'next';
import ShareHandler from '../../components/ShareHandler';

export const metadata: Metadata = {
  title: 'Catch Shared Anime — AniDub India',
  description: 'PWA Web Share Target handler for saving shared anime and streaming links to your offline watchlist.',
};

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-theme/30 border border-primary-theme/40 flex items-center justify-center animate-pulse">
              <div className="w-5 h-5 border-2 border-accent-theme border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-neutral-400 text-sm font-medium">Parsing shared content...</p>
          </div>
        </div>
      }
    >
      <ShareHandler />
    </Suspense>
  );
}
