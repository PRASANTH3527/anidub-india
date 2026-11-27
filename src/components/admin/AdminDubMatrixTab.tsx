import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Globe,
  Search,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plus,
  Edit3,
  ExternalLink,
} from 'lucide-react';
import { cloudflareApi } from '../../services/cloudflareApi';
import {
  DUB_MATRIX_LANGUAGES,
  validateDubMatrixEntry,
  type DubMatrixRowInput,
  type DubAvailabilityStatus,
} from '../../utils/adminOpsPro';

export interface AdminDubMatrixTabProps {
  catalog: any[];
  onEditAnimeInEditor: (anime: any) => void;
  onSuccess?: (message: string) => void;
}

const AVAILABILITY_OPTIONS: Array<{ value: DubAvailabilityStatus; label: string }> = [
  { value: 'complete', label: 'Complete' },
  { value: 'partial', label: 'Partial' },
  { value: 'announced', label: 'Announced' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'unverified', label: 'Unverified' },
];

export const AdminDubMatrixTab: React.FC<AdminDubMatrixTabProps> = ({
  catalog,
  onEditAnimeInEditor,
  onSuccess,
}) => {
  const [selectedLangCode, setSelectedLangCode] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [tableReady, setTableReady] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [matrixRows, setMatrixRows] = useState<DubMatrixRowInput[]>([]);
  const [dirtyMap, setDirtyMap] = useState<Record<string, DubMatrixRowInput>>({});

  // Quick-add row state
  const [quickAnimeId, setQuickAnimeId] = useState<string>('');
  const [quickLangCode, setQuickLangCode] = useState<string>('hi');

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await cloudflareApi.fetchAdminDubMatrix();
      setTableReady(res.tableReady);
      setMatrixRows(res.rows || []);
      setDirtyMap({});
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load Dub Intelligence Matrix.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  const animeById = useMemo(() => {
    const map = new Map<string, any>();
    for (const item of catalog) {
      map.set(String(item.id), item);
    }
    return map;
  }, [catalog]);

  // Merge persisted rows with catalog anime so admins can edit existing matrix rows or initialize new ones
  const combinedRows = useMemo(() => {
    const rowMap = new Map<string, DubMatrixRowInput>();

    for (const r of matrixRows) {
      const key = `${r.anime_id}:${r.season_number || 1}:${r.language_code}`;
      rowMap.set(key, r);
    }

    // Also surface catalog entries that have language tags not yet in anime_dub_matrix
    for (const anime of catalog.slice(0, 80)) {
      const aid = String(anime.id);
      const rawLangs = typeof anime.languages === 'string' ? anime.languages : '';
      const totalEps =
        anime.episodes_count !== undefined && anime.episodes_count !== null
          ? Number(anime.episodes_count)
          : null;
      for (const langMeta of DUB_MATRIX_LANGUAGES.slice(0, 6)) {
        const key = `${aid}:1:${langMeta.code}`;
        if (rowMap.has(key)) continue;
        const hasTag = rawLangs.toLowerCase().includes(langMeta.name.toLowerCase());
        if (hasTag) {
          rowMap.set(key, {
            anime_id: aid,
            season_number: 1,
            language_code: langMeta.code,
            platform_name: anime.platform ? String(anime.platform).split('|')[0].trim() : '',
            region: 'IN',
            dubbed_episodes: null,
            total_episodes: totalEps,
            // Never infer 'complete' solely from an anime-level language tag!
            availability_status: 'unverified',
            source_url: anime.official_source_url || anime.watch_url || '',
            evidence_note: '',
            verified_at: anime.last_verified_at || null,
          });
        }
      }
    }

    // Overlay dirty edits
    for (const [key, dirtyRow] of Object.entries(dirtyMap)) {
      rowMap.set(key, dirtyRow);
    }

    const q = searchQuery.trim().toLowerCase();
    return Array.from(rowMap.values()).filter((row) => {
      if (selectedLangCode !== 'all' && row.language_code !== selectedLangCode) return false;
      if (statusFilter !== 'all' && row.availability_status !== statusFilter) return false;
      if (q) {
        const anime = animeById.get(String(row.anime_id));
        const title = String(anime?.title || `Anime #${row.anime_id}`).toLowerCase();
        const plat = String(row.platform_name || '').toLowerCase();
        if (!title.includes(q) && !plat.includes(q) && !String(row.anime_id).includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [matrixRows, catalog, dirtyMap, selectedLangCode, statusFilter, searchQuery, animeById]);

  const updateRowField = (
    row: DubMatrixRowInput,
    patch: Partial<DubMatrixRowInput>
  ) => {
    const key = `${row.anime_id}:${row.season_number || 1}:${row.language_code}`;
    const updated: DubMatrixRowInput = {
      ...row,
      ...patch,
    };
    setDirtyMap((prev) => ({
      ...prev,
      [key]: updated,
    }));
  };

  const handleAddQuickRow = () => {
    const targetId = quickAnimeId || (catalog[0] ? String(catalog[0].id) : '');
    if (!targetId) return;
    const anime = animeById.get(targetId);
    const key = `${targetId}:1:${quickLangCode}`;
    const newRow: DubMatrixRowInput = {
      anime_id: targetId,
      season_number: 1,
      language_code: quickLangCode,
      platform_name: anime?.platform ? String(anime.platform).split('|')[0].trim() : '',
      region: 'IN',
      dubbed_episodes: null,
      total_episodes:
        anime?.episodes_count !== undefined && anime?.episodes_count !== null
          ? Number(anime.episodes_count)
          : null,
      availability_status: 'unverified',
      source_url: anime?.official_source_url || anime?.watch_url || '',
      evidence_note: '',
      verified_at: new Date().toISOString().slice(0, 10),
    };
    setDirtyMap((prev) => ({ ...prev, [key]: newRow }));
  };

  const dirtyList = useMemo(() => Object.values(dirtyMap), [dirtyMap]);

  const handleSaveBulkChanges = async () => {
    if (dirtyList.length === 0) return;
    setErrorMsg(null);

    // Client-side validation before bulk PUT
    for (const entry of dirtyList) {
      const check = validateDubMatrixEntry(entry);
      if (!check.ok) {
        const anime = animeById.get(String(entry.anime_id));
        setErrorMsg(`${anime?.title || `Anime #${entry.anime_id}`} (${entry.language_code.toUpperCase()}): ${check.error}`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await cloudflareApi.saveAdminDubMatrixBulk(dirtyList);
      await loadMatrix();
      onSuccess?.(
        `Saved ${res.savedCount} dub matrix row(s) and synced public catalog badges.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save bulk dub matrix changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="admin-dub-matrix-tab" className="space-y-5 text-[var(--text-primary)] pb-16">
      {/* Header Card */}
      <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-[var(--text-primary)] flex items-center gap-2">
            <Globe className="w-5 h-5 text-[var(--accent-primary)]" />
            Bulk Dub Intelligence &amp; Episode Matrix Editor
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Season-level regional dub verification across Tamil (`ta`), Hindi (`hi`), Telugu (`te`), Malayalam (`ml`), Kannada (`kn`), and Bengali (`bn`). Distinguishes 0 episodes from unknown (`NULL`) and never infers Complete Dub from an unverified tag.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadMatrix}
            disabled={loading}
            className="min-h-[44px] px-4 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-[var(--accent-primary)] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Matrix</span>
          </button>
        </div>
      </div>

      {!tableReady && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-500 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Additive Migration Notice:</span> `anime_dub_matrix` is not yet migrated in D1 (`migrations/004_admin_ops_pro.sql`). Saving bulk edits will still sync verified languages &amp; platforms backward-compatibly with the main `anime` table.
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-bold text-red-500 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Language Pills & Filters */}
      <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setSelectedLangCode('all')}
            className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap border cursor-pointer ${
              selectedLangCode === 'all'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] border-[var(--accent-primary)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
            }`}
          >
            All Languages
          </button>
          {DUB_MATRIX_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setSelectedLangCode(lang.code)}
              className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap border cursor-pointer ${
                selectedLangCode === lang.code
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
            >
              {lang.name} ({lang.code.toUpperCase()})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter matrix by anime title, ID, or OTT platform..."
              className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)]"
            >
              <option value="all">All Availability Statuses</option>
              {AVAILABILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Status: {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Add Row to Matrix */}
          <div className="md:col-span-4 flex items-center gap-2">
            <select
              value={quickAnimeId}
              onChange={(e) => setQuickAnimeId(e.target.value)}
              className="flex-1 min-h-[44px] px-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] truncate"
            >
              <option value="">Select Anime to Add Row...</option>
              {catalog.slice(0, 100).map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.title} (#{a.id})
                </option>
              ))}
            </select>
            <select
              value={quickLangCode}
              onChange={(e) => setQuickLangCode(e.target.value)}
              className="min-h-[44px] px-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)]"
            >
              {DUB_MATRIX_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.code.toUpperCase()}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddQuickRow}
              className="min-h-[44px] px-3 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/40 text-xs font-bold text-[var(--accent-primary)] inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contained Horizontal Scroll Matrix Table */}
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                <th className="py-3 px-4">Anime &amp; Season</th>
                <th className="py-3 px-3">Language</th>
                <th className="py-3 px-3">Dub Status</th>
                <th className="py-3 px-3">Dubbed / Total Eps</th>
                <th className="py-3 px-3">OTT Platform</th>
                <th className="py-3 px-3">Official Source URL</th>
                <th className="py-3 px-3">Last Verified</th>
                <th className="py-3 px-3 text-right">Editor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--text-secondary)]">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--accent-primary)]" />
                    Loading Regional Dub Matrix...
                  </td>
                </tr>
              ) : combinedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--text-secondary)]">
                    No dub matrix rows match this filter. Use the selector above to add a regional dub row.
                  </td>
                </tr>
              ) : (
                combinedRows.slice(0, 100).map((row) => {
                  const key = `${row.anime_id}:${row.season_number || 1}:${row.language_code}`;
                  const isRowDirty = Boolean(dirtyMap[key]);
                  const anime = animeById.get(String(row.anime_id));
                  const langLabel =
                    DUB_MATRIX_LANGUAGES.find((l) => l.code === row.language_code)?.name ||
                    row.language_code.toUpperCase();

                  return (
                    <tr
                      key={key}
                      className={
                        isRowDirty
                          ? 'bg-[var(--accent-soft)]/40'
                          : 'hover:bg-[var(--bg-elevated)]/50'
                      }
                    >
                      <td className="py-3 px-4 max-w-[220px]">
                        <div className="font-bold text-[var(--text-primary)] truncate">
                          {anime?.title || `Anime #${row.anime_id}`}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1.5 mt-0.5">
                          <span>ID #{row.anime_id}</span>
                          <span>·</span>
                          <span>S{row.season_number || 1}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2.5 py-1 rounded-lg font-extrabold text-[11px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                          {langLabel}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <select
                          value={row.availability_status}
                          onChange={(e) =>
                            updateRowField(row, {
                              availability_status: e.target.value as DubAvailabilityStatus,
                            })
                          }
                          className="min-h-[38px] px-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)]"
                        >
                          {AVAILABILITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            value={
                              row.dubbed_episodes !== null && row.dubbed_episodes !== undefined
                                ? String(row.dubbed_episodes)
                                : ''
                            }
                            onChange={(e) =>
                              updateRowField(row, {
                                dubbed_episodes:
                                  e.target.value.trim() === '' ? null : Number(e.target.value),
                              })
                            }
                            placeholder="NULL"
                            aria-label="Dubbed episodes"
                            className="w-16 min-h-[38px] px-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-mono text-center text-[var(--text-primary)]"
                          />
                          <span className="text-[var(--text-secondary)]">/</span>
                          <input
                            type="number"
                            min={0}
                            value={
                              row.total_episodes !== null && row.total_episodes !== undefined
                                ? String(row.total_episodes)
                                : ''
                            }
                            onChange={(e) =>
                              updateRowField(row, {
                                total_episodes:
                                  e.target.value.trim() === '' ? null : Number(e.target.value),
                              })
                            }
                            placeholder="NULL"
                            aria-label="Total episodes"
                            className="w-16 min-h-[38px] px-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-mono text-center text-[var(--text-primary)]"
                          />
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <input
                          type="text"
                          value={row.platform_name || ''}
                          onChange={(e) =>
                            updateRowField(row, { platform_name: e.target.value })
                          }
                          placeholder="Crunchyroll..."
                          className="w-32 min-h-[38px] px-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                        />
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="url"
                            value={row.source_url || ''}
                            onChange={(e) =>
                              updateRowField(row, { source_url: e.target.value })
                            }
                            placeholder="https://..."
                            className="w-40 min-h-[38px] px-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                          />
                          {row.source_url && (
                            <a
                              href={row.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
                              title="Open source link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <input
                          type="date"
                          value={(row.verified_at || '').slice(0, 10)}
                          onChange={(e) =>
                            updateRowField(row, { verified_at: e.target.value || null })
                          }
                          className="min-h-[38px] px-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                        />
                      </td>

                      <td className="py-3 px-3 text-right">
                        {anime && (
                          <button
                            type="button"
                            onClick={() => onEditAnimeInEditor(anime)}
                            className="min-h-[38px] px-2.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--accent-primary)] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky Save Bulk Changes Bar */}
      {dirtyList.length > 0 && (
        <div
          data-testid="dub-matrix-sticky-save-bar"
          className="fixed bottom-16 lg:bottom-6 left-4 right-4 lg:left-72 lg:right-8 z-30 rounded-2xl bg-[var(--bg-surface)] border-2 border-[var(--accent-primary)] p-4 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[var(--accent-primary)] shrink-0" />
            <div>
              <div className="text-sm font-extrabold text-[var(--text-primary)]">
                {dirtyList.length} Unsaved Dub Matrix Row{dirtyList.length > 1 ? 's' : ''}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                Changes will update `anime_dub_matrix` and sync public catalog language badges.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-center">
            <button
              type="button"
              disabled={saving}
              onClick={() => setDirtyMap({})}
              className="min-h-[44px] px-4 rounded-xl bg-[var(--bg-elevated)] text-xs font-bold text-[var(--text-secondary)] cursor-pointer"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveBulkChanges}
              className="min-h-[44px] px-5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer shadow-md"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Bulk Changes ({dirtyList.length})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
