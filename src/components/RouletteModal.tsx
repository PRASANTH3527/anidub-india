import React, { useState, useEffect, useMemo } from 'react';
import { X, Dices, Star, Play, RefreshCw, Tv } from 'lucide-react';
import { Anime, normalizeAnimeList } from '../types';
import { OptimizedImage } from './OptimizedImage';
import { PlatformIcon } from './PlatformIcons';
import { useTranslation } from 'react-i18next';

export interface RouletteModalProps {
  animeList: any[];
  onClose: () => void;
  onSelectAnime: (anime: any) => void;
}

const LANGUAGE_CHIPS = ['Any language', 'Tamil', 'Hindi', 'Telugu', 'Malayalam'] as const;

export const RouletteModal: React.FC<RouletteModalProps> = ({
  animeList: animeListProp,
  onClose,
  onSelectAnime,
}) => {
  const { t } = useTranslation(['tools', 'common']);
  const animeList = useMemo(() => normalizeAnimeList(animeListProp), [animeListProp]);
  const [selectedLang, setSelectedLang] = useState<string>('Any language');
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [isRolling, setIsRolling] = useState<boolean>(false);

  const eligiblePool = useMemo(() => {
    if (selectedLang === 'Any language') return animeList;
    return animeList.filter(
      (a) => Array.isArray(a.languages) && a.languages.includes(selectedLang as any)
    );
  }, [animeList, selectedLang]);

  const rollRandom = (pool: Anime[] = eligiblePool) => {
    if (pool.length === 0) {
      setSelectedAnime(null);
      return;
    }
    setIsRolling(true);
    const randomIndex = Math.floor(Math.random() * pool.length);
    setSelectedAnime(pool[randomIndex]);
    setTimeout(() => setIsRolling(false), 180);
  };

  useEffect(() => {
    rollRandom(eligiblePool);
  }, [selectedLang, animeList]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const verifiedPlatforms = Array.isArray(selectedAnime?.platforms)
    ? selectedAnime!.platforms.filter((p) => Boolean(p && p.trim()))
    : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Surprise Me Anime Picker"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-180"
    >
      <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-t-[20px] sm:rounded-[20px] p-4 sm:p-5 text-[var(--text-primary)] shadow-2xl space-y-4">
        {/* Top Row: Title & 44x44px Close Button */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
              <Dices className="w-4 h-4 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h2 className="text-[16px] sm:text-[18px] font-bold text-[var(--text-primary)]">
                {t('tools:roulette.title', 'Surprise Me')}
              </h2>
              <p className="text-[12px] text-[var(--text-secondary)]">
                {t('tools:roulette.subtitle', 'Instant regional dub recommendation')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Surprise Me modal"
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Language Filter Chips (44px touch targets) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {LANGUAGE_CHIPS.map((chip) => {
            const active = selectedLang === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => setSelectedLang(chip)}
                className={`min-h-[44px] px-3.5 rounded-[10px] text-[12px] font-semibold whitespace-nowrap border transition-colors duration-180 ${
                  active
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {chip === 'Any language'
                  ? t('common:all', 'Any language')
                  : t(`common:languages.${chip.toLowerCase()}`, chip)}
              </button>
            );
          })}
        </div>

        {/* Horizontal 2:3 Poster Preview Card */}
        {selectedAnime ? (
          <div
            className={`rounded-[14px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3.5 flex items-start gap-3.5 transition-opacity duration-180 ${
              isRolling ? 'opacity-60' : 'opacity-100'
            }`}
          >
            <div className="w-24 sm:w-28 aspect-[2/3] rounded-[10px] overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] shrink-0">
              <OptimizedImage
                src={selectedAnime.poster}
                alt={selectedAnime.title}
                width={224}
                height={336}
                loading="lazy"
                className="w-full h-full object-cover"
                aspectRatio="portrait"
              />
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {typeof selectedAnime.rating === 'number' && selectedAnime.rating > 0 ? (
                  <span className="px-2 py-0.5 rounded-[6px] bg-[var(--bg-surface)] text-[#F9C876] border border-[var(--border-subtle)] text-[11px] font-bold inline-flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    {selectedAnime.rating.toFixed(1)}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-[6px] bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] text-[11px]">
                    Score unverified
                  </span>
                )}

                <span className="px-2 py-0.5 rounded-[6px] bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] text-[11px] inline-flex items-center gap-1">
                  <Tv className="w-3 h-3 text-[var(--accent-primary)]" />
                  {selectedAnime.episodesCount && selectedAnime.episodesCount > 0
                    ? `${selectedAnime.episodesCount} eps`
                    : t('common:countNotVerified', 'Count not verified')}
                </span>
              </div>

              <h3 className="text-[16px] font-bold text-[var(--text-primary)] leading-snug line-clamp-2">
                {selectedAnime.title}
              </h3>

              {/* Regional Dub Badges */}
              <div className="flex flex-wrap gap-1">
                {(selectedAnime.languages || []).map((lang) => (
                  <span
                    key={lang}
                    className="px-2 py-0.5 rounded-[6px] bg-[var(--accent-primary)]/15 text-[var(--accent-hover)] border border-[var(--accent-primary)]/30 text-[10px] font-bold uppercase"
                  >
                    {lang}
                  </span>
                ))}
              </div>

              {/* Verified OTT Badge */}
              <div className="text-[12px] text-[var(--text-secondary)] pt-0.5">
                {verifiedPlatforms.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-[var(--text-primary)] font-medium">
                    <PlatformIcon platform={verifiedPlatforms[0]} className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Available on {verifiedPlatforms.join(', ')}</span>
                  </span>
                ) : (
                  <span>OTT availability not verified</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[14px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-6 text-center text-[13px] text-[var(--text-secondary)]">
            No dubbed anime found for this language filter.
          </div>
        )}

        {/* Action Hierarchy:
            1. Full-width #B49AF8 Primary CTA ("View anime details")
            2. Secondary "Roll again" button below */}
        <div className="space-y-2 pt-1">
          {selectedAnime && (
            <button
              type="button"
              onClick={() => {
                onSelectAnime(selectedAnime);
                onClose();
              }}
              className="w-full min-h-[44px] sm:min-h-[48px] px-5 rounded-[12px] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-on-primary)] font-bold text-[14px] flex items-center justify-center gap-2 transition-colors duration-180 shadow-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{t('tools:roulette.viewDetails', 'View anime details')}</span>
            </button>
          )}

          <button
            type="button"
            aria-label="Roll Random Anime"
            onClick={() => rollRandom(eligiblePool)}
            className="w-full min-h-[44px] px-4 rounded-[12px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-semibold text-[13px] flex items-center justify-center gap-2 transition-colors duration-180"
          >
            <RefreshCw className={`w-4 h-4 text-[var(--accent-primary)] ${isRolling ? 'animate-spin' : ''}`} />
            <span>{t('tools:roulette.rollCta', 'Roll again')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
