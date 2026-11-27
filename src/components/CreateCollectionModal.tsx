import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  Trash2,
  Search,
  Film,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  X,
  Plus,
} from 'lucide-react';
import { AniDubLogo } from './AniDubLogo';
import { Anime } from './CatalogView';
import { Button } from './ui/Button';

export interface CreatedCollectionSummary {
  id: string;
  title: string;
  count: number;
  shareUrl: string;
  desc: string;
}

export interface CreateCollectionUIProps {
  animeList: Anime[];
  onBack: () => void;
  onSelectAnime?: (anime: Anime) => void;
}

export interface CreateCollectionModalProps {
  onClose: () => void;
  animeList: Anime[];
  onSelectAnime?: (anime: Anime) => void;
}

const TITLE_SUGGESTIONS = [
  'Top Hindi Dubbed Action',
  'Best Tamil Anime Thrillers',
  'Weekend Telugu Dub Binge',
  'Emotional Dubbed Masterpieces',
  'Top Shonen Indian Dubs',
];

export const CreateCollectionUI: React.FC<CreateCollectionUIProps> = ({
  animeList,
  onBack,
}) => {
  const [collectionTitle, setCollectionTitle] = useState('My Curated Regional Anime Dubs');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLang, setSelectedLang] = useState('All');
  const [createdCollection, setCreatedCollection] = useState<CreatedCollectionSummary | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSaveCollection = () => {
    if (!collectionTitle.trim() || selectedIds.length === 0) return;
    const colId = `col_${Date.now().toString(36)}`;
    const encoded = encodeURIComponent(collectionTitle.trim());
    const ids = selectedIds.join(',');
    const shareUrl = `${window.location.origin}/?collection=${encoded}&ids=${ids}`;

    const newCol: CreatedCollectionSummary = {
      id: colId,
      title: collectionTitle.trim(),
      count: selectedIds.length,
      shareUrl,
      desc: `Curated regional anime collection with ${selectedIds.length} titles.`,
    };

    try {
      const existing: CreatedCollectionSummary[] = JSON.parse(localStorage.getItem('cf_user_collections') || '[]');
      localStorage.setItem('cf_user_collections', JSON.stringify([newCol, ...existing]));
    } catch {}

    setCreatedCollection(newCol);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopyLink = () => {
    if (!createdCollection) return;
    navigator.clipboard?.writeText(createdCollection.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const filteredCatalog = animeList.filter((anime) => {
    const matchesSearch = !searchQuery.trim() ||
      anime.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (anime.genres && anime.genres.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesLang = selectedLang === 'All' ||
      (anime.languages && anime.languages.toLowerCase().includes(selectedLang.toLowerCase()));

    return matchesSearch && matchesLang;
  });

  const queueAnime = animeList.filter(a => selectedIds.includes(a.id));

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 text-[var(--text-primary)] font-sans">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-8 border-b border-[var(--border-subtle)]">
        <div>
          <button
            onClick={onBack}
            className="min-h-[40px] inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs sm:text-sm font-bold mb-3 cursor-pointer transition-colors duration-150"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Directory</span>
          </button>

          <div className="flex items-center gap-3.5">
            <AniDubLogo variant="horizontal" size="md" className="shrink-0" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tight">
                  Create Custom Collection
                </h1>
                <span className="bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/30 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase">
                  Anonymous &amp; Shareable
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
                Curate regional dubbed anime into a shareable playlist for your friends and community.
              </p>
            </div>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <Button
            onClick={handleSaveCollection}
            variant="primary"
            size="lg"
            className="self-stretch sm:self-auto"
          >
            Save Collection ({selectedIds.length})
          </Button>
        )}
      </div>

      {createdCollection && (
        <div className="my-8 p-6 sm:p-8 rounded-2xl bg-[var(--bg-surface)] border border-[#34D399]/40 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/35 px-3 py-1 rounded-full text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
                <span>Collection Saved Successfully</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
                {createdCollection.title}
              </h2>

              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span>{createdCollection.count} regional dubbed titles curated</span>
                <span>•</span>
                <span className="bg-[var(--bg-elevated)] px-2 py-0.5 rounded border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-primary)]">
                  ID: #{createdCollection.id}
                </span>
              </div>
            </div>

            <div className="w-full lg:w-auto flex flex-col sm:flex-row items-center gap-2.5">
              <div className="w-full sm:w-80 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-1.5 flex items-center justify-between">
                <input
                  type="text"
                  readOnly
                  value={createdCollection.shareUrl}
                  className="bg-transparent text-xs text-[var(--text-primary)] px-2.5 outline-none w-full truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="min-h-[36px] bg-[#34D399] hover:opacity-90 text-[var(--accent-on-primary)] font-black text-xs px-3 py-1.5 rounded-lg shrink-0 transition-opacity duration-150 cursor-pointer"
                >
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  window.location.href = createdCollection.shareUrl;
                }}
                rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                className="w-full sm:w-auto text-xs"
              >
                View Published List
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCreatedCollection(null);
                  setSelectedIds([]);
                  setCollectionTitle('');
                }}
                className="w-full sm:w-auto text-xs"
              >
                New List
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8 items-start">
        <div className="lg:col-span-5">
          <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-5 sticky top-20 shadow-xl">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                1. Collection Title *
              </label>
              <input
                type="text"
                value={collectionTitle}
                onChange={(e) => setCollectionTitle(e.target.value)}
                placeholder="e.g. Best Tamil Dubbed Action Animes"
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors duration-150"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] text-[var(--text-secondary)] font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#F9C876]" />
                <span>Title Suggestions:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TITLE_SUGGESTIONS.map((sug, sIdx) => (
                  <button
                    key={`suggestion_${sIdx}`}
                    type="button"
                    onClick={() => setCollectionTitle(sug)}
                    className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]/60 transition-colors duration-150 cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    2. Selected Queue
                  </span>
                  <span className="bg-[var(--bg-elevated)] text-[var(--accent-primary)] border border-[var(--border-subtle)] text-[10px] font-black px-2 py-0.5 rounded-full">
                    {selectedIds.length} titles
                  </span>
                </div>

                {selectedIds.length > 0 && (
                  <button
                    onClick={() => setSelectedIds([])}
                    className="text-xs text-[var(--text-secondary)] hover:text-[#F87171] inline-flex items-center gap-1 cursor-pointer transition-colors duration-150"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear all</span>
                  </button>
                )}
              </div>

              {queueAnime.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 text-center space-y-2">
                  <Film className="w-8 h-8 text-[var(--text-secondary)] mx-auto" />
                  <p className="text-xs text-[var(--text-primary)] font-medium">
                    No anime selected yet.
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Click &quot;Add to List&quot; on any anime card from the catalog on the right.
                  </p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {queueAnime.map((anime, idx) => (
                    <div
                      key={`queue_item_${anime.id}_${idx}`}
                      className="p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[10px] font-mono text-[var(--text-secondary)] w-4">
                          {idx + 1}.
                        </span>
                        <img
                          src={anime.cover_image ? anime.cover_image : '/logo.png'}
                          alt={anime.title}
                          width={32}
                          height={44}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.currentTarget.src = '/logo.png';
                          }}
                          className="w-8 h-11 rounded-lg object-cover shrink-0 border border-[var(--border-subtle)]"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[170px]">
                            {anime.title}
                          </h4>
                          <span className="text-[10px] text-[var(--text-secondary)] truncate">
                            {anime.languages || 'Hindi, Tamil, Telugu'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleSelect(anime.id)}
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[#F87171] hover:bg-[var(--bg-surface)] transition-colors duration-150 cursor-pointer"
                        title="Remove from queue"
                        aria-label={`Remove ${anime.title} from queue`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={handleSaveCollection}
              disabled={selectedIds.length === 0 || !collectionTitle.trim()}
              variant="primary"
              size="lg"
              fullWidth
            >
              Publish Custom Collection ({selectedIds.length})
            </Button>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[var(--text-primary)]">
                Select Anime for Collection
              </h3>
              <span className="text-xs text-[var(--text-secondary)] font-semibold">
                {filteredCatalog.length} available
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search catalog by title or genre..."
                className="w-full min-h-[44px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors duration-150"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              {['All', 'Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada'].map((lang) => {
                const isActive = selectedLang === lang;
                return (
                  <button
                    key={lang}
                    onClick={() => setSelectedLang(lang)}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer shrink-0 border ${
                      isActive
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {filteredCatalog.map((anime, idx) => {
              const isSelected = selectedIds.includes(anime.id);
              const languages = anime.languages ? anime.languages.split(',').map((l: string) => l.trim()) : ['Hindi', 'Tamil', 'Telugu'];

              return (
                <div
                  key={`selectable_anime_${anime.id}_${idx}`}
                  className={`rounded-2xl bg-[var(--bg-surface)] border transition-colors duration-150 overflow-hidden flex flex-col justify-between shadow-md ${
                    isSelected
                      ? 'border-[#34D399] ring-1 ring-[#34D399]/50'
                      : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/60'
                  }`}
                >
                  <div className="relative aspect-[3/4.2] w-full overflow-hidden bg-[var(--bg-elevated)]">
                    <img
                      src={anime.cover_image ? anime.cover_image : '/logo.png'}
                      alt={anime.title}
                      width={240}
                      height={336}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.src = '/logo.png';
                      }}
                      className="w-full h-full object-cover"
                    />

                    {isSelected && (
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#34D399] text-[var(--accent-on-primary)] flex items-center justify-center shadow-lg">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}

                    <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                      {languages.slice(0, 2).map((l, lIdx) => (
                        <span
                          key={`selectable_lang_${anime.id}_${l}_${lIdx}`}
                          className="bg-[var(--bg-canvas)]/85 border border-[var(--border-subtle)] text-[9px] font-bold text-[#F9C876] px-1.5 py-0.5 rounded"
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)] line-clamp-1 leading-snug">
                        {anime.title}
                      </h4>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                        {anime.type || 'TV Series'} • {anime.platform || 'Not verified'}
                      </p>
                    </div>

                    <button
                      onClick={() => toggleSelect(anime.id)}
                      className={`min-h-[38px] w-full py-1.5 px-2 rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer flex items-center justify-center gap-1 border ${
                        isSelected
                          ? 'bg-[#34D399]/15 border-[#34D399]/40 text-[#34D399]'
                          : 'bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to List</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({
  onClose,
  animeList,
  onSelectAnime,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg-canvas)]">
      <div className="min-h-screen w-full">
        <CreateCollectionUI
          animeList={animeList}
          onBack={onClose}
          onSelectAnime={onSelectAnime}
        />
      </div>
    </div>
  );
};
