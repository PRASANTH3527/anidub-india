import React, { useState, useMemo } from 'react';
import {
  X, Star, Tv, Calendar, Globe, Layers, ArrowRightLeft, Search, Share2, Plus, Check
} from 'lucide-react';
import { Anime, normalizeAnimeList, normalizeAnimeRecord } from '../types';
import { PlatformIcon } from './PlatformIcons';
import { OptimizedImage } from './OptimizedImage';
import { useTranslation } from 'react-i18next';

export interface CompareAnimeModalProps {
  animeList?: any[];
  catalogList?: any[];
  initialAnime1?: any | null;
  initialLeftAnime?: any | null;
  initialAnime2?: any | null;
  onClose: () => void;
  onSelectAnime: (anime: any) => void;
  asPage?: boolean;
}

export const CompareAnimeModal: React.FC<CompareAnimeModalProps> = ({
  animeList: animeListProp,
  catalogList,
  initialAnime1 = null,
  initialLeftAnime = null,
  initialAnime2 = null,
  onClose,
  onSelectAnime,
  asPage = false,
}) => {
  const { t } = useTranslation(['tools', 'common']);
  const animeList = useMemo(
    () => normalizeAnimeList(animeListProp || catalogList || []),
    [animeListProp, catalogList]
  );
  const startA = initialAnime1 || initialLeftAnime;
  const [anime1, setAnime1] = useState<Anime | null>(
    startA ? normalizeAnimeRecord(startA) : animeList[0] || null
  );
  const [anime2, setAnime2] = useState<Anime | null>(
    initialAnime2 ? normalizeAnimeRecord(initialAnime2) : animeList[1] || null
  );
  const [pickerSlot, setPickerSlot] = useState<'A' | 'B' | null>(null);
  const [pickerQuery, setPickerQuery] = useState<string>('');
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  const filteredPickerAnime = useMemo(() => {
    const q = pickerQuery.toLowerCase().trim();
    if (!q) return animeList.slice(0, 36);
    return animeList
      .filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.japaneseTitle && a.japaneseTitle.toLowerCase().includes(q)) ||
          (a.languages || []).some((l: string) => l.toLowerCase().includes(q))
      )
      .slice(0, 36);
  }, [animeList, pickerQuery]);

  const handleSwap = () => {
    setAnime1(anime2);
    setAnime2(anime1);
  };

  const handleOpenPicker = (slot: 'A' | 'B') => {
    setPickerSlot(slot);
    setPickerQuery('');
  };

  const handlePickAnime = (chosen: Anime) => {
    if (pickerSlot === 'A') {
      setAnime1(chosen);
    } else if (pickerSlot === 'B') {
      setAnime2(chosen);
    }
    setPickerSlot(null);
  };

  const handleShareComparison = () => {
    const titleA = anime1?.title || 'Anime A';
    const titleB = anime2?.title || 'Anime B';
    const shareText = `Comparing ${titleA} vs ${titleB} (Regional Dubs & Indian OTT Availability) on AniDub India`;
    const shareUrl = window.location.href;
    if (navigator.share) {
      navigator.share({ title: `${titleA} vs ${titleB}`, text: shareText, url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${shareText} — ${shareUrl}`);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    }
  };

  const getWatchDurationLabel = (anime: Anime | null) => {
    if (!anime || !anime.episodesCount || anime.episodesCount <= 0) return t('common:notVerified', 'Not verified');
    const totalHours = Math.round((anime.episodesCount * 24) / 60);
    return `~${totalHours} hrs (${anime.episodesCount} eps)`;
  };

  const renderSlotHeader = (slot: 'A' | 'B', anime: Anime | null, label: string) => (
    <div className="rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3.5 sm:p-4 flex flex-col items-center text-center">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-primary)] mb-2">
        {label}
      </span>

      {anime ? (
        <>
          <div
            onClick={() => onSelectAnime(anime)}
            className="w-24 sm:w-32 aspect-[2/3] rounded-[12px] overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-subtle)] mb-3 cursor-pointer shadow-md"
          >
            <OptimizedImage
              src={anime.poster}
              alt={anime.title}
              className="w-full h-full object-cover"
              aspectRatio="portrait"
            />
          </div>
          <h3 className="text-[14px] sm:text-[15px] font-bold text-[var(--text-primary)] line-clamp-2 min-h-[40px] mb-2">
            {anime.title}
          </h3>
          <button
            type="button"
            onClick={() => handleOpenPicker(slot)}
            className="w-full min-h-[44px] px-3 rounded-[10px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] text-[var(--accent-hover)] border border-[var(--border-subtle)] text-[12px] font-semibold transition-colors duration-180"
          >
            Change anime
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => handleOpenPicker(slot)}
          className="w-full aspect-[2/3] max-w-[130px] rounded-[12px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] border border-dashed border-[var(--accent-primary)]/50 flex flex-col items-center justify-center gap-2 p-4 text-[var(--accent-hover)] transition-colors"
        >
          <Plus className="w-6 h-6 text-[var(--accent-primary)]" />
          <span className="text-[12px] font-bold">{label}</span>
        </button>
      )}
    </div>
  );

  const innerContent = (
    <div
      className={
        asPage
          ? 'max-w-[1040px] mx-auto px-4 sm:px-6 pt-5 pb-24 text-[var(--text-primary)]'
          : 'relative w-full max-w-4xl max-h-[92vh] bg-[var(--bg-canvas)] text-[var(--text-primary)] rounded-t-[20px] sm:rounded-[20px] border border-[var(--border-subtle)] shadow-2xl overflow-y-auto p-4 sm:p-6'
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--accent-primary)] mb-1">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Side-by-Side Matrix</span>
          </div>
          <h1 className="text-[24px] sm:text-[30px] font-bold text-[var(--text-primary)] leading-[1.2] tracking-[-0.02em]">
            {t('tools:compare.title', 'Compare Anime')}
          </h1>
          <p className="text-[12px] sm:text-[13px] text-[var(--text-secondary)] mt-0.5">
            {t('tools:compare.subtitle', 'Compare regional dub coverage, OTT platforms, and ratings side by side')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSwap}
            aria-label="Swap Anime A and Anime B"
            className="min-h-[44px] px-3.5 rounded-[12px] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-[12px] font-semibold inline-flex items-center gap-1.5"
          >
            <ArrowRightLeft className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>{t('tools:compare.swap', 'Swap')}</span>
          </button>
          {!asPage && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Compare Anime"
              className="min-h-[44px] min-w-[44px] rounded-[12px] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Two 2:3 Poster Slots (Select Anime A / Select Anime B) */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-5 mb-6">
        {renderSlotHeader('A', anime1, t('tools:compare.selectAnimeA', 'Select Anime A'))}
        {renderSlotHeader('B', anime2, t('tools:compare.selectAnimeB', 'Select Anime B'))}
      </div>

      {/* Comparison Matrix Rows */}
      <div className="rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden mb-6">
        {/* Row 1: Catalog Score */}
        <div className="p-3.5 sm:p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] text-center mb-2 flex items-center justify-center gap-1">
            <Star className="w-3.5 h-3.5 text-[#F9C876]" />
            <span>Rating</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-2.5 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[14px] font-bold text-[var(--text-primary)]">
              {anime1?.rating && anime1.rating > 0 ? `${anime1.rating.toFixed(1)} / 10` : t('common:notVerified', 'Not verified')}
            </div>
            <div className="p-2.5 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[14px] font-bold text-[var(--text-primary)]">
              {anime2?.rating && anime2.rating > 0 ? `${anime2.rating.toFixed(1)} / 10` : t('common:notVerified', 'Not verified')}
            </div>
          </div>
        </div>

        {/* Row 2: Regional Dub Languages */}
        <div className="p-3.5 sm:p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] text-center mb-2 flex items-center justify-center gap-1">
            <Globe className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Dub languages</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[anime1, anime2].map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-center gap-1.5"
              >
                {item && Array.isArray(item.languages) && item.languages.length > 0 ? (
                  item.languages.map((lang) => (
                    <span
                      key={lang}
                      className="px-2 py-0.5 rounded-[6px] bg-[var(--accent-primary)]/15 text-[var(--accent-hover)] border border-[var(--accent-primary)]/30 text-[11px] font-bold"
                    >
                      {lang}
                    </span>
                  ))
                ) : (
                  <span className="text-[12px] text-[var(--text-secondary)]">{t('common:notVerified', 'Not verified')}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Row 3: OTT Availability (India) */}
        <div className="p-3.5 sm:p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] text-center mb-2 flex items-center justify-center gap-1">
            <Tv className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>OTT availability</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[anime1, anime2].map((item, idx) => {
              const platforms = Array.isArray(item?.platforms)
                ? item!.platforms.filter((p) => Boolean(p && p.trim()))
                : [];
              return (
                <div
                  key={idx}
                  className="p-2.5 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-center gap-1.5"
                >
                  {platforms.length > 0 ? (
                    platforms.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-primary)]"
                      >
                        <PlatformIcon platform={p} className="w-3 h-3 text-[var(--accent-primary)]" />
                        <span>{p}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-[12px] text-[var(--text-secondary)]">{t('common:notVerified', 'Not verified')}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 4: Episodes & Watch Duration */}
        <div className="p-3.5 sm:p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] text-center mb-2 flex items-center justify-center gap-1">
            <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Episodes &amp; Watch duration</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-2.5 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-primary)]">
              {getWatchDurationLabel(anime1)}
            </div>
            <div className="p-2.5 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-primary)]">
              {getWatchDurationLabel(anime2)}
            </div>
          </div>
        </div>

        {/* Row 5: Release Year & Status */}
        <div className="p-3.5 sm:p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] text-center mb-2 flex items-center justify-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Release &amp; Status</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-2.5 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)]">
              {anime1?.releaseYear || 'Year N/A'} • {anime1?.status || 'Unverified'}
            </div>
            <div className="p-2.5 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)]">
              {anime2?.releaseYear || 'Year N/A'} • {anime2?.status || 'Unverified'}
            </div>
          </div>
        </div>
      </div>

      {/* Share Comparison Button (44px) */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleShareComparison}
          className="min-h-[44px] px-6 rounded-[12px] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-on-primary)] font-bold text-[14px] inline-flex items-center gap-2 transition-colors duration-180 shadow-sm"
        >
          {copiedShare ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          <span>{copiedShare ? 'Comparison link copied!' : 'Share comparison'}</span>
        </button>
      </div>

      {/* Searchable Poster Picker Modal / Bottom Sheet */}
      {pickerSlot && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Select Anime ${pickerSlot}`}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-2xl max-h-[85vh] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-t-[20px] sm:rounded-[20px] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <h2 className="text-[16px] font-bold text-[var(--text-primary)]">
                Select Anime {pickerSlot}
              </h2>
              <button
                type="button"
                onClick={() => setPickerSlot(null)}
                aria-label="Close anime picker"
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[10px] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 border-b border-[var(--border-subtle)]">
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder={t('tools:compare.searchPlaceholder', 'Search anime to compare...')}
                  className="w-full min-h-[44px] pl-10 pr-4 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>

            <div className="overflow-y-auto p-3.5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredPickerAnime.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePickAnime(item)}
                  className="rounded-[12px] bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] p-2.5 text-left flex items-center gap-2.5 transition-colors"
                >
                  <div className="w-12 aspect-[2/3] rounded-[8px] overflow-hidden bg-[var(--bg-surface)] shrink-0">
                    <OptimizedImage
                      src={item.poster}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      aspectRatio="portrait"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[var(--text-primary)] line-clamp-2">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] truncate">
                      {(item.languages || []).slice(0, 2).join(', ')}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (asPage) return innerContent;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
      {innerContent}
    </div>
  );
};
