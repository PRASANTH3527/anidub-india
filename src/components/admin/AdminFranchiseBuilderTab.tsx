import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layers,
  Plus,
  Search,
  ArrowUp,
  ArrowDown,
  Trash2,
  Save,
  Eye,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Film,
  Edit3,
} from 'lucide-react';
import { cloudflareApi } from '../../services/cloudflareApi';
import {
  FRANCHISE_RELATION_LABELS,
  normalizeFranchiseKey,
  reorderFranchiseEntries,
  validateFranchiseEntryInput,
  type AdminFranchiseEntry,
} from '../../utils/adminPhase3Intelligence';

export interface AdminFranchiseBuilderTabProps {
  catalog: any[];
  initialFranchiseKey?: string | null;
  onEditAnimeInEditor?: (anime: any) => void;
  onSuccess?: (msg: string) => void;
}

export const AdminFranchiseBuilderTab: React.FC<AdminFranchiseBuilderTabProps> = ({
  catalog = [],
  initialFranchiseKey = null,
  onEditAnimeInEditor,
  onSuccess,
}) => {
  const [franchises, setFranchises] = useState<
    Array<{ franchise_key: string; entry_count: number; updated_at: string }>
  >([]);
  const [selectedKey, setSelectedKey] = useState<string>(
    initialFranchiseKey ? normalizeFranchiseKey(initialFranchiseKey) : ''
  );
  const [newKeyInput, setNewKeyInput] = useState<string>('');
  const [entries, setEntries] = useState<AdminFranchiseEntry[]>([]);
  const [tableReady, setTableReady] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [isDirtyOrder, setIsDirtyOrder] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add Entry Form State
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [selectedAnimeId, setSelectedAnimeId] = useState<string>('');
  const [relationLabel, setRelationLabel] = useState<string>('Original Series');
  const [entryNote, setEntryNote] = useState<string>('');

  const animeById = useMemo(() => {
    const map = new Map<string, any>();
    for (const a of catalog) {
      if (a && a.id !== undefined) {
        map.set(String(a.id), a);
      }
    }
    return map;
  }, [catalog]);

  const loadFranchiseWorkspace = useCallback(
    async (targetKey?: string) => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await cloudflareApi.fetchAdminFranchises(targetKey);
        setTableReady(res.tableReady);
        setFranchises(res.franchises || []);
        const resolvedKey =
          targetKey ||
          res.selectedFranchiseKey ||
          (res.franchises && res.franchises.length > 0 ? res.franchises[0].franchise_key : '');
        if (resolvedKey) {
          setSelectedKey(resolvedKey);
        }
        setEntries(res.entries || []);
        setIsDirtyOrder(false);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to load Franchise Watch-Order workspace.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadFranchiseWorkspace(
      initialFranchiseKey ? normalizeFranchiseKey(initialFranchiseKey) : undefined
    );
  }, [initialFranchiseKey, loadFranchiseWorkspace]);

  const handleCreateOrSelectFranchise = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = normalizeFranchiseKey(newKeyInput);
    if (!cleanKey || cleanKey.length < 2) {
      setErrorMsg('Enter a valid franchise_key (e.g., "naruto", "demon-slayer", "jujutsu-kaisen").');
      return;
    }
    setSelectedKey(cleanKey);
    setNewKeyInput('');
    const exists = franchises.some((f) => f.franchise_key === cleanKey);
    if (exists) {
      void loadFranchiseWorkspace(cleanKey);
    } else {
      setEntries([]);
      setIsDirtyOrder(false);
      setErrorMsg(null);
    }
  };

  const filteredCatalogCandidates = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    const existingIds = new Set(entries.map((e) => String(e.anime_id)));
    return catalog
      .filter((a) => {
        if (!a || a.id === undefined) return false;
        if (!q) return true;
        const title = String(a.title || '').toLowerCase();
        const slug = String(a.slug || '').toLowerCase();
        return title.includes(q) || slug.includes(q) || String(a.id) === q;
      })
      .slice(0, 30)
      .map((a) => ({
        ...a,
        alreadyInFranchise: existingIds.has(String(a.id)),
      }));
  }, [catalog, catalogSearch, entries]);

  const handleAddEntryToTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const activeKey = normalizeFranchiseKey(selectedKey || newKeyInput);
    if (!activeKey) {
      setErrorMsg('Create or select a franchise_key first (e.g., "demon-slayer").');
      return;
    }

    const validation = validateFranchiseEntryInput(
      {
        franchise_key: activeKey,
        anime_id: selectedAnimeId,
        relation_label: relationLabel,
        watch_order: entries.length + 1,
        note: entryNote,
      },
      entries,
      false
    );

    if (!validation.ok) {
      setErrorMsg(validation.error);
      return;
    }

    setSaving(true);
    try {
      await cloudflareApi.saveAdminFranchiseEntry(activeKey, {
        anime_id: validation.data.anime_id,
        relation_label: validation.data.relation_label,
        watch_order: validation.data.watch_order,
        note: validation.data.note,
      });
      setSelectedAnimeId('');
      setEntryNote('');
      await loadFranchiseWorkspace(activeKey);
      onSuccess?.(`Added entry to "${activeKey}" watch order!`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to add entry to franchise.');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveEntry = (index: number, direction: 'up' | 'down') => {
    setEntries((prev) => reorderFranchiseEntries(prev, index, direction));
    setIsDirtyOrder(true);
  };

  const handleUpdateInlineEntry = (
    index: number,
    patch: Partial<Pick<AdminFranchiseEntry, 'relation_label' | 'note'>>
  ) => {
    setEntries((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
    setIsDirtyOrder(true);
  };

  const handleSaveWatchOrder = async () => {
    if (!selectedKey) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await cloudflareApi.saveAdminFranchiseOrder(
        selectedKey,
        entries.map((e, idx) => ({
          anime_id: e.anime_id,
          relation_label: e.relation_label,
          watch_order: idx + 1,
          note: e.note,
        }))
      );
      setIsDirtyOrder(false);
      await loadFranchiseWorkspace(selectedKey);
      onSuccess?.(`Saved Smart Watch Order for "${selectedKey}"!`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save franchise watch order.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (animeId: string) => {
    if (!selectedKey) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await cloudflareApi.deleteAdminFranchiseEntry(selectedKey, animeId);
      await loadFranchiseWorkspace(selectedKey);
      onSuccess?.(`Removed anime #${animeId} from franchise "${selectedKey}".`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete franchise link.');
    } finally {
      setSaving(false);
    }
  };

  // Enrich entries with local catalog details if needed
  const enrichedEntries = useMemo(() => {
    return entries.map((entry, idx) => {
      const cat = animeById.get(String(entry.anime_id));
      const rawLangs =
        entry.languages && entry.languages.length > 0
          ? entry.languages
          : Array.isArray(cat?.languages)
            ? cat.languages
            : typeof cat?.languages === 'string' && cat.languages.trim()
              ? cat.languages.split(',').map((s: string) => s.trim()).filter(Boolean)
              : [];
      return {
        ...entry,
        watch_order: idx + 1,
        title: entry.title || cat?.title || `Anime #${entry.anime_id}`,
        cover_image:
          entry.cover_image || cat?.cover_image || cat?.posterUrl || cat?.image || '/logo.png',
        year: entry.year || cat?.year || cat?.releaseYear || null,
        episodes_count:
          entry.episodes_count || cat?.episodes_count || cat?.episodes || null,
        languages: rawLangs,
      };
    });
  }, [entries, animeById]);

  return (
    <div
      data-testid="admin-franchise-builder-tab"
      className="space-y-6 text-[var(--text-primary)] pb-12"
    >
      {/* Top Header */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-[var(--accent-primary)]" />
            <span>Anime Universe &amp; Smart Watch Order Builder</span>
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Curate verified franchise timelines (`anime_franchise_links`) with touch-friendly Move Up / Move Down ordering and live Anime Details 2.0 timeline preview.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadFranchiseWorkspace(selectedKey || undefined)}
            disabled={loading}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-[var(--accent-primary)] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {isDirtyOrder && (
            <button
              type="button"
              data-testid="save-franchise-order-btn"
              onClick={handleSaveWatchOrder}
              disabled={saving}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Watch Order</span>
            </button>
          )}
        </div>
      </div>

      {!tableReady && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-500 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Additive Migration Notice:</span> `anime_franchise_links` will automatically initialize on your first save or when `migrations/003_anime_details_v2.sql` is applied.
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-bold text-red-500 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Franchise Key Selector & Creator Bar */}
      <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-5">
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
              Select Existing Franchise Key ({franchises.length})
            </label>
            <select
              value={selectedKey}
              onChange={(e) => {
                const nextKey = e.target.value;
                setSelectedKey(nextKey);
                if (nextKey) {
                  void loadFranchiseWorkspace(nextKey);
                } else {
                  setEntries([]);
                }
              }}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm font-bold text-[var(--text-primary)]"
            >
              <option value="">
                {franchises.length === 0 ? 'No franchises created yet...' : 'Choose a franchise_key...'}
              </option>
              {franchises.map((f) => (
                <option key={f.franchise_key} value={f.franchise_key}>
                  {f.franchise_key} ({f.entry_count} {f.entry_count === 1 ? 'entry' : 'entries'})
                </option>
              ))}
            </select>
          </div>

          <form
            onSubmit={handleCreateOrSelectFranchise}
            className="lg:col-span-7 flex flex-col sm:flex-row gap-2.5"
          >
            <div className="flex-1">
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                Or Create / Jump to Franchise Key
              </label>
              <input
                type="text"
                value={newKeyInput}
                onChange={(e) => setNewKeyInput(e.target.value)}
                placeholder="e.g., naruto, demon-slayer, attack-on-titan"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm font-mono text-[var(--text-primary)]"
              />
            </div>
            <button
              type="submit"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)]/15 hover:bg-[var(--accent-primary)]/25 border border-[var(--accent-primary)]/30 text-xs font-extrabold text-[var(--accent-primary)] sm:self-end cursor-pointer"
            >
              Open Franchise Key
            </button>
          </form>
        </div>

        {/* Quick Franchise Pills */}
        {franchises.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {franchises.map((f) => (
              <button
                key={f.franchise_key}
                type="button"
                onClick={() => {
                  setSelectedKey(f.franchise_key);
                  void loadFranchiseWorkspace(f.franchise_key);
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  selectedKey === f.franchise_key
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span className="font-mono">{f.franchise_key}</span>
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-black/15 text-[10px]">
                  {f.entry_count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main 2-Column Workspace: Watch Order Editor (Left 7 cols) + Live Anime Details 2.0 Preview (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: Add Entry + Reorderable Watch Order List */}
        <div className="lg:col-span-7 space-y-5">
          {/* Add Anime Entry to Franchise Card */}
          <form
            onSubmit={handleAddEntryToTimeline}
            className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                  Add Catalog Anime to{' '}
                  <span className="font-mono text-[var(--accent-primary)]">
                    {selectedKey || '(Select Franchise Key)'}
                  </span>
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Duplicate `(franchise_key, anime_id)` entries are automatically blocked.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-secondary)]">
                Next Order: #{entries.length + 1}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                  1. Search &amp; Select Catalog Anime
                </label>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Filter catalog by anime title, slug, or ID..."
                      className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)]"
                    />
                  </div>
                  <select
                    value={selectedAnimeId}
                    onChange={(e) => setSelectedAnimeId(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)]"
                  >
                    <option value="">
                      Select anime from catalog ({filteredCatalogCandidates.length} shown)...
                    </option>
                    {filteredCatalogCandidates.map((a) => (
                      <option
                        key={a.id}
                        value={String(a.id)}
                        disabled={a.alreadyInFranchise}
                      >
                        #{a.id} — {a.title} ({a.year || a.releaseYear || 'N/A'})
                        {a.alreadyInFranchise ? ' [Already in Franchise]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                  2. Relation Label
                </label>
                <select
                  value={relationLabel}
                  onChange={(e) => setRelationLabel(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm font-bold text-[var(--text-primary)]"
                >
                  {FRANCHISE_RELATION_LABELS.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                  3. Optional Watch-Order Note
                </label>
                <input
                  type="text"
                  value={entryNote}
                  onChange={(e) => setEntryNote(e.target.value)}
                  placeholder="e.g., Watch after Season 1 Episode 24"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving || !selectedKey || !selectedAnimeId}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>Add to Watch Order</span>
              </button>
            </div>
          </form>

          {/* Reorderable Watch Order Sequence List */}
          <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                  Smart Watch Order Sequence ({enrichedEntries.length})
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Use Move Up / Move Down buttons to reorder `watch_order` integers cleanly on mobile and desktop.
                </p>
              </div>

              {isDirtyOrder && (
                <button
                  type="button"
                  onClick={handleSaveWatchOrder}
                  disabled={saving}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Commit Reorder</span>
                </button>
              )}
            </div>

            {enrichedEntries.length === 0 ? (
              <div className="p-8 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-center space-y-2">
                <Film className="w-8 h-8 text-[var(--text-secondary)] mx-auto opacity-60" />
                <div className="text-sm font-bold text-[var(--text-primary)]">
                  No Watch-Order Entries Yet
                </div>
                <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                  {selectedKey
                    ? `Add catalog anime entries above to build the verified watch order for "${selectedKey}".`
                    : 'Select or create a franchise_key above to start building an Anime Universe watch order.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {enrichedEntries.map((item, idx) => (
                  <div
                    key={`${item.franchise_key}-${item.anime_id}`}
                    data-testid={`franchise-entry-row-${item.anime_id}`}
                    className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] font-black text-xs flex items-center justify-center shrink-0">
                        #{item.watch_order}
                      </div>
                      <img
                        src={item.cover_image || '/logo.png'}
                        alt={item.title}
                        className="w-11 h-16 rounded-lg object-cover shrink-0 border border-[var(--border-subtle)]"
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold text-[var(--text-primary)] truncate">
                            {item.title}
                          </span>
                          <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                            ID #{item.anime_id}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <select
                            value={item.relation_label}
                            onChange={(e) =>
                              handleUpdateInlineEntry(idx, { relation_label: e.target.value })
                            }
                            aria-label="Relation Label"
                            className="min-h-[38px] px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)]"
                          >
                            {FRANCHISE_RELATION_LABELS.map((rel) => (
                              <option key={rel} value={rel}>
                                {rel}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={item.note || ''}
                            onChange={(e) =>
                              handleUpdateInlineEntry(idx, { note: e.target.value || null })
                            }
                            placeholder="Optional watch note..."
                            className="min-h-[38px] px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Touch-Friendly 44x44px Reorder & Action Controls */}
                    <div className="flex items-center justify-end gap-1.5 shrink-0">
                      <button
                        type="button"
                        data-testid={`franchise-move-up-${idx}`}
                        disabled={idx === 0 || saving}
                        onClick={() => handleMoveEntry(idx, 'up')}
                        aria-label={`Move ${item.title} up`}
                        title="Move Up"
                        className="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center disabled:opacity-35 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        data-testid={`franchise-move-down-${idx}`}
                        disabled={idx === enrichedEntries.length - 1 || saving}
                        onClick={() => handleMoveEntry(idx, 'down')}
                        aria-label={`Move ${item.title} down`}
                        title="Move Down"
                        className="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center disabled:opacity-35 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      {onEditAnimeInEditor && animeById.get(String(item.anime_id)) && (
                        <button
                          type="button"
                          onClick={() =>
                            onEditAnimeInEditor(animeById.get(String(item.anime_id)))
                          }
                          title="Open in Modular Anime Editor"
                          className="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--accent-primary)] flex items-center justify-center cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleDeleteEntry(String(item.anime_id))}
                        aria-label={`Remove ${item.title} from franchise`}
                        title="Remove from Franchise"
                        className="min-w-[44px] min-h-[44px] rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Columns: Live Preview of Anime Details 2.0 Timeline */}
        <div className="lg:col-span-5">
          <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4 sticky top-20">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[var(--accent-primary)]" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                  Anime Details 2.0 Timeline Preview
                </h3>
              </div>
              {selectedKey && (
                <span className="px-2 py-0.5 rounded-md bg-[var(--accent-soft)] text-[var(--accent-primary)] text-[10px] font-mono font-bold">
                  {selectedKey}
                </span>
              )}
            </div>

            {enrichedEntries.length === 0 ? (
              <div className="p-6 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-center text-xs text-[var(--text-secondary)]">
                When a franchise has 0 verified entries, Anime Details 2.0 cleanly hides the Anime Universe section instead of showing empty placeholder cards.
              </div>
            ) : (
              <div className="relative pl-4 border-l-2 border-[var(--accent-primary)]/40 space-y-3">
                {enrichedEntries.map((entry) => (
                  <div
                    key={`preview-${entry.anime_id}`}
                    className="relative p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center gap-3"
                  >
                    <span className="absolute -left-[23px] w-3 h-3 rounded-full bg-[var(--accent-primary)] ring-4 ring-[var(--bg-surface)]" />
                    <img
                      src={entry.cover_image || '/logo.png'}
                      alt={entry.title}
                      className="w-10 h-14 rounded-lg object-cover shrink-0 border border-[var(--border-subtle)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)]">
                          #{entry.watch_order}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                          {entry.relation_label}
                        </span>
                        {entry.year && (
                          <span className="text-[10px] text-[var(--text-secondary)] font-semibold">
                            • {entry.year}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-extrabold text-[var(--text-primary)] truncate mt-1">
                        {entry.title}
                      </div>
                      {entry.note && (
                        <div className="text-[11px] text-[var(--text-secondary)] italic truncate mt-0.5">
                          “{entry.note}”
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {entry.languages && entry.languages.length > 0 ? (
                          entry.languages.slice(0, 4).map((lang: string) => (
                            <span
                              key={lang}
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-500"
                            >
                              {lang}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-[var(--text-secondary)]">
                            Dub Unverified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
