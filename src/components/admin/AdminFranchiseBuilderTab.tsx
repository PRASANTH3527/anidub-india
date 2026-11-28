import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Plus,
  Search,
  ArrowUp,
  ArrowDown,
  Trash2,
  Loader2,
  AlertTriangle,
  Film,
  X,
  Check,
} from 'lucide-react';
import { cloudflareApi } from '../../services/cloudflareApi';
import {
  FRANCHISE_BUILDER_RELATION_OPTIONS,
  formatFranchiseDisplayTitle,
  normalizeFranchiseKey,
  reorderFranchiseEntries,
  type AdminFranchiseEntry,
} from '../../utils/adminPhase3Intelligence';

export interface AdminFranchiseBuilderTabProps {
  catalog: any[];
  initialFranchiseKey?: string | null;
  onEditAnimeInEditor?: (anime: any) => void;
  onSuccess?: (msg: string) => void;
}

interface FranchiseSummaryItem {
  franchise_key: string;
  display_title: string;
  entry_count: number;
  updated_at: string;
}

interface CatalogSearchCandidate {
  id: string;
  title: string;
  poster?: string;
  year?: number | null;
  type?: string;
  status?: string;
}

function mapCatalogCandidate(raw: any): CatalogSearchCandidate | null {
  if (!raw || raw.id === undefined || raw.id === null) return null;
  const id = String(raw.id).trim();
  const title = String(raw.title || '').trim();
  if (!id || !title) return null;
  const yearNum = Number(raw.releaseYear ?? raw.year);
  return {
    id,
    title,
    poster: raw.poster || raw.cover_image || raw.image || undefined,
    year: Number.isFinite(yearNum) && yearNum > 1900 ? yearNum : null,
    type: raw.type ? String(raw.type) : undefined,
    status: raw.status ? String(raw.status) : undefined,
  };
}

export const AdminFranchiseBuilderTab: React.FC<AdminFranchiseBuilderTabProps> = ({
  catalog = [],
  initialFranchiseKey = null,
  onSuccess,
}) => {
  const [franchises, setFranchises] = useState<FranchiseSummaryItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>(
    initialFranchiseKey ? normalizeFranchiseKey(initialFranchiseKey) : ''
  );
  const [entries, setEntries] = useState<AdminFranchiseEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingEntries, setLoadingEntries] = useState<boolean>(false);
  const [adding, setAdding] = useState<boolean>(false);
  const [reordering, setReordering] = useState<boolean>(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inline "+ New" Series Creator state
  const [showNewSeriesInput, setShowNewSeriesInput] = useState<boolean>(false);
  const [newSeriesName, setNewSeriesName] = useState<string>('');
  const newSeriesInputRef = useRef<HTMLInputElement | null>(null);

  // Live debounced D1 Catalog Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<CatalogSearchCandidate[]>([]);
  const [searchingCatalog, setSearchingCatalog] = useState<boolean>(false);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [selectedAnime, setSelectedAnime] = useState<CatalogSearchCandidate | null>(null);
  const [relationLabel, setRelationLabel] = useState<string>(FRANCHISE_BUILDER_RELATION_OPTIONS[0]);
  const [entryNote, setEntryNote] = useState<string>('');
  const searchSeqRef = useRef<number>(0);

  const existingAnimeIdSet = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      set.add(String(entry.anime_id).trim());
    }
    return set;
  }, [entries]);

  const activeSeriesTitle = useMemo(() => {
    if (!selectedKey) return '';
    const match = franchises.find((f) => f.franchise_key === selectedKey);
    return match?.display_title || formatFranchiseDisplayTitle(selectedKey);
  }, [franchises, selectedKey]);

  const localFallbackCandidates = useMemo(() => {
    const list: CatalogSearchCandidate[] = [];
    for (const item of catalog) {
      const mapped = mapCatalogCandidate(item);
      if (mapped) list.push(mapped);
    }
    return list;
  }, [catalog]);

  // Initial load of franchise list & entries
  const loadInitialFranchises = useCallback(async (preferredKey?: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const normalizedPref = preferredKey ? normalizeFranchiseKey(preferredKey) : undefined;
      const res = await cloudflareApi.fetchAdminFranchises(normalizedPref);
      const list: FranchiseSummaryItem[] = (res.franchises || []).map((f) => ({
        franchise_key: f.franchise_key,
        display_title: f.display_title || formatFranchiseDisplayTitle(f.franchise_key),
        entry_count: Number(f.entry_count) || 0,
        updated_at: f.updated_at || '',
      }));

      const nextKey = normalizedPref || res.selectedFranchiseKey || (list[0]?.franchise_key ?? '');
      if (nextKey && !list.some((f) => f.franchise_key === nextKey)) {
        list.unshift({
          franchise_key: nextKey,
          display_title: formatFranchiseDisplayTitle(nextKey),
          entry_count: (res.entries || []).length,
          updated_at: '',
        });
      }

      setFranchises(list);
      setSelectedKey(nextKey);
      setEntries(Array.isArray(res.entries) ? res.entries : []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load series watch orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialFranchises(initialFranchiseKey || undefined);
  }, [initialFranchiseKey, loadInitialFranchises]);

  // Load entries when switching series
  const handleSelectSeries = useCallback(async (nextKey: string) => {
    const normalized = normalizeFranchiseKey(nextKey);
    setSelectedKey(normalized);
    setErrorMsg(null);
    if (!normalized) {
      setEntries([]);
      return;
    }

    setLoadingEntries(true);
    try {
      const res = await cloudflareApi.fetchAdminFranchiseByKey(normalized);
      const loaded = Array.isArray(res.entries) ? res.entries : [];
      setEntries(loaded);
      setFranchises((prev) =>
        prev.map((f) =>
          f.franchise_key === normalized ? { ...f, entry_count: loaded.length } : f
        )
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load watch order entries.');
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  // Create / open new series inline
  const handleCreateSeries = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const rawName = newSeriesName.trim();
      const slug = normalizeFranchiseKey(rawName);
      if (!slug || slug.length < 2) {
        setErrorMsg('Enter a series name with at least 2 characters.');
        return;
      }

      const displayTitle = rawName.length >= 2 ? rawName : formatFranchiseDisplayTitle(slug);
      setFranchises((prev) => {
        if (prev.some((f) => f.franchise_key === slug)) return prev;
        return [
          {
            franchise_key: slug,
            display_title: displayTitle,
            entry_count: 0,
            updated_at: '',
          },
          ...prev,
        ];
      });

      setShowNewSeriesInput(false);
      setNewSeriesName('');
      await handleSelectSeries(slug);
    },
    [newSeriesName, handleSelectSeries]
  );

  useEffect(() => {
    if (showNewSeriesInput) {
      setTimeout(() => newSeriesInputRef.current?.focus(), 30);
    }
  }, [showNewSeriesInput]);

  // Debounced server-side D1 catalog search (no 30-item client cap)
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchingCatalog(false);
      return;
    }

    const seq = ++searchSeqRef.current;
    setSearchingCatalog(true);

    const timer = window.setTimeout(async () => {
      try {
        const res = await cloudflareApi.fetchCatalog({
          search: query,
          page: 1,
          limit: 25,
          includePending: true,
        });
        if (seq !== searchSeqRef.current) return;

        if (res.ok && Array.isArray(res.data)) {
          const mapped = res.data
            .map(mapCatalogCandidate)
            .filter((item): item is CatalogSearchCandidate => item !== null);
          setSearchResults(mapped);
        } else {
          const lower = query.toLowerCase();
          setSearchResults(
            localFallbackCandidates
              .filter((c) => c.title.toLowerCase().includes(lower) || c.id === query)
              .slice(0, 25)
          );
        }
      } catch {
        if (seq !== searchSeqRef.current) return;
        const lower = query.toLowerCase();
        setSearchResults(
          localFallbackCandidates
            .filter((c) => c.title.toLowerCase().includes(lower) || c.id === query)
            .slice(0, 25)
        );
      } finally {
        if (seq === searchSeqRef.current) {
          setSearchingCatalog(false);
        }
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [searchQuery, localFallbackCandidates]);

  const isSelectedDuplicate = Boolean(selectedAnime && existingAnimeIdSet.has(selectedAnime.id));

  // Add selected anime to active watch order
  const handleAddEntry = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedKey) {
        setErrorMsg('Select or create a series first.');
        return;
      }
      if (!selectedAnime) {
        setErrorMsg('Search and select an anime from the catalog.');
        return;
      }
      if (isSelectedDuplicate) {
        setErrorMsg(`"${selectedAnime.title}" is already in this watch order.`);
        return;
      }

      setAdding(true);
      setErrorMsg(null);
      try {
        const res = await cloudflareApi.addAdminFranchiseEntry(selectedKey, {
          anime_id: selectedAnime.id,
          relation_label: relationLabel,
          note: entryNote.trim() || null,
        });

        const updatedEntries = Array.isArray(res.entries)
          ? res.entries
          : res.entry
            ? [...entries, res.entry]
            : entries;

        setEntries(updatedEntries);
        setFranchises((prev) => {
          const exists = prev.some((f) => f.franchise_key === selectedKey);
          if (!exists) {
            return [
              {
                franchise_key: selectedKey,
                display_title: formatFranchiseDisplayTitle(selectedKey),
                entry_count: updatedEntries.length,
                updated_at: new Date().toISOString(),
              },
              ...prev,
            ];
          }
          return prev.map((f) =>
            f.franchise_key === selectedKey
              ? { ...f, entry_count: updatedEntries.length }
              : f
          );
        });

        const addedTitle = selectedAnime.title;
        setSelectedAnime(null);
        setSearchQuery('');
        setSearchResults([]);
        setSearchOpen(false);
        setEntryNote('');
        onSuccess?.(`Added "${addedTitle}" to ${activeSeriesTitle || selectedKey}`);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to add anime to watch order.');
      } finally {
        setAdding(false);
      }
    },
    [
      selectedKey,
      selectedAnime,
      isSelectedDuplicate,
      relationLabel,
      entryNote,
      entries,
      activeSeriesTitle,
      onSuccess,
    ]
  );

  // Instant 1-tap up/down reorder with optimistic UI + atomic D1 batch persistence
  const handleMoveEntry = useCallback(
    async (index: number, direction: 'up' | 'down') => {
      if (!selectedKey || reordering) return;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= entries.length) return;

      const previousEntries = entries;
      const nextEntries = reorderFranchiseEntries(entries, index, direction);
      setEntries(nextEntries);
      setReordering(true);
      setErrorMsg(null);

      try {
        const entryIds = nextEntries
          .map((e) => e.id)
          .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0);
        const animeIds = nextEntries.map((e) => String(e.anime_id));

        const res = await cloudflareApi.reorderAdminFranchiseEntries(selectedKey, {
          ...(entryIds.length === nextEntries.length ? { entryIds } : {}),
          animeIds,
        });

        if (Array.isArray(res.entries) && res.entries.length > 0) {
          setEntries(res.entries);
        }
      } catch (err: any) {
        setEntries(previousEntries);
        setErrorMsg(err?.message || 'Failed to save new watch order.');
      } finally {
        setReordering(false);
      }
    },
    [selectedKey, entries, reordering]
  );

  // 1-tap remove + automatic re-sequence 1..N
  const handleDeleteEntry = useCallback(
    async (entry: AdminFranchiseEntry) => {
      if (!selectedKey) return;
      const targetId = entry.id ?? entry.anime_id;
      const rowKey = `${entry.id ?? ''}:${entry.anime_id}`;
      setDeletingKey(rowKey);
      setErrorMsg(null);

      try {
        const res = await cloudflareApi.deleteAdminFranchiseEntryById(selectedKey, targetId);
        const remaining = Array.isArray(res.entries)
          ? res.entries
          : entries
              .filter((e) => e.anime_id !== entry.anime_id)
              .map((e, idx) => ({ ...e, watch_order: idx + 1 }));

        setEntries(remaining);
        setFranchises((prev) =>
          prev.map((f) =>
            f.franchise_key === selectedKey
              ? { ...f, entry_count: remaining.length }
              : f
          )
        );
        onSuccess?.(`Removed "${entry.title || `#${entry.anime_id}`}" from watch order`);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to remove entry.');
      } finally {
        setDeletingKey(null);
      }
    },
    [selectedKey, entries, onSuccess]
  );

  const previewSlug = normalizeFranchiseKey(newSeriesName);

  return (
    <div className="space-y-3.5 pb-24 max-w-full" data-testid="admin-franchise-builder">
      {/* Inline dismissible error banner */}
      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl bg-rose-500/15 border border-rose-500/35 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-rose-200"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="truncate">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="p-1 rounded-lg text-rose-300 hover:bg-rose-500/20 shrink-0 cursor-pointer"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. SERIES SWITCHER BAR (Single Compact Card) */}
      <section className="rounded-2xl bg-[#161428]/95 border border-purple-500/20 p-3.5 shadow-lg shadow-black/25">
        <div className="flex items-center gap-2">
          <select
            aria-label="Select series"
            data-testid="franchise-series-select"
            value={selectedKey}
            disabled={loading}
            onChange={(e) => handleSelectSeries(e.target.value)}
            className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-[#100E1D] border border-purple-500/25 text-sm font-medium text-white focus:outline-none focus:border-purple-400"
          >
            {loading ? (
              <option value="">Loading series...</option>
            ) : franchises.length === 0 ? (
              <option value="">No series yet — tap + New</option>
            ) : (
              franchises.map((f) => (
                <option key={f.franchise_key} value={f.franchise_key}>
                  {f.display_title} ({f.entry_count})
                </option>
              ))
            )}
          </select>

          <button
            type="button"
            data-testid="franchise-new-series-btn"
            onClick={() => {
              setShowNewSeriesInput((prev) => !prev);
              setErrorMsg(null);
            }}
            className="shrink-0 h-10 px-3.5 rounded-xl bg-purple-600/25 hover:bg-purple-600/40 border border-purple-500/40 text-purple-100 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        {/* Inline Series Creator */}
        {showNewSeriesInput && (
          <form
            onSubmit={handleCreateSeries}
            className="mt-2.5 pt-2.5 border-t border-white/10 space-y-2"
          >
            <div className="flex items-center gap-2">
              <input
                ref={newSeriesInputRef}
                type="text"
                data-testid="franchise-new-series-input"
                value={newSeriesName}
                onChange={(e) => setNewSeriesName(e.target.value)}
                placeholder="Series Name (e.g. Demon Slayer)"
                maxLength={80}
                className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-[#100E1D] border border-purple-500/35 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
              />
              <button
                type="submit"
                disabled={previewSlug.length < 2}
                className="shrink-0 h-10 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-45 text-white text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Open</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewSeriesInput(false);
                  setNewSeriesName('');
                }}
                aria-label="Cancel new series"
                className="shrink-0 w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {previewSlug && (
              <div className="text-[11px] text-slate-400 px-1">
                Key: <span className="font-mono text-purple-300">{previewSlug}</span>
              </div>
            )}
          </form>
        )}
      </section>

      {/* 2. QUICK ADD ANIME CARD (Live Server-Side D1 Search) */}
      <section className="rounded-2xl bg-[#161428]/95 border border-purple-500/20 p-3.5 shadow-lg shadow-black/25">
        <form onSubmit={handleAddEntry} className="space-y-2.5">
          {/* Live D1 Catalog Search */}
          <div className="relative">
            {selectedAnime ? (
              <div
                data-testid="franchise-selected-anime"
                className="flex items-center gap-2.5 p-2 rounded-xl bg-[#100E1D] border border-purple-500/40"
              >
                <div className="w-8 h-11 rounded-md overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center">
                  {selectedAnime.poster ? (
                    <img
                      src={selectedAnime.poster}
                      alt={selectedAnime.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Film className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">
                    {selectedAnime.title}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    {selectedAnime.year && <span className="tabular-nums">{selectedAnime.year}</span>}
                    {selectedAnime.type && <span>{selectedAnime.type}</span>}
                    {isSelectedDuplicate && (
                      <span className="text-amber-300 font-semibold">Already in this series</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAnime(null);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  aria-label="Clear selected anime"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    data-testid="franchise-catalog-search"
                    value={searchQuery}
                    onFocus={() => setSearchOpen(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchOpen(true);
                    }}
                    placeholder="Search any anime in catalog..."
                    className="w-full h-10 pl-9 pr-9 rounded-xl bg-[#100E1D] border border-purple-500/25 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                  />
                  {searchingCatalog ? (
                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                  ) : searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      aria-label="Clear search"
                      className="p-1 text-slate-400 hover:text-white absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>

                {/* Live Search Dropdown Results */}
                {searchOpen && searchQuery.trim().length > 0 && (
                  <div
                    data-testid="franchise-search-results"
                    className="mt-1.5 max-h-56 overflow-y-auto rounded-xl bg-[#0D0B18] border border-purple-500/30 divide-y divide-white/5 shadow-xl"
                  >
                    {searchingCatalog && searchResults.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-slate-400 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                        <span>Searching catalog...</span>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-slate-400">
                        No matching anime found for "{searchQuery.trim()}".
                      </div>
                    ) : (
                      searchResults.map((item) => {
                        const alreadyAdded = existingAnimeIdSet.has(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            disabled={alreadyAdded}
                            onClick={() => {
                              setSelectedAnime(item);
                              setSearchOpen(false);
                              setErrorMsg(null);
                            }}
                            className={`w-full text-left px-2.5 py-2 flex items-center gap-2.5 transition-colors ${
                              alreadyAdded
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-purple-500/15 cursor-pointer'
                            }`}
                          >
                            <div className="w-7 h-10 rounded overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center">
                              {item.poster ? (
                                <img
                                  src={item.poster}
                                  alt={item.title}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Film className="w-3.5 h-3.5 text-slate-500" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-white truncate">
                                {item.title}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                {item.year && <span className="tabular-nums">{item.year}</span>}
                                {item.type && <span>{item.type}</span>}
                              </div>
                            </div>
                            {alreadyAdded && (
                              <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                                Added
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Compact 2-field row: Relation + optional short Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <select
              aria-label="Relation"
              data-testid="franchise-relation-select"
              value={relationLabel}
              onChange={(e) => setRelationLabel(e.target.value)}
              className="h-10 px-3 rounded-xl bg-[#100E1D] border border-purple-500/25 text-sm text-white focus:outline-none focus:border-purple-400"
            >
              {FRANCHISE_BUILDER_RELATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            <input
              type="text"
              aria-label="Optional note"
              data-testid="franchise-note-input"
              value={entryNote}
              onChange={(e) => setEntryNote(e.target.value)}
              placeholder="Note (e.g. Watch after S1)"
              maxLength={140}
              className="h-10 px-3 rounded-xl bg-[#100E1D] border border-purple-500/25 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
            />
          </div>

          {/* Full-width Add button */}
          <button
            type="submit"
            data-testid="franchise-add-submit"
            disabled={adding || !selectedKey || !selectedAnime || isSelectedDuplicate}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-45 disabled:cursor-not-allowed text-white text-sm font-bold inline-flex items-center justify-center gap-2 shadow-md shadow-purple-900/30 transition-all cursor-pointer"
          >
            {adding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Adding...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Add to Watch Order</span>
              </>
            )}
          </button>
        </form>
      </section>

      {/* 3. WATCH ORDER LIST (#1, #2, #3...) */}
      <section className="rounded-2xl bg-[#161428]/95 border border-purple-500/20 p-3.5 shadow-lg shadow-black/25">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0 flex items-center gap-2">
            <h3 className="text-sm font-bold text-white truncate">
              {activeSeriesTitle || 'Watch Order'}
            </h3>
            <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-200 tabular-nums">
              {entries.length}
            </span>
          </div>

          {reordering && (
            <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-cyan-300">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Saving order...</span>
            </span>
          )}
        </div>

        {loading || loadingEntries ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            <span>Loading watch order...</span>
          </div>
        ) : !selectedKey ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Tap <span className="text-purple-300 font-semibold">+ New</span> above to start a watch order.
          </div>
        ) : entries.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No anime in this series yet. Search and add titles above.
          </div>
        ) : (
          <div className="space-y-2" data-testid="franchise-watch-order-list">
            {entries.map((entry, idx) => {
              const rowKey = `${entry.id ?? ''}:${entry.anime_id}`;
              const isDeleting = deletingKey === rowKey;
              const posterUrl = entry.poster || entry.cover_image;
              return (
                <div
                  key={rowKey}
                  data-testid={`franchise-order-row-${idx + 1}`}
                  className="rounded-xl bg-[#100E1D] border border-white/10 p-2.5 flex items-center gap-2.5"
                >
                  {/* Order Badge */}
                  <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/35 text-purple-200 text-xs font-extrabold flex items-center justify-center shrink-0 tabular-nums">
                    #{entry.watch_order || idx + 1}
                  </span>

                  {/* Poster Thumbnail */}
                  <div className="w-9 h-12 rounded-lg overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center">
                    {posterUrl ? (
                      <img
                        src={posterUrl}
                        alt={entry.title || `Anime #${entry.anime_id}`}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Film className="w-4 h-4 text-slate-500" />
                    )}
                  </div>

                  {/* Title, Relation & Optional Note */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate">
                      {entry.title || `Anime #${entry.anime_id}`}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 leading-tight">
                        {entry.relation_label}
                      </span>
                      {entry.note && (
                        <span className="text-[11px] text-slate-400 truncate max-w-full">
                          {entry.note}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 1-tap Reorder & Remove buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label={`Move ${entry.title || entry.anime_id} up`}
                      disabled={idx === 0 || reordering || isDeleting}
                      onClick={() => handleMoveEntry(idx, 'up')}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-purple-500/25 disabled:opacity-30 border border-white/10 text-slate-200 inline-flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${entry.title || entry.anime_id} down`}
                      disabled={idx === entries.length - 1 || reordering || isDeleting}
                      onClick={() => handleMoveEntry(idx, 'down')}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-purple-500/25 disabled:opacity-30 border border-white/10 text-slate-200 inline-flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${entry.title || entry.anime_id}`}
                      disabled={reordering || isDeleting}
                      onClick={() => handleDeleteEntry(entry)}
                      className="w-8 h-8 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 disabled:opacity-40 border border-rose-500/30 text-rose-300 inline-flex items-center justify-center transition-colors cursor-pointer"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
