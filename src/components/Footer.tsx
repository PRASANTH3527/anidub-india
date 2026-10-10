import React from 'react';
import { BrandLogo } from './BrandLogo';
import { ShieldCheck, Sparkles } from 'lucide-react';

interface FooterProps {
  onSelectCategory?: (type: 'language' | 'platform', value: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectCategory }) => {
  const currentYear = new Date().getFullYear();

  const handleCategoryClick = (type: 'language' | 'platform', value: string) => {
    if (onSelectCategory) {
      onSelectCategory(type, value);
    } else {
      window.location.hash = 'library';
    }
  };

  return (
    <footer className="w-full max-w-full overflow-hidden bg-[#080c14] border-t border-neutral-800/80 mt-auto text-neutral-400 box-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8 box-border w-full">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 w-full box-border">
          {/* Brand Info & Mission */}
          <div className="md:col-span-2 space-y-4">
            <BrandLogo size="lg" variant="dark" />
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed max-w-md">
              Anidub India is a premier streaming catalog and metadata directory indexing anime officially dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada. We provide comprehensive verification guides and direct viewers to authorized OTT streaming platforms like Crunchyroll and Netflix.
            </p>
            <div className="flex items-center gap-2 text-xs text-neutral-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>India&apos;s Premier Anime Streaming Catalog</span>
            </div>
          </div>

          {/* Regional Languages */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent-theme" />
              <span>Regional Dubs</span>
            </h4>
            <ul className="space-y-2 text-xs">
              {['Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada'].map((lang) => (
                <li key={lang}>
                  <button
                    type="button"
                    onClick={() => handleCategoryClick('language', lang)}
                    className="hover:text-primary-theme transition-colors cursor-pointer text-left"
                  >
                    {lang} Dubbed Anime
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Official OTT Platforms */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">
              Official Platforms
            </h4>
            <ul className="space-y-2 text-xs">
              {['Crunchyroll', 'Netflix', 'JioHotstar', 'JioCinema', 'Prime Video'].map((platform) => (
                <li key={platform}>
                  <button
                    type="button"
                    onClick={() => handleCategoryClick('platform', platform)}
                    className="hover:text-primary-theme transition-colors cursor-pointer text-left"
                  >
                    Anime on {platform}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Subtle, Clean SEO-Rich Knowledge Block for Search Engines & Readers */}
        <section 
          aria-label="About Anidub India and Anime Dubbing in India"
          className="rounded-2xl border border-neutral-800/70 bg-[#060a12]/60 p-4 sm:p-7 text-xs text-neutral-400 space-y-4 leading-relaxed sm:leading-loose w-full max-w-full box-border break-words"
        >
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Sparkles className="w-4 h-4 text-[#ff5722]" />
            <h3>About Anidub India — India&apos;s Premier Anime Streaming Catalog &amp; Verification Guide</h3>
          </div>
          <p>
            <strong className="text-neutral-200">Anidub India</strong> (<strong className="text-neutral-200">Anidub India Official Portal</strong>) is India&apos;s authoritative metadata catalog, verification guide, and directory for anime streaming in Indian regional languages. Designed for discerning enthusiasts across the subcontinent, Anidub India systematically indexes officially dubbed Japanese anime releases in <em>Tamil, Telugu, Hindi, Malayalam, Kannada, and Bengali</em>. This catalog does not host video content, but provides verified metadata, episode indexes, and direct redirection to authorized streaming partners including Crunchyroll, Netflix, JioHotstar, JioCinema, and Prime Video.
          </p>
          <p>
            As Japanese animation expands rapidly across India, premier streaming platforms like <strong>Crunchyroll India, Netflix India, JioHotstar, JioCinema, and Prime Video</strong> continue to invest in authentic regional audio tracks, localized voice casts, and culturally adapted dubbing scripts. Anidub India bridges the gap for viewers by maintaining a verified directory of watch options, episode counts, release years, animation studios, and authenticated metadata—helping users discover official streaming portals.
          </p>
          <p className="text-[11px] text-neutral-500">
            Whether you are searching for popular shonen hits like <em>Jujutsu Kaisen, Demon Slayer, Solo Leveling, Attack on Titan</em>, or timeless anime movies dubbed in your native mother tongue, the <strong>Anidub India Catalog</strong> delivers lightning-fast live search, comprehensive schedule updates, and authenticated links to official streaming platforms.
          </p>
        </section>

        {/* Bottom Bar & Disclaimer */}
        <div className="pt-6 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
          <p>© {currentYear} Anidub India. All rights reserved.</p>
          <p className="text-[11px] text-neutral-400 text-center sm:text-right max-w-md">
            All anime titles, character art, and trademarks are copyright of their respective production studios and streaming partners.
          </p>
        </div>
      </div>
    </footer>
  );
};
