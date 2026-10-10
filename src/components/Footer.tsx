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
              Anidub India is the premier open directory documenting anime officially dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada. We verify legitimate OTT streaming links to support official anime creators and local Indian voice artists.
            </p>
            <div className="flex items-center gap-2 text-xs text-neutral-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>100% Legal &amp; Licensed Indian Streaming Directory</span>
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
            <h3>About Anidub India — The Premier Destination for Anime Streaming &amp; Dubbing in India</h3>
          </div>
          <p>
            <strong className="text-neutral-200">Anidub India</strong> (<strong className="text-neutral-200">Anidub India Official Website</strong>) is India&apos;s authoritative guide, catalog, and premier destination for anime streaming and dubbing in India. Founded to empower anime enthusiasts across the subcontinent, Anidub India tracks officially licensed Japanese anime releases dubbed into Indian regional languages—including <em>Tamil, Telugu, Hindi, Malayalam, Kannada, and Bengali</em>.
          </p>
          <p>
            As Japanese animation explodes in popularity across India, premier streaming platforms like <strong>Crunchyroll India, Netflix India, JioHotstar, JioCinema, and Prime Video</strong> are actively investing in authentic regional audio tracks, localized voice casts, and culturally rich dubbing scripts. Anidub India bridges the gap for viewers by maintaining a verified directory of legal watch options, episode counts, release years, animation studios, and community ratings—eliminating piracy and supporting official creators and local dubbing artists.
          </p>
          <p className="text-[11px] text-neutral-500">
            Whether you are searching for popular shonen hits like <em>Jujutsu Kaisen, Demon Slayer, Solo Leveling, Attack on Titan</em>, or timeless anime movies dubbed in your native mother tongue, the <strong>Anidub India Official Website</strong> delivers lightning-fast live search, comprehensive schedule updates, and community-verified streaming availability for anime streaming and dubbing in India.
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
