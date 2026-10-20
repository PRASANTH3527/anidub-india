import React from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  Layers, 
  ExternalLink, 
  Play, 
  Globe, 
  Tv, 
  Calendar, 
  Trophy, 
  Heart, 
  Bookmark 
} from 'lucide-react';

export interface FooterProps {
  onNavigate?: (tab: string) => void;
  onFilterLanguage?: (lang: string) => void;
  onFilterPlatform?: (platform: string) => void;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  onFilterLanguage,
  onFilterPlatform
}) => {
  return (
    <footer className="w-full max-w-full overflow-hidden bg-[#080c14] border-t border-neutral-800/80 mt-auto text-neutral-400 box-border font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
        
        {/* 1. 5-COLUMN TOP GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
          
          {/* Col 1-2 (lg:col-span-2 space-y-4) */}
          <div className="lg:col-span-2 space-y-4">
            {/* BrandLogo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ea580c] to-[#f59e0b] p-0.5 shadow-md flex items-center justify-center text-white">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5 ml-0.5">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="flex flex-col justify-center leading-none">
                <span className="font-extrabold text-[19px] text-[#ff6a00] tracking-tight" style={{ lineHeight: 1 }}>
                  anidub
                </span>
                <div className="flex items-center space-x-1 mt-0.5">
                  <span className="font-bold text-[9px] text-neutral-300 tracking-[0.25em]" style={{ lineHeight: 1 }}>
                    INDIA
                  </span>
                  <div className="flex items-center space-x-[2px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff9933] inline-block" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#138808] inline-block" />
                  </div>
                </div>
              </div>
            </div>

            {/* Mission paragraph */}
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed max-w-md">
              Anidub India is dedicated to cataloging 100% legal, officially licensed anime streaming in regional Indian languages. Discover verified Tamil, Telugu, Hindi, Malayalam, and Kannada audio tracks across authorized OTT services.
            </p>

            {/* ShieldCheck badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0e1422] border border-neutral-800 text-xs font-semibold text-neutral-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>India's Premier Anime Streaming Catalog</span>
            </div>
          </div>

          {/* Col 3: Regional Dubs */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary-theme" />
              <span>Regional Dubs</span>
            </h4>
            <ul className="space-y-2 text-xs">
              {['Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada'].map((lang) => (
                <li key={lang}>
                  <button
                    onClick={() => {
                      if (onFilterLanguage) onFilterLanguage(lang);
                      else if (onNavigate) onNavigate('home');
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-neutral-400 hover:underline"
                  >
                    {lang} Dubbed Anime
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Official Platforms */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <Tv className="w-3.5 h-3.5 text-indigo-400" />
              <span>Official Platforms</span>
            </h4>
            <ul className="space-y-2 text-xs">
              {[
                { name: 'Anime on Crunchyroll', url: 'https://www.crunchyroll.com' },
                { name: 'Anime on Netflix', url: 'https://www.netflix.com' },
                { name: 'Anime on JioHotstar', url: 'https://www.hotstar.com' },
                { name: 'Anime on JioCinema', url: 'https://www.jiocinema.com' },
                { name: 'Anime on Prime Video', url: 'https://www.primevideo.com' }
              ].map((plat) => (
                <li key={plat.name}>
                  <a
                    href={plat.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors inline-flex items-center gap-1 text-neutral-400 hover:underline"
                  >
                    <span>{plat.name}</span>
                    <ExternalLink className="w-2.5 h-2.5 text-neutral-600" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 5: Community Tools */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Community Tools</span>
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate && onNavigate('collection')}
                  className="hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer text-neutral-400 hover:underline"
                >
                  <span>Create Custom List</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase">
                    New
                  </span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate && onNavigate('tierlist')}
                  className="hover:text-white transition-colors cursor-pointer text-neutral-400 hover:underline"
                >
                  Anime Tier List Maker
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate && onNavigate('schedule')}
                  className="hover:text-white transition-colors cursor-pointer text-neutral-400 hover:underline"
                >
                  Dub Release Schedule
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate && onNavigate('watchlist')}
                  className="hover:text-white transition-colors cursor-pointer text-neutral-400 hover:underline"
                >
                  My Saved Watchlist
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* 2. SEO KNOWLEDGE BLOCK */}
        <div className="rounded-2xl border border-neutral-800/70 bg-[#060a12]/60 p-4 sm:p-7 text-xs text-neutral-400 space-y-4 leading-relaxed">
          <div className="flex items-center gap-2 text-[#ff5722] font-black text-xs sm:text-sm tracking-tight">
            <Sparkles className="w-4 h-4 text-[#ff5722]" />
            <span>About Anidub India — India's Premier Anime Streaming Catalog & Verification Guide</span>
          </div>

          <p>
            Anidub India is the definitive index for anime enthusiasts seeking verified regional Indian dubs. As Indian anime fandom surges across metros and tier-2 cities, major streaming platforms like Crunchyroll, Netflix India, JioCinema, and Disney+ Hotstar have expanded licensing to include official Hindi, Tamil, Telugu, Malayalam, and Kannada audio tracks.
          </p>

          <p>
            Our community-driven verification engine continuously audits OTT simulcast drops, voice artist credits, and sound mix engineering quality. Whether you are looking for action-packed shonen blockbusters like Jujutsu Kaisen and Demon Slayer in Tamil, psychological thrillers in Telugu, or isekai adventures in Hindi, Anidub India helps you locate authorized legal streaming links with zero piracy.
          </p>

          <p>
            Track weekly simulcast schedules, save titles to your offline browser watchlist, evaluate dub accuracy ratings from community reviews, and build custom shareable collections to champion legal regional anime distribution across India.
          </p>
        </div>

        {/* 3. BOTTOM COPYRIGHT BAR */}
        <div className="pt-6 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
          <div>
            © 2026 Anidub India. All rights reserved. Streaming legally via official Indian distributors.
          </div>
          <div className="text-[11px] text-neutral-500 text-center sm:text-right">
            All anime artwork, logos, and character trademarks belong to their respective studios and licensors.
          </div>
        </div>

      </div>
    </footer>
  );
};
