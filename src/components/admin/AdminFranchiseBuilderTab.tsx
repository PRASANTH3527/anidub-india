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
  Pencil,
} from 'lucide-react';
import { cloudflareApi } from '../../services/cloudflareApi';
import {
  FRANCHISE_BUILDER_RELATION_OPTIONS,
  deriveFranchiseKeyFromAnime,
  formatFranchiseDisplayTitle,
  inferDefaultFranchiseRelation,
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
  slug?: string;
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
    slug: raw.slug ? String(raw.slug) : undefined,
    poster: raw.poster || raw.cover_image || raw.image || undefined,
    year: Number.isFinite(yearNum) && yearNum > 1900 ? yearNum : null,
    type: raw.type ? String(raw.type) : 'TV Series',
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
  const [addingAnimeId, setAddingAnimeId] = useState<string | null>(null);
  const [reordering, setReordering] = useState<boolean>(false);
  const [savingEntryKey, setSavingEntryKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inline Watch Order Rename state (triggered by edit-pencil next to title)
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [renameDraft, setRenameDraft] = useState<string>('');
  const [renaming, setRenaming] = useState<boolean>(false);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  // Instant Live Catalog Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [serverResults, setServerResults] = useState<CatalogSearchCandidate[]>([]);
  const [searchingCatalog, setSearchingCatalog] = useState<boolean>(false);
  const [hasCompletedSearch, setHasCompletedSearch] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchSeqRef = useRef<number>(0);

  // Inline note drafts & debounce timers per entry
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const noteTimersRef = useRef<Record<string, number>>({});

  // Sync noteDrafts whenever entries load or change
  useEffect(() => {
    setNoteDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const entry of entries) {
        const key = String(entry.id ?? entry.anime_id);
        next[key] = prev[key] !== undefined ? prev[key] : (entry.note ?? '');
      }
      return next;
    });
  }, [entries]);

  // Clear pending note timers on unmount
  useEffect(() => {
    const timers = noteTimersRef.current;
    return () => {
      for (const id of Object.values(timers)) {
        window.clearTimeout(id);
      }
    };
  }, []);

  const savedFranchises = useMemo(
    () => franchises.filter((f) => f.entry_count > 0),
    [franchises]
  );

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

  // Instant local catalog cache for 0ms suggestions while D1 search resolves
  const localCatalogCandidates = useMemo(() => {
    const list: CatalogSearchCandidate[] = [];
    for (const item of catalog) {
      const mapped = mapCatalogCandidate(item);
      if (mapped) list.push(mapped);
    }
    return list;
  }, [catalog]);

  const instantLocalMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const prefix: CatalogSearchCandidate[] = [];
    const contains: CatalogSearchCandidate[] = [];
    for (const item of localCatalogCandidates) {
      const lowerTitle = item.title.toLowerCase();
      const lowerSlug = (item.slug || '').toLowerCase();
      if (lowerTitle.startsWith(q)) {
        prefix.push(item);
      } else if (lowerTitle.includes(q) || lowerSlug.includes(q) || item.id === q) {
        contains.push(item);
      }
    }
    return [...prefix, ...contains].slice(0, 25);
  }, [searchQuery, localCatalogCandidates]);

  // Merge D1 server results (authoritative, entire catalog) with instant local matches
  const mergedSuggestions = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    const byId = new Map<string, CatalogSearchCandidate>();
    for (const item of serverResults) {
      byId.set(item.id, item);
    }
    for (const item of instantLocalMatches) {
      if (!byId.has(item.id)) {
        byId.set(item.id, item);
      }
    }
    return Array.from(byId.values()).slice(0, 25);
  }, [searchQuery, serverResults, instantLocalMatches]);

  // Initial load of saved watch orders
  const loadInitialFranchises = useCallback(async (preferredKey?: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const normalizedPref = preferredKey ? normalizeFranchiseKey(preferredKey) : undefined;
      const res = await cloudflareApi.fetchAdminFranchises(normalizedPref);
      const list: FranchiseSummaryItem[] = (res.franchises || [])
        .map((f) => ({
          franchise_key: f.franchise_key,
          display_title: f.display_title || formatFranchiseDisplayTitle(f.franchise_key),
          entry_count: Number(f.entry_count) || 0,
          updated_at: f.updated_at || '',
        }))
        .filter((f) => f.entry_count > 0);

      const nextKey = normalizedPref || res.selectedFranchiseKey || (list[0]?.franchise_key ?? '');
      setFranchises(list);
      setSelectedKey(nextKey);
      setEntries(Array.isArray(res.entries) ? res.entries : []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load saved watch orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialFranchises(initialFranchiseKey || undefined);
  }, [initialFranchiseKey, loadInitialFranchises]);

  // Switch saved watch order from top dropdown
  const handleSelectSeries = useCallback(async (nextKey: string) => {
    const normalized = normalizeFranchiseKey(nextKey);
    setSelectedKey(normalized);
    setIsRenaming(false);
    setErrorMsg(null);
    setNoteDrafts({});
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
      setErrorMsg(err?.message || 'Failed to load watch order.');
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  // "+ New List": immediately start a fresh watch order (no blocking Series Name form)
  const handleStartNewList = useCallback(() => {
    setSelectedKey('');
    setEntries([]);
    setNoteDrafts({});
    setIsRenaming(false);
    setRenameDraft('');
    setErrorMsg(null);
    setTimeout(() => searchInputRef.current?.focus(), 20);
  }, []);

  // Debounced (~200ms) live D1 catalog search across entire catalog (approved + pending)
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setServerResults([]);
      setSearchingCatalog(false);
      setHasCompletedSearch(false);
      return;
    }

    const seq = ++searchSeqRef.current;
    setSearchingCatalog(true);
    setHasCompletedSearch(false);

    const timer = window.setTimeout(async () => {
      try {
        const res = await cloudflareApi.searchAdminFranchiseCatalog(query, 25);
        if (seq !== searchSeqRef.current) return;
        const mapped = (res.results || [])
          .map(mapCatalogCandidate)
          .filter((item): item is CatalogSearchCandidate => item !== null);
        setServerResults(mapped);
        setHasCompletedSearch(true);
      } catch (err: any) {
        if (seq !== searchSeqRef.current) return;
        setServerResults([]);
        setHasCompletedSearch(true);
        // Only surface search error if local cache also has nothing to show
        if (instantLocalMatches.length === 0) {
          setErrorMsg(err?.message || 'Catalog search failed. Please retry.');
        }
      } finally {
        if (seq === searchSeqRef.current) {
          setSearchingCatalog(false);
        }
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [searchQuery, instantLocalMatches.length]);

  // 1-Tap Instant Add from suggestion dropdown -> persists immediately -> clears input
  const handleInstantAddAnime = useCallback(
    async (anime: CatalogSearchCandidate) => {
      if (addingAnimeId || existingAnimeIdSet.has(anime.id)) return;

      // Auto-generate franchise_key from the 1st anime when starting a brand-new list
      let targetKey = selectedKey;
      if (!targetKey) {
        const baseKey = deriveFranchiseKeyFromAnime(anime);
        const existingKeys = new Set(franchises.map((f) => f.franchise_key));
        targetKey = baseKey;
        let suffix = 2;
        while (existingKeys.has(targetKey)) {
          targetKey = `${baseKey}-${suffix}`;
          suffix += 1;
        }
      }

      const inferredRelation = inferDefaultFranchiseRelation(anime.type, entries.length);

      setAddingAnimeId(anime.id);
      setErrorMsg(null);
      try {
        const res = await cloudflareApi.addAdminFranchiseEntry(targetKey, {
          anime_id: anime.id,
          relation_label: inferredRelation,
          note: null,
        });

        const updatedEntries = Array.isArray(res.entries)
          ? res.entries
          : res.entry
            ? [...entries, res.entry]
            : entries;

        setSelectedKey(targetKey);
        setEntries(updatedEntries);
        setFranchises((prev) => {
          const exists = prev.some((f) => f.franchise_key === targetKey);
          const displayTitle = formatFranchiseDisplayTitle(targetKey);
          if (!exists) {
            return [
              {
                franchise_key: targetKey,
                display_title: displayTitle,
                entry_count: updatedEntries.length,
                updated_at: new Date().toISOString(),
              },
              ...prev,
            ];
          }
          return prev.map((f) =>
            f.franchise_key === targetKey
              ? { ...f, entry_count: updatedEntries.length }
              : f
          );
        });

        // Immediately clear search input & keep focus so user can type the next anime continuously
        setSearchQuery('');
        setServerResults([]);
        setHasCompletedSearch(false);
        setTimeout(() => searchInputRef.current?.focus(), 20);
        onSuccess?.(`Added #${updatedEntries.length} ${anime.title}`);
      } catch (err: any) {
        setErrorMsg(err?.message || `Failed to add "${anime.title}".`);
      } finally {
        setAddingAnimeId(null);
      }
    },
    [addingAnimeId, existingAnimeIdSet, selectedKey, franchises, entries, onSuccess]
  );

  // Rename active Watch Order via edit-pencil icon
  const handleStartRename = useCallback(() => {
    if (!selectedKey) return;
    setRenameDraft(activeSeriesTitle || formatFranchiseDisplayTitle(selectedKey));
    setIsRenaming(true);
    setTimeout(() => renameInputRef.current?.focus(), 20);
  }, [selectedKey, activeSeriesTitle]);

  const handleConfirmRename = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!selectedKey || renaming) return;
      const trimmed = renameDraft.trim();
      const nextSlug = normalizeFranchiseKey(trimmed);
      if (!nextSlug || nextSlug.length < 2) {
        setErrorMsg('Watch order name must be at least 2 characters.');
        return;
      }
      if (nextSlug === selectedKey) {
        setIsRenaming(false);
        return;
      }

      setRenaming(true);
      setErrorMsg(null);
      try {
        const res = await cloudflareApi.renameAdminFranchiseKey(selectedKey, trimmed);
        const finalKey = res.franchiseKey;
        const finalTitle = res.displayTitle || formatFranchiseDisplayTitle(finalKey);

        setSelectedKey(finalKey);
        if (Array.isArray(res.entries)) {
          setEntries(res.entries);
        }
        setFranchises((prev) =>
          prev.map((f) =>
            f.franchise_key === selectedKey
              ? { ...f, franchise_key: finalKey, display_title: finalTitle }
              : f
          )
        );
        setIsRenaming(false);
        onSuccess?.(`Renamed watch order to "${finalTitle}"`);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to rename watch order.');
      } finally {
        setRenaming(false);
      }
    },
    [selectedKey, renaming, renameDraft, onSuccess]
  );

  // Inline auto-save for Relation dropdown
  const handleInlineRelationChange = useCallback(
    async (entry: AdminFranchiseEntry, nextRelation: string) => {
      if (!selectedKey) return;
      const entryId = entry.id ?? entry.anime_id;
      const rowKey = String(entryId);
      const previousEntries = entries;

      setEntries((prev) =>
        prev.map((e) =>
          String(e.id ?? e.anime_id) === rowKey ? { ...e, relation_label: nextRelation } : e
        )
      );
      setSavingEntryKey(rowKey);
      setErrorMsg(null);

      try {
        const res = await cloudflareApi.updateAdminFranchiseEntry(selectedKey, entryId, {
          relation_label: nextRelation,
        });
        if (Array.isArray(res.entries)) {
          setEntries(res.entries);
        }
      } catch (err: any) {
        setEntries(previousEntries);
        setErrorMsg(err?.message || 'Failed to save relation.');
      } finally {
        setSavingEntryKey((cur) => (cur === rowKey ? null : cur));
      }
    },
    [selectedKey, entries]
  );

  // Inline auto-save for Note input (debounced + immediate on blur/Enter)
  const persistInlineNote = useCallback(
    async (entry: AdminFranchiseEntry, nextNoteRaw: string) => {
      if (!selectedKey) return;
      const entryId = entry.id ?? entry.anime_id;
      const rowKey = String(entryId);
      const normalizedNext = nextNoteRaw.trim();
      const normalizedCurrent = (entry.note ?? '').trim();
      if (normalizedNext === normalizedCurrent) return;

      setSavingEntryKey(rowKey);
      setErrorMsg(null);
      try {
        const res = await cloudflareApi.updateAdminFranchiseEntry(selectedKey, entryId, {
          note: normalizedNext || null,
        });
        if (Array.isArray(res.entries)) {
          setEntries(res.entries);
        } else {
          setEntries((prev) =>
            prev.map((e) =>
              String(e.id ?? e.anime_id) === rowKey ? { ...e, note: normalizedNext || null } : e
            )
          );
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to save note.');
      } finally {
        setSavingEntryKey((cur) => (cur === rowKey ? null : cur));
      }
    },
    [selectedKey]
  );

  const handleNoteInputChange = useCallback(
    (entry: AdminFranchiseEntry, val: string) => {
      const rowKey = String(entry.id ?? entry.anime_id);
      setNoteDrafts((prev) => ({ ...prev, [rowKey]: val }));
      if (noteTimersRef.current[rowKey]) {
        window.clearTimeout(noteTimersRef.current[rowKey]);
      }
      noteTimersRef.current[rowKey] = window.setTimeout(() => {
        delete noteTimersRef.current[rowKey];
        persistInlineNote(entry, val);
      }, 550);
    },
    [persistInlineNote]
  );

  const handleNoteInputBlur = useCallback(
    (entry: AdminFranchiseEntry) => {
      const rowKey = String(entry.id ?? entry.anime_id);
      if (noteTimersRef.current[rowKey]) {
        window.clearTimeout(noteTimersRef.current[rowKey]);
        delete noteTimersRef.current[rowKey];
      }
      const val = noteDrafts[rowKey] ?? '';
      persistInlineNote(entry, val);
    },
    [noteDrafts, persistInlineNote]
  );

  // Instant 1-tap up/down reorder (optimistic UI + atomic D1 db.batch())
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

  // 1-tap delete + automatic re-sequence 1..N
  const handleDeleteEntry = useCallback(
    async (entry: AdminFranchiseEntry) => {
      if (!selectedKey) return;
      const targetId = entry.id ?? entry.anime_id;
      const rowKey = String(targetId);
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
          prev
            .map((f) =>
              f.franchise_key === selectedKey
                ? { ...f, entry_count: remaining.length }
                : f
            )
            .filter((f) => f.entry_count > 0)
        );
        if (remaining.length === 0) {
          setSelectedKey('');
        }
        onSuccess?.(`Removed "${entry.title || `#${entry.anime_id}`}"`);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to remove entry.');
      } finally {
        setDeletingKey(null);
      }
    },
    [selectedKey, entries, onSuccess]
  );

  const trimmedQuery = searchQuery.trim();
  const showSuggestionsDropdown = trimmedQuery.length > 0;

  return (
    <div className="space-y-3 pb-24 max-w-full" data-testid="admin-franchise-builder">
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

      {/* 1. COMPACT SAVED WATCH ORDERS BAR */}
      <section className="rounded-2xl bg-[#161428]/95 border border-purple-500/20 p-3 shadow-lg shadow-black/25">
        <div className="flex items-center gap-2">
          <select
            aria-label="Saved watch orders"
            data-testid="franchise-series-select"
            value={selectedKey}
            disabled={loading}
            onChange={(e) => handleSelectSeries(e.target.value)}
            className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-[#100E1D] border border-purple-500/25 text-sm font-medium text-white focus:outline-none focus:border-purple-400"
          >
            {loading ? (
              <option value="">Loading saved lists...</option>
            ) : (
              <>
                {!selectedKey && (
                  <option value="">
                    {savedFranchises.length > 0
                      ? 'New Watch Order (type anime below)...'
                      : 'No saved lists — type anime below...'}
                  </option>
                )}
                {savedFranchises.map((f) => (
                  <option key={f.franchise_key} value={f.franchise_key}>
                    {f.display_title} ({f.entry_count})
                  </option>
                ))}
              </>
            )}
          </select>

          <button
            type="button"
            data-testid="franchise-new-list-btn"
            onClick={handleStartNewList}
            className="shrink-0 h-10 px-3.5 rounded-xl bg-purple-600/25 hover:bg-purple-600/40 border border-purple-500/40 text-purple-100 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New List</span>
          </button>
        </div>
      </section>

      {/* 2. INSTANT LIVE CATALOG SEARCH -> 1-TAP ADD -> AUTO-CLEAR */}
      <section className="rounded-2xl bg-[#161428]/95 border border-purple-500/25 p-3 shadow-lg shadow-black/25">
        <div className="relative">
          <Search className="w-4 h-4 text-purple-300 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            data-testid="franchise-catalog-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type anime name to add (e.g. Naruto, Demon Slayer)..."
            autoComplete="off"
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-[#100E1D] border border-purple-500/35 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/40"
          />
          {searchingCatalog ? (
            <Loader2 className="w-4 h-4 text-purple-400 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
          ) : searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setServerResults([]);
                setHasCompletedSearch(false);
                searchInputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="p-1 text-slate-400 hover:text-white absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {/* Live Suggestion Dropdown */}
        {showSuggestionsDropdown && (
          <div
            data-testid="franchise-search-results"
            className="mt-2 max-h-72 overflow-y-auto rounded-xl bg-[#0D0B18] border border-purple-500/30 divide-y divide-white/5 shadow-xl"
          >
            {mergedSuggestions.length > 0 ? (
              mergedSuggestions.map((item) => {
                const alreadyAdded = existingAnimeIdSet.has(item.id);
                const isAddingThis = addingAnimeId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`franchise-suggestion-${item.id}`}
                    disabled={alreadyAdded || Boolean(addingAnimeId)}
                    onClick={() => handleInstantAddAnime(item)}
                    className={`w-full text-left px-2.5 py-2 flex items-center gap-2.5 transition-colors ${
                      alreadyAdded
                        ? 'opacity-65 cursor-default bg-white/[0.02]'
                        : 'hover:bg-purple-500/15 active:bg-purple-500/25 cursor-pointer'
                    }`}
                  >
                    {/* Poster Thumbnail */}
                    <div className="w-9 h-12 rounded-md overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center">
                      {item.poster ? (
                        <img
                          src={item.poster}
                          alt={item.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Film className="w-4 h-4 text-slate-500" />
                      )}
                    </div>

                    {/* Title + Type + Year */}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate">
                        {item.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                        {item.type && (
                          <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 font-medium leading-none">
                            {item.type}
                          </span>
                        )}
                        {item.year ? <span className="tabular-nums">{item.year}</span> : null}
                      </div>
                    </div>

                    {/* Right Pill: + Add or ✓ Added */}
                    {alreadyAdded ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-bold">
                        <Check className="w-3.5 h-3.5" />
                        <span>Added</span>
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600/30 border border-purple-400/40 text-purple-100 text-xs font-bold">
                        {isAddingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>Add</span>
                      </span>
                    )}
                  </button>
                );
              })
            ) : searchingCatalog && !hasCompletedSearch ? (
              <div className="px-3.5 py-4 text-xs text-slate-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                <span>Searching catalog...</span>
              </div>
            ) : (
              <div
                data-testid="franchise-search-empty"
                className="px-3.5 py-4 text-xs text-slate-400 text-center"
              >
                No anime found in catalog
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. CLEAN #1, #2, #3 WATCH ORDER LIST WITH INLINE CONTROLS */}
      <section className="rounded-2xl bg-[#161428]/95 border border-purple-500/20 p-3.5 shadow-lg shadow-black/25">
        {/* Watch Order Header with Inline Edit-Pencil Rename */}
        <div className="flex items-center justify-between gap-2 mb-3">
          {isRenaming && selectedKey ? (
            <form onSubmit={handleConfirmRename} className="flex items-center gap-1.5 flex-1 min-w-0">
              <input
                ref={renameInputRef}
                type="text"
                data-testid="franchise-rename-input"
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                placeholder="Watch order name..."
                maxLength={80}
                className="flex-1 min-w-0 h-8 px-2.5 rounded-lg bg-[#100E1D] border border-purple-400/50 text-xs font-semibold text-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={renaming}
                aria-label="Save watch order name"
                className="w-8 h-8 rounded-lg bg-purple-600 hover:bg-purple-500 text-white inline-flex items-center justify-center shrink-0 cursor-pointer"
              >
                {renaming ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                aria-label="Cancel rename"
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 inline-flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <div className="min-w-0 flex items-center gap-2">
              <h3 className="text-sm font-bold text-white truncate">
                {activeSeriesTitle || 'New Watch Order'}
              </h3>
              {selectedKey && (
                <button
                  type="button"
                  data-testid="franchise-rename-btn"
                  onClick={handleStartRename}
                  aria-label="Rename watch order"
                  title="Rename watch order"
                  className="p-1 rounded-md text-slate-400 hover:text-purple-200 hover:bg-white/10 shrink-0 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-200 tabular-nums">
                {entries.length}
              </span>
            </div>
          )}

          {(reordering || savingEntryKey) && (
            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-300">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Saving...</span>
            </span>
          )}
        </div>

        {loading || loadingEntries ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            <span>Loading watch order...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Type an anime name above and tap a suggestion to add <span className="text-purple-300 font-semibold">#1</span>.
          </div>
        ) : (
          <div className="space-y-2.5" data-testid="franchise-watch-order-list">
            {entries.map((entry, idx) => {
              const rowKey = String(entry.id ?? entry.anime_id);
              const isDeleting = deletingKey === rowKey;
              const posterUrl = entry.poster || entry.cover_image;
              const relationOptions = FRANCHISE_BUILDER_RELATION_OPTIONS.includes(
                entry.relation_label as any
              )
                ? FRANCHISE_BUILDER_RELATION_OPTIONS
                : [entry.relation_label, ...FRANCHISE_BUILDER_RELATION_OPTIONS];

              return (
                <div
                  key={rowKey}
                  data-testid={`franchise-order-row-${idx + 1}`}
                  className="rounded-xl bg-[#100E1D] border border-white/10 p-2.5"
                >
                  {/* Top Line: Order Pill, Poster, Title, Reorder & Delete */}
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/35 text-purple-200 text-xs font-extrabold flex items-center justify-center shrink-0 tabular-nums">
                      #{entry.watch_order || idx + 1}
                    </span>

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

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate">
                        {entry.title || `Anime #${entry.anime_id}`}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        {entry.type && <span>{entry.type}</span>}
                        {entry.year ? <span className="tabular-nums">{entry.year}</span> : null}
                      </div>
                    </div>

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

                  {/* Bottom Inline Controls: Relation selector + optional Note (auto-save via PATCH) */}
                  <div className="mt-2 pt-2 border-t border-white/5 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
                    <select
                      aria-label={`Relation for ${entry.title || entry.anime_id}`}
                      data-testid={`franchise-row-relation-${idx + 1}`}
                      value={entry.relation_label}
                      onChange={(e) => handleInlineRelationChange(entry, e.target.value)}
                      className="h-8 px-2.5 rounded-lg bg-[#161428] border border-purple-500/25 text-xs font-medium text-cyan-200 focus:outline-none focus:border-purple-400"
                    >
                      {relationOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      aria-label={`Note for ${entry.title || entry.anime_id}`}
                      data-testid={`franchise-row-note-${idx + 1}`}
                      value={noteDrafts[rowKey] ?? ''}
                      onChange={(e) => handleNoteInputChange(entry, e.target.value)}
                      onBlur={() => handleNoteInputBlur(entry)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      placeholder="Note (e.g. Watch after S1)"
                      maxLength={140}
                      className="h-8 px-2.5 rounded-lg bg-[#161428] border border-white/10 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-400"
                    />
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
