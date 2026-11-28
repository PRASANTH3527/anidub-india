import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Filter,
  Globe,
  Film,
  Check,
  CheckCircle2,
  EyeOff,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  ArrowUpDown,
  Loader2,
  AlertCircle,
  Bookmark,
  BookmarkPlus,
  Columns,
  Download,
  ShieldCheck,
  X,
  Pencil,
  Database,
  Upload,
  HelpCircle,
} from 'lucide-react';
import { OFFICIAL_INDIAN_LANGUAGES } from './types';

interface SavedCatalogFilterPreset {
  id: string;
  name: string;
  searchQuery: string;
  filterStatus: string;
  filterLanguage: string;
  sortBy: string;
}

const CATALOG_PRESETS_STORAGE_KEY = 'anidub_admin_catalog_presets_v1';
const CATALOG_COLUMNS_STORAGE_KEY = 'anidub_admin_catalog_columns_v1';
const CATALOG_SCROLL_STORAGE_KEY = 'anidub_admin_catalog_scroll';

interface VisibleCatalogColumns {
  status: boolean;
  dubs: boolean;
  visibility: boolean;
  rating: boolean;
}

export interface AdminCatalogTabProps {
  items: any[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  isLoading: boolean;
  errorMsg?: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterStatus: string;
  setFilterStatus: (s: string) => void;
  filterLanguage: string;
  setFilterLanguage: (l: string) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onOpenAddModal: () => void;
  selectedCatalogIds: number[];
  setSelectedCatalogIds: React.Dispatch<React.SetStateAction<number[]>>;
  bulkLanguage: string;
  setBulkLanguage: (l: string) => void;
  isBulkProcessing: boolean;
  onSelectAllCatalog: () => void;
  onToggleSelectCatalog: (id: number) => void;
  onBulkUpdateStatus: (status: string) => void;
  onBulkAssignLanguage: () => void;
  onBulkToggleVisibility: (publish: boolean) => void;
  onBulkMarkVerified?: () => void;
  onBulkDeleteSelected: () => void;
  onToggleVisibility: (anime: any) => void;
  onEditAnime: (anime: any) => void;
  onDeleteCatalogAnime: (id: number, title: string) => void;
  onTriggerCsvUpload?: () => void;
  onExportCsv?: () => void;
  onOpenCsvHelp?: () => void;
  mode?: 'catalog' | 'dubs';
}

export const AdminCatalogTab: React.FC<AdminCatalogTabProps> = ({
  items,
  totalItems,
  currentPage,
  totalPages,
  pageSize,
  isLoading,
  errorMsg,
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  filterLanguage,
  setFilterLanguage,
  sortBy,
  setSortBy,
  onPageChange,
  onRefresh,
  onOpenAddModal,
  selectedCatalogIds,
  setSelectedCatalogIds,
  bulkLanguage,
  setBulkLanguage,
  isBulkProcessing,
  onSelectAllCatalog,
  onToggleSelectCatalog,
  onBulkUpdateStatus,
  onBulkAssignLanguage,
  onBulkToggleVisibility,
  onBulkMarkVerified,
  onBulkDeleteSelected,
  onToggleVisibility,
  onEditAnime,
  onDeleteCatalogAnime,
  onTriggerCsvUpload,
  onExportCsv,
  onOpenCsvHelp,
  mode = 'catalog',
}) => {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  const [presets, setPresets] = useState<SavedCatalogFilterPreset[]>(() => {
    try {
      const raw = localStorage.getItem(CATALOG_PRESETS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [renamingPresetId, setRenamingPresetId] = useState<string | null>(null);
  const [renamePresetInput, setRenamePresetInput] = useState('');

  const [visibleColumns, setVisibleColumns] = useState<VisibleCatalogColumns>(() => {
    try {
      const raw = localStorage.getItem(CATALOG_COLUMNS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          status: parsed.status !== false,
          dubs: parsed.dubs !== false,
          visibility: parsed.visibility !== false,
          rating: parsed.rating !== false,
        };
      }
    } catch {}
    return { status: true, dubs: true, visibility: true, rating: true };
  });
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  const [bulkConfirm, setBulkConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedScroll = sessionStorage.getItem(CATALOG_SCROLL_STORAGE_KEY);
      if (savedScroll) {
        const y = Number(savedScroll);
        if (Number.isFinite(y) && y > 0) {
          window.requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'auto' }));
        }
        sessionStorage.removeItem(CATALOG_SCROLL_STORAGE_KEY);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target as Node)) {
        setIsColumnsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const persistPresets = (next: SavedCatalogFilterPreset[]) => {
    setPresets(next);
    try {
      localStorage.setItem(CATALOG_PRESETS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const handleSaveNewPreset = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = presetNameInput.trim();
    if (!trimmed) return;
    const entry: SavedCatalogFilterPreset = {
      id: `preset_${Date.now()}`,
      name: trimmed.slice(0, 48),
      searchQuery,
      filterStatus,
      filterLanguage,
      sortBy,
    };
    persistPresets([entry, ...presets].slice(0, 12));
    setPresetNameInput('');
    setIsSavingPreset(false);
  };

  const handleApplyPreset = (preset: SavedCatalogFilterPreset) => {
    setSearchQuery(preset.searchQuery || '');
    setFilterStatus(preset.filterStatus || 'All');
    setFilterLanguage(preset.filterLanguage || 'All');
    setSortBy(preset.sortBy || 'id_desc');
  };

  const handleCommitRenamePreset = (id: string) => {
    const trimmed = renamePresetInput.trim();
    if (!trimmed) {
      setRenamingPresetId(null);
      return;
    }
    persistPresets(presets.map((p) => (p.id === id ? { ...p, name: trimmed.slice(0, 48) } : p)));
    setRenamingPresetId(null);
    setRenamePresetInput('');
  };

  const handleDeletePreset = (id: string) => {
    persistPresets(presets.filter((p) => p.id !== id));
  };

  const handleToggleColumn = (key: keyof VisibleCatalogColumns) => {
    setVisibleColumns((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(CATALOG_COLUMNS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleEditWithScrollSave = (anime: any) => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(CATALOG_SCROLL_STORAGE_KEY, String(window.scrollY || 0));
      }
    } catch {}
    onEditAnime(anime);
  };

  const handleExportSelectedCsv = () => {
    const selectedRows = items.filter((a) => selectedCatalogIds.includes(Number(a.id)));
    if (selectedRows.length === 0) return;
    const headers = ['ID', 'Title', 'Slug', 'Status', 'Type', 'Rating', 'Languages', 'Platform', 'Published'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      headers.join(','),
      ...selectedRows.map((a) =>
        [
          esc(a.id),
          esc(a.title),
          esc(a.slug || ''),
          esc(a.status || ''),
          esc(a.type || ''),
          esc(a.rating || ''),
          esc(Array.isArray(a.languages) ? a.languages.join(' | ') : a.languages || ''),
          esc(a.platform || ''),
          esc(a.is_published !== 0 && a.is_published !== false ? 'Published' : 'Hidden'),
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `anidub_selected_catalog_${selectedRows.length}_rows.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      data-testid={mode === 'dubs' ? 'admin-dubs-tab' : 'admin-catalog-tab'}
      className="space-y-4 w-full max-w-full overflow-x-clip text-[var(--text-primary)]"
    >
      {/* 1. CLASSIC CATALOG MATRIX CONTROL HEADER CARD */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)]">
                  Catalog Matrix Control
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-mono font-extrabold text-[var(--text-secondary)]">
                  {totalItems.toLocaleString()} ACTIVE ENTRIES
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Server-side Cloudflare D1 catalog • Page {currentPage} of {totalPages}
              </p>
            </div>
          </div>

          {/* 3 Compact Inline CSV Buttons + Refresh + Columns */}
          <div className="flex flex-wrap items-center gap-2">
            {onTriggerCsvUpload && (
              <button
                type="button"
                onClick={onTriggerCsvUpload}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import CSV</span>
              </button>
            )}
            {onExportCsv && (
              <button
                type="button"
                onClick={onExportCsv}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-purple-400" />
                <span>Export CSV</span>
              </button>
            )}
            {onOpenCsvHelp && (
              <button
                type="button"
                onClick={onOpenCsvHelp}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-400 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>CSV Guide</span>
              </button>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Full-Width Vibrant Purple + ADD NEW ANIME Button */}
        <button
          type="button"
          onClick={onOpenAddModal}
          className="w-full min-h-[46px] px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>ADD NEW ANIME</span>
        </button>

        {/* Search + Status + Language + Sort Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
          <div className="sm:col-span-2 lg:col-span-5 relative">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              data-testid="admin-catalog-search"
              placeholder="Filter catalog by anime title, ID, language, genre, studio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:outline-none focus:border-purple-500 transition-all"
            />
          </div>

          <div className="lg:col-span-2 relative">
            <Filter className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filter by Status"
              className="w-full min-h-[44px] pl-8 pr-6 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="Airing">Airing</option>
              <option value="Completed">Completed</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Pending">Pending</option>
            </select>
          </div>

          <div className="lg:col-span-3 relative">
            <Globe className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={filterLanguage}
              onChange={(e) => setFilterLanguage(e.target.value)}
              aria-label="Filter by Language"
              className="w-full min-h-[44px] pl-8 pr-6 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="All">All Languages</option>
              <option value="Unverified">Unverified (No Dubs)</option>
              {OFFICIAL_INDIAN_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2 relative">
            <ArrowUpDown className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort Catalog"
              className="w-full min-h-[44px] pl-8 pr-6 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="popularity">Sort: Popularity</option>
              <option value="id_desc">Sort: Newest ID</option>
              <option value="newest">Sort: Release Year</option>
              <option value="rating">Sort: Highest Rated</option>
              <option value="title">Sort: Title (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Saved Filter Presets Row */}
        <div
          data-testid="catalog-saved-presets-bar"
          className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mr-1">
              <Bookmark className="w-3.5 h-3.5 text-purple-400" />
              Presets:
            </span>

            {presets.map((preset) => (
              <div
                key={preset.id}
                className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-1"
              >
                {renamingPresetId === preset.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleCommitRenamePreset(preset.id);
                    }}
                    className="inline-flex items-center gap-1"
                  >
                    <input
                      type="text"
                      value={renamePresetInput}
                      onChange={(e) => setRenamePresetInput(e.target.value)}
                      autoFocus
                      className="w-28 px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-purple-500 text-xs text-[var(--text-primary)] focus:outline-none"
                    />
                    <button
                      type="submit"
                      aria-label="Save preset name"
                      className="p-1 text-emerald-500 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="min-h-[32px] px-1.5 text-xs font-bold text-[var(--text-primary)] hover:text-purple-400 cursor-pointer"
                    >
                      {preset.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingPresetId(preset.id);
                        setRenamePresetInput(preset.name);
                      }}
                      aria-label={`Rename preset ${preset.name}`}
                      className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePreset(preset.id)}
                      aria-label={`Delete preset ${preset.name}`}
                      className="p-1 text-[var(--text-secondary)] hover:text-red-500 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            ))}

            {isSavingPreset ? (
              <form onSubmit={handleSaveNewPreset} className="inline-flex items-center gap-1.5">
                <input
                  type="text"
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                  placeholder="e.g., Unverified Tamil Airing"
                  autoFocus
                  className="min-h-[36px] px-2.5 rounded-lg bg-[var(--bg-elevated)] border border-purple-500 text-xs text-[var(--text-primary)] focus:outline-none"
                />
                <button
                  type="submit"
                  className="min-h-[36px] px-3 rounded-lg bg-purple-600 text-white text-xs font-bold cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSavingPreset(false);
                    setPresetNameInput('');
                  }}
                  className="min-h-[36px] px-2 rounded-lg bg-[var(--bg-elevated)] text-xs text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                data-testid="save-catalog-preset-btn"
                onClick={() => setIsSavingPreset(true)}
                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-dashed border-[var(--border-subtle)] text-xs font-bold text-purple-400 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>Save Current Filter</span>
              </button>
            )}
          </div>

          <div ref={columnsMenuRef} className="hidden md:block relative">
            <button
              type="button"
              data-testid="catalog-columns-toggle"
              onClick={() => setIsColumnsMenuOpen((prev) => !prev)}
              className="min-h-[34px] px-3 py-1 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Columns className="w-3.5 h-3.5 text-purple-400" />
              <span>Columns</span>
            </button>
            {isColumnsMenuOpen && (
              <div
                data-testid="catalog-columns-menu"
                className="absolute right-0 mt-2 w-52 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl p-2 z-30 space-y-1"
              >
                <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                  Visible Fields
                </div>
                {(
                  [
                    { key: 'status', label: 'Broadcast Status' },
                    { key: 'dubs', label: 'Dub Languages' },
                    { key: 'visibility', label: 'Visibility Toggle' },
                    { key: 'rating', label: 'Rating & OTT Pill' },
                  ] as const
                ).map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer text-xs font-semibold text-[var(--text-primary)]"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns[col.key]}
                      onChange={() => handleToggleColumn(col.key)}
                      className="w-4 h-4 accent-purple-600"
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. STICKY BULK ACTION TOOLBAR */}
      {selectedCatalogIds.length > 0 && (
        <div
          data-testid="catalog-sticky-bulk-bar"
          className="sticky top-[70px] z-20 p-3.5 rounded-2xl bg-[var(--bg-surface)]/95 backdrop-blur-md border border-purple-500/40 flex flex-wrap items-center justify-between gap-3 shadow-lg"
        >
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs font-extrabold">
              {selectedCatalogIds.length} Selected
            </span>
            <button
              type="button"
              onClick={onSelectAllCatalog}
              className="min-h-[36px] px-2.5 py-1 text-xs font-bold text-purple-400 hover:underline cursor-pointer"
            >
              {selectedCatalogIds.length === items.length ? 'Unselect Page' : 'Select All Page'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedCatalogIds([])}
              className="min-h-[36px] px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline cursor-pointer"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setBulkConfirm({
                  title: 'Publish Selected Titles',
                  message: `Publish ${selectedCatalogIds.length} selected anime to the public catalog?`,
                  confirmLabel: `Publish ${selectedCatalogIds.length}`,
                  onConfirm: () => {
                    setBulkConfirm(null);
                    onBulkToggleVisibility(true);
                  },
                })
              }
              disabled={isBulkProcessing}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold cursor-pointer"
            >
              Publish
            </button>
            <button
              type="button"
              onClick={() =>
                setBulkConfirm({
                  title: 'Unpublish Selected Titles',
                  message: `Hide ${selectedCatalogIds.length} selected anime from public browsing?`,
                  confirmLabel: `Unpublish ${selectedCatalogIds.length}`,
                  onConfirm: () => {
                    setBulkConfirm(null);
                    onBulkToggleVisibility(false);
                  },
                })
              }
              disabled={isBulkProcessing}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold cursor-pointer"
            >
              Unpublish
            </button>
            {onBulkMarkVerified && (
              <button
                type="button"
                onClick={() =>
                  setBulkConfirm({
                    title: 'Mark Selected Titles',
                    message: `Stamp today's date on ${selectedCatalogIds.length} selected anime?`,
                    confirmLabel: 'Confirm',
                    onConfirm: () => {
                      setBulkConfirm(null);
                      onBulkMarkVerified();
                    },
                  })
                }
                disabled={isBulkProcessing}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-400 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Stamp Date</span>
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                setBulkConfirm({
                  title: 'Set Status to Airing',
                  message: `Update broadcast status to "Airing" for ${selectedCatalogIds.length} selected anime?`,
                  confirmLabel: 'Set Airing',
                  onConfirm: () => {
                    setBulkConfirm(null);
                    onBulkUpdateStatus('Airing');
                  },
                })
              }
              disabled={isBulkProcessing}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-bold cursor-pointer"
            >
              Set Airing
            </button>
            <button
              type="button"
              onClick={() =>
                setBulkConfirm({
                  title: 'Set Status to Completed',
                  message: `Update broadcast status to "Completed" for ${selectedCatalogIds.length} selected anime?`,
                  confirmLabel: 'Set Completed',
                  onConfirm: () => {
                    setBulkConfirm(null);
                    onBulkUpdateStatus('Completed');
                  },
                })
              }
              disabled={isBulkProcessing}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-400 text-xs font-bold cursor-pointer"
            >
              Set Completed
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={bulkLanguage}
                onChange={(e) => setBulkLanguage(e.target.value)}
                disabled={isBulkProcessing}
                className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)]"
              >
                {OFFICIAL_INDIAN_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    + {lang}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setBulkConfirm({
                    title: `Add ${bulkLanguage} Dub Tag`,
                    message: `Append "${bulkLanguage}" dub language tag to ${selectedCatalogIds.length} selected anime?`,
                    confirmLabel: `Add ${bulkLanguage}`,
                    onConfirm: () => {
                      setBulkConfirm(null);
                      onBulkAssignLanguage();
                    },
                  })
                }
                disabled={isBulkProcessing}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-bold cursor-pointer"
              >
                Add Dub Tag
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportSelectedCsv}
              disabled={isBulkProcessing}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={onBulkDeleteSelected}
              disabled={isBulkProcessing}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* 3. ERROR OR LOADING STATES */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-3">
          <Loader2 className="w-7 h-7 text-purple-400 animate-spin mx-auto" />
          <p className="text-sm font-bold text-[var(--text-primary)]">
            Loading D1 Catalog Page {currentPage}...
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-14 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] px-4">
          <Film className="w-10 h-10 text-[var(--text-secondary)] opacity-50 mx-auto mb-3" />
          <p className="text-base font-bold text-[var(--text-primary)]">
            No anime found matching your filter criteria
          </p>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Try clearing your search query or switching language/status filters.
          </p>
        </div>
      ) : (
        /* 4. CLASSIC ANIME CATALOG CARDS (Responsive 1-column on mobile, 2-column grid on desktop) */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {items.map((anime) => {
            const isSelected = selectedCatalogIds.includes(Number(anime.id));
            const isPublished =
              anime.is_published !== 0 &&
              anime.is_published !== false &&
              anime.status !== 'pending';
            const langsList = Array.isArray(anime.languages)
              ? anime.languages.filter(Boolean)
              : typeof anime.languages === 'string' && anime.languages.trim()
                ? anime.languages.split(',').map((s: string) => s.trim()).filter(Boolean)
                : [];
            const platformBadge =
              (typeof anime.platform === 'string' && anime.platform.trim()) ||
              (Array.isArray(anime.streaming_partners) && anime.streaming_partners[0]?.name) ||
              'Crunchyroll';

            return (
              <div
                key={anime.id}
                data-testid={`mobile-catalog-card-${anime.id}`}
                className={`p-4 rounded-2xl border transition-all shadow-sm flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-purple-500/10 border-purple-500/40'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-purple-500/30'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Poster Thumbnail with TV Series / Movie Overlay Pill */}
                  <div className="relative shrink-0">
                    <img
                      src={
                        anime.posterUrl ||
                        anime.image ||
                        anime.cover_image ||
                        anime.poster ||
                        'https://picsum.photos/seed/anime/100/150'
                      }
                      alt={anime.title}
                      loading="lazy"
                      className="w-20 h-28 rounded-xl object-cover border border-[var(--border-subtle)]"
                    />
                    <span className="absolute bottom-1.5 left-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-xs text-[9px] font-extrabold text-white text-center truncate">
                      {anime.type || 'TV Series'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleSelectCatalog(Number(anime.id))}
                      aria-label={`Select ${anime.title}`}
                      className={`absolute -top-1.5 -left-1.5 w-6 h-6 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-black/75 border-white/25 text-transparent hover:border-purple-400'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Right Details */}
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* Top Row Badges: • Live D1, #ID, ★ Rating, OTT Platform */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-extrabold text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Live D1
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-mono font-bold text-[var(--text-secondary)]">
                        #{anime.id}
                      </span>
                      {visibleColumns.rating && (
                        <>
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-extrabold text-amber-400">
                            ★ {anime.rating || '8.5'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-extrabold text-cyan-400 truncate max-w-[140px]">
                            {platformBadge}
                          </span>
                        </>
                      )}
                      {visibleColumns.status && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                            anime.status === 'Airing'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : anime.status === 'Upcoming'
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                          }`}
                        >
                          {anime.status || 'Airing'}
                        </span>
                      )}
                    </div>

                    {/* Title & Studio */}
                    <div>
                      <h4 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)] line-clamp-1">
                        {anime.title}
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                        Studio:{' '}
                        <span className="font-bold text-[var(--text-primary)]">
                          {anime.studio || 'Unknown Studio'}
                        </span>
                      </p>
                    </div>

                    {/* Dub Languages + Action Buttons Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {visibleColumns.dubs ? (
                        <div className="flex flex-wrap gap-1 min-w-0">
                          {langsList.length > 0 ? (
                            langsList.slice(0, 4).map((lang: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-primary)]"
                              >
                                {lang}
                              </span>
                            ))
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-[10px] font-bold text-rose-400">
                              Unverified Dubs
                            </span>
                          )}
                        </div>
                      ) : (
                        <div />
                      )}

                      <div className="flex items-center gap-2 shrink-0 ml-auto">
                        {visibleColumns.visibility && (
                          <button
                            type="button"
                            onClick={() => onToggleVisibility(anime)}
                            title={isPublished ? 'Published (click to hide)' : 'Hidden (click to publish)'}
                            className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                              isPublished
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                            }`}
                          >
                            {isPublished ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEditWithScrollSave(anime)}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-extrabold text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCatalogAnime(Number(anime.id), anime.title)}
                          aria-label={`Delete ${anime.title}`}
                          className="min-w-[38px] min-h-[38px] rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. SERVER-SIDE PAGINATION FOOTER */}
      <div
        data-testid="admin-catalog-pagination"
        className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3"
      >
        <div className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium">
          Showing <strong className="text-[var(--text-primary)]">{startItem}</strong>–
          <strong className="text-[var(--text-primary)]">{endItem}</strong> of{' '}
          <strong className="text-[var(--text-primary)]">{totalItems.toLocaleString()}</strong> anime
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => onPageChange(currentPage - 1)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1 disabled:opacity-40 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>

          <span className="px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-extrabold text-[var(--text-primary)]">
            Page {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => onPageChange(currentPage + 1)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1 disabled:opacity-40 transition-all cursor-pointer"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bulk Action Confirmation Dialog */}
      {bulkConfirm && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 shadow-2xl space-y-4 text-[var(--text-primary)]">
            <h3 className="text-base font-extrabold text-[var(--text-primary)]">
              {bulkConfirm.title}
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              {bulkConfirm.message}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setBulkConfirm(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={bulkConfirm.onConfirm}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-extrabold cursor-pointer"
              >
                {bulkConfirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
