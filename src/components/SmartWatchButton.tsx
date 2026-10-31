import React from 'react';
import { ExternalLink, Smartphone, Tv } from 'lucide-react';

export interface SmartWatchButtonProps {
  platform: string;
  url?: string;
  languages?: string[];
  variant?: 'compact' | 'full';
  onClick?: () => void;
}

const BRAND_STYLES: Record<string, string> = {
  Crunchyroll: 'bg-orange-600/20 border-orange-500/40 hover:border-orange-500/70 text-orange-300',
  Netflix: 'bg-red-950/30 border-red-800/40 hover:border-red-600/70 text-red-300',
  JioCinema: 'bg-gradient-to-r from-blue-950/40 to-pink-950/40 border-blue-500/40 hover:border-blue-500/70 text-blue-300',
  'Disney+ Hotstar': 'bg-blue-950/30 border-blue-800/40 hover:border-blue-600/70 text-blue-300',
  'Muse India': 'bg-emerald-950/30 border-emerald-800/40 hover:border-emerald-600/70 text-emerald-300',
  'Ani-One Asia': 'bg-purple-950/30 border-purple-800/40 hover:border-purple-600/70 text-purple-300'
};

const DEFAULT_STYLE = 'bg-neutral-900/80 border-neutral-700/60 hover:border-neutral-500 text-neutral-200';

export const SmartWatchButton: React.FC<SmartWatchButtonProps> = ({
  platform,
  url,
  languages = ['Hin', 'Tam', 'Tel'],
  variant = 'full',
  onClick
}) => {
  const brandClass = BRAND_STYLES[platform] || DEFAULT_STYLE;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 shadow-sm ${brandClass}`}
      >
        <Tv className="w-3.5 h-3.5" />
        <span>{platform}</span>
        <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
      </button>
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer group active:scale-[0.98] shadow-md ${brandClass}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-white shrink-0 shadow-sm">
          <Tv className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <h4 className="font-heading font-black text-xs sm:text-sm text-white truncate">
            {platform}
          </h4>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Smartphone className="w-3 h-3 text-neutral-400" />
            <span className="text-[10px] text-neutral-400 font-medium">Official OTT App</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden xs:flex flex-wrap items-center gap-1">
          <span className="text-[8px] font-black uppercase text-neutral-500 tracking-wider">Audio:</span>
          {languages.map((lang, idx) => (
            <span
              key={`smart_watch_${platform}_${lang}_${idx}`}
              className="bg-black/60 text-neutral-300 border border-white/10 px-1.5 py-0.2 rounded text-[8px] font-black uppercase"
            >
              {lang}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 group-hover:text-white transition-colors">
          <span>Watch</span>
          <ExternalLink className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
};
