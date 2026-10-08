// ==============================================================================
// AniDub India — Smart 'Watch Now' Deep Linking Button
// Launches native streaming app (nflx://, crunchyroll://, etc.) with safe Web fallback
// ==============================================================================

'use client';

import React, { useState } from 'react';
import { ExternalLink, Play, Smartphone, Loader2 } from 'lucide-react';
import { DubLanguage } from '../types/anime';
import { openStreamingPlatform, isMobileDevice } from '../utils/deepLink';
import { useToast } from './Toast';

export interface SmartWatchButtonProps {
  platformName: string;
  webUrl: string;
  languages?: DubLanguage[];
  className?: string;
  buttonText?: string;
  variant?: 'full' | 'compact' | 'minimal';
}

const BRAND_STYLES: Record<string, { bg: string; hover: string; border: string; text: string; ring: string }> = {
  Crunchyroll: {
    bg: 'bg-orange-600/20',
    hover: 'hover:bg-orange-600/30 hover:border-orange-500/70',
    border: 'border-orange-500/40',
    text: 'text-orange-400',
    ring: 'focus:ring-orange-500/30',
  },
  Netflix: {
    bg: 'bg-red-950/30',
    hover: 'hover:bg-red-900/40 hover:border-red-500/70',
    border: 'border-red-600/40',
    text: 'text-red-400',
    ring: 'focus:ring-red-500/30',
  },
  JioCinema: {
    bg: 'bg-pink-950/30',
    hover: 'hover:bg-pink-900/40 hover:border-pink-500/70',
    border: 'border-pink-600/40',
    text: 'text-pink-400',
    ring: 'focus:ring-pink-500/30',
  },
  'Prime Video': {
    bg: 'bg-sky-950/30',
    hover: 'hover:bg-sky-900/40 hover:border-sky-500/70',
    border: 'border-sky-600/40',
    text: 'text-sky-400',
    ring: 'focus:ring-sky-500/30',
  },
  'Disney+ Hotstar': {
    bg: 'bg-blue-950/30',
    hover: 'hover:bg-blue-900/40 hover:border-blue-500/70',
    border: 'border-blue-600/40',
    text: 'text-blue-400',
    ring: 'focus:ring-blue-500/30',
  },
  YouTube: {
    bg: 'bg-red-950/20',
    hover: 'hover:bg-red-900/30 hover:border-red-500/50',
    border: 'border-red-500/30',
    text: 'text-red-300',
    ring: 'focus:ring-red-500/30',
  },
};

export const SmartWatchButton: React.FC<SmartWatchButtonProps> = ({
  platformName,
  webUrl,
  languages = [],
  className = '',
  buttonText,
  variant = 'full',
}) => {
  const toast = useToast();
  const [isAttempting, setIsAttempting] = useState(false);

  const brand = Object.entries(BRAND_STYLES).find(([key]) =>
    platformName.toLowerCase().includes(key.toLowerCase())
  )?.[1] || {
    bg: 'bg-primary-theme/15',
    hover: 'hover:bg-primary-theme/25 hover:border-primary-theme/60',
    border: 'border-primary-theme/35',
    text: 'text-primary-light',
    ring: 'focus:ring-primary-theme/30',
  };

  const handleWatchClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const { isMobile } = isMobileDevice();

    if (isMobile) {
      setIsAttempting(true);
      toast.info(`Opening ${platformName}`, 'Attempting to launch native mobile app...');

      openStreamingPlatform(platformName, webUrl, {
        onAttemptApp: () => {
          setIsAttempting(true);
        },
        onFallbackWeb: () => {
          setIsAttempting(false);
          toast.info('Web Fallback', 'App not installed; opening official website.');
        },
      });

      // Clear spinner after 2 seconds
      setTimeout(() => setIsAttempting(false), 2200);
    } else {
      // Desktop: Clean direct window.open
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleWatchClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 shadow-sm ${brand.bg} ${brand.hover} ${brand.border} ${brand.text} ${className}`}
        title={`Watch on ${platformName} (Opens native app or website)`}
      >
        {isAttempting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Play className="w-3 h-3 fill-current" />
        )}
        <span>{buttonText || `Watch on ${platformName}`}</span>
      </button>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <button
        type="button"
        onClick={handleWatchClick}
        disabled={isAttempting}
        className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer group active:scale-[0.98] shadow-md ${brand.bg} ${brand.hover} ${brand.border} ${brand.text}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-black/40 flex items-center justify-center border border-white/10 shrink-0">
            {isAttempting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
          </div>
          <div className="text-left">
            <span className="font-heading font-black text-xs sm:text-sm text-white block">
              {buttonText || `Watch on ${platformName}`}
            </span>
            <span className="text-[10px] text-neutral-400 font-medium flex items-center gap-1">
              <Smartphone className="w-3 h-3 opacity-70" />
              <span>Smart App Deep Link</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 group-hover:text-white transition-colors">
            Play
          </span>
          <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
        </div>
      </button>

      {/* Available regional audio tags for this platform */}
      {languages && languages.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 px-1.5">
          <span className="text-[8px] font-black uppercase text-neutral-500 tracking-wider">Dub:</span>
          {languages.map((l, idx) => (
            <span
              key={`${l}-${idx}`}
              className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-black/60 text-neutral-300 border border-white/10"
            >
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default SmartWatchButton;
