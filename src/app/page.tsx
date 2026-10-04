'use client';

import { useState, useEffect } from 'react';
import App from '../App';

export default function Page() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-theme flex items-center justify-center animate-pulse shadow-lg shadow-primary-theme">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-neutral-400 text-sm font-medium tracking-wide">Loading AniDub India...</p>
        </div>
      </div>
    );
  }

  return <App />;
}


