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
  mode = 'catalog',
}) => {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  // Saved Filter Presets (localStorage)
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

  // Desktop Column Visibility Toggle
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

  // Bulk Action Confirmation Modal
  const [bulkConfirm, setBulkConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // Restore scroll position when returning from Modular Anime Editor
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

  const dubQuickFilters = [
    'All',
    'Unverified',
    'Hindi',
    'Tamil',
    'Telugu',
    'Malayalam',
    'Kannada',
    'Bengali',
  ];

  return (
    <div
      data-testid={mode === 'dubs' ? 'admin-dubs-tab' : 'admin-catalog-tab'}
      className="space-y-4 w-full max-w-full overflow-x-clip text-[var(--text-primary)]"
    >
      {/* 1. HEADER & SERVER-SIDE SEARCH / FILTER BAR */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              {mode === 'dubs' ? (
                <>
                  <Globe className="w-5 h-5 text-[var(--accent-primary)]" />
                  <span>Regional Dub Intelligence &amp; Tag Verification</span>
                </>
              ) : (
                <>
                  <Film className="w-5 h-5 text-[var(--accent-primary)]" />
                  <span>Anime Catalog (Server-Side D1 Pagination)</span>
                </>
              )}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              {totalItems.toLocaleString()} matching D1 records • Page {currentPage} of {totalPages}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Desktop Column Visibility Dropdown */}
            <div ref={columnsMenuRef} className="hidden md:block relative">
              <button
                type="button"
                data-testid="catalog-columns-toggle"
                onClick={() => setIsColumnsMenuOpen((prev) => !prev)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Columns className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Columns</span>
              </button>
              {isColumnsMenuOpen && (
                <div
                  data-testid="catalog-columns-menu"
                  className="absolute right-0 mt-2 w-52 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl p-2 z-30 space-y-1"
                >
                  <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                    Visible Table Columns
                  </div>
                  {(
                    [
                      { key: 'status', label: 'Broadcast Status' },
                      { key: 'dubs', label: 'Verified Dub Languages' },
                      { key: 'visibility', label: 'Visibility Status' },
                      { key: 'rating', label: 'Rating & Metadata' },
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
                        className="w-4 h-4 accent-[var(--accent-primary)]"
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[var(--accent-primary)]' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Anime</span>
            </button>
          </div>
        </div>

        {/* Dub Quick Filter Chips when in Dubs view */}
        {mode === 'dubs' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {dubQuickFilters.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setFilterLanguage(lang)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  filterLanguage === lang
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {lang === 'All' ? 'All Languages' : lang === 'Unverified' ? 'Unverified Dubs' : `${lang} Dub`}
              </button>
            ))}
          </div>
        )}

        {/* Search + Status + Language + Sort Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
          <div className="sm:col-span-2 lg:col-span-5 relative">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              data-testid="admin-catalog-search"
              placeholder="Search title, slug, or ID across D1..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:outline-none focus:border-[var(--accent-primary)] transition-all"
            />
          </div>

          <div className="lg:col-span-2 relative">
            <Filter className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filter by Status"
              className="w-full min-h-[44px] pl-8 pr-6 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
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
              className="w-full min-h-[44px] pl-8 pr-6 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
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
              className="w-full min-h-[44px] pl-8 pr-6 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
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
          className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-2"
        >
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mr-1">
            <Bookmark className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
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
                    className="w-28 px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--accent-primary)] text-xs text-[var(--text-primary)] focus:outline-none"
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
                    className="min-h-[32px] px-1.5 text-xs font-bold text-[var(--text-primary)] hover:text-[var(--accent-primary)] cursor-pointer"
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
                className="min-h-[36px] px-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--accent-primary)] text-xs text-[var(--text-primary)] focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-[36px] px-3 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-bold cursor-pointer"
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
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-dashed border-[var(--border-subtle)] text-xs font-bold text-[var(--accent-primary)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>Save Current Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. STICKY BULK ACTION TOOLBAR */}
      {selectedCatalogIds.length > 0 && (
        <div
          data-testid="catalog-sticky-bulk-bar"
          className="sticky top-[70px] z-20 p-3.5 rounded-2xl bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--accent-primary)]/40 flex flex-wrap items-center justify-between gap-3 shadow-lg"
        >
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-extrabold">
              {selectedCatalogIds.length} Selected
            </span>
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
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold cursor-pointer"
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
                    title: 'Mark Selected Titles Verified',
                    message: `Stamp today's verification date on ${selectedCatalogIds.length} selected anime?`,
                    confirmLabel: 'Mark Verified',
                    onConfirm: () => {
                      setBulkConfirm(null);
                      onBulkMarkVerified();
                    },
                  })
                }
                disabled={isBulkProcessing}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-600 dark:text-teal-400 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Mark Verified</span>
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
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold cursor-pointer"
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
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-600 dark:text-sky-400 text-xs font-bold cursor-pointer"
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
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-xs font-bold cursor-pointer"
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
              <Download className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={onBulkDeleteSelected}
              disabled={isBulkProcessing}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* 3. ERROR OR LOADING STATES */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3">
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
          <Loader2 className="w-7 h-7 text-[var(--accent-primary)] animate-spin mx-auto" />
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
        <>
          {/* 4A. MOBILE COMPACT CARDS (< 768px, 0px horizontal overflow, 44x44px touch targets) */}
          <div className="md:hidden space-y-3">
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

              return (
                <div
                  key={anime.id}
                  data-testid={`mobile-catalog-card-${anime.id}`}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/40'
                      : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => onToggleSelectCatalog(Number(anime.id))}
                      aria-label={`Select ${anime.title}`}
                      className="min-w-[44px] min-h-[44px] -m-1.5 flex items-center justify-center shrink-0"
                    >
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                          isSelected
                            ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)]'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </span>
                    </button>

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
                      className="w-12 h-16 rounded-lg object-cover border border-[var(--border-subtle)] shrink-0"
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-extrabold text-[var(--text-primary)] line-clamp-1">
                          {anime.title}
                        </h4>
                        <span className="text-xs font-mono text-[var(--text-secondary)] shrink-0">
                          #{anime.id}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                            anime.status === 'Airing'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : anime.status === 'Upcoming'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                          }`}
                        >
                          {anime.status || 'Airing'}
                        </span>
                        <span className="text-[var(--text-secondary)]">
                          ★ {anime.rating || '8.5'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {langsList.length > 0 ? (
                          langsList.map((lang: string, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-primary)]"
                            >
                              {lang}
                            </span>
                          ))
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                            Unverified Dubs
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => onToggleVisibility(anime)}
                      className={`min-h-[44px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                        isPublished
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {isPublished ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Published
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" /> Hidden
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditWithScrollSave(anime)}
                        className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCatalogAnime(Number(anime.id), anime.title)}
                        aria-label={`Delete ${anime.title}`}
                        className="min-w-[44px] min-h-[44px] rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 4B. DESKTOP / TABLET STRUCTURED TABLE (>= 768px) */}
          <div className="hidden md:block rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                    <th className="py-3.5 pl-4 pr-2 w-10">
                      <button
                        type="button"
                        onClick={onSelectAllCatalog}
                        aria-label="Select all on current page"
                        className="w-5 h-5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-center"
                      >
                        {selectedCatalogIds.length === items.length && items.length > 0 && (
                          <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        )}
                      </button>
                    </th>
                    <th className="py-3.5 px-3 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                      Anime Title &amp; Metadata
                    </th>
                    {visibleColumns.status && (
                      <th className="py-3.5 px-3 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        Status
                      </th>
                    )}
                    {visibleColumns.dubs && (
                      <th className="py-3.5 px-3 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        Verified Dub Languages
                      </th>
                    )}
                    {visibleColumns.visibility && (
                      <th className="py-3.5 px-3 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        Visibility
                      </th>
                    )}
                    <th className="py-3.5 pl-3 pr-5 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
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

                    return (
                      <tr
                        key={anime.id}
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-[var(--accent-primary)]/10'
                            : 'hover:bg-[var(--bg-elevated)]/60'
                        }`}
                      >
                        <td className="py-3 pl-4 pr-2">
                          <button
                            type="button"
                            onClick={() => onToggleSelectCatalog(Number(anime.id))}
                            aria-label={`Select ${anime.title}`}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                              isSelected
                                ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)]'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </button>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
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
                              className="w-10 h-14 rounded-lg object-cover border border-[var(--border-subtle)] shrink-0"
                            />
                            <div className="min-w-0 max-w-xs xl:max-w-md">
                              <h4 className="font-bold text-[var(--text-primary)] text-sm truncate">
                                {anime.title}
                              </h4>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-secondary)]">
                                <span className="font-mono">#{anime.id}</span>
                                <span>•</span>
                                <span>{anime.type || 'TV Series'}</span>
                                {visibleColumns.rating && (
                                  <>
                                    <span>•</span>
                                    <span className="text-amber-500 font-bold">
                                      ★ {anime.rating || '8.5'}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {visibleColumns.status && (
                          <td className="py-3 px-3">
                            <span
                              className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                                anime.status === 'Airing'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                  : anime.status === 'Upcoming'
                                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                              }`}
                            >
                              {anime.status || 'Airing'}
                            </span>
                          </td>
                        )}

                        {visibleColumns.dubs && (
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {langsList.length > 0 ? (
                                langsList.map((lang: string, i: number) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)]"
                                  >
                                    {lang}
                                  </span>
                                ))
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-xs font-bold text-rose-600 dark:text-rose-400">
                                  Unverified
                                </span>
                              )}
                            </div>
                          </td>
                        )}

                        {visibleColumns.visibility && (
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              onClick={() => onToggleVisibility(anime)}
                              className={`min-h-[36px] px-3 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                isPublished
                                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                              }`}
                            >
                              {isPublished ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Published
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-3.5 h-3.5" /> Hidden
                                </>
                              )}
                            </button>
                          </td>
                        )}

                        <td className="py-3 pl-3 pr-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditWithScrollSave(anime)}
                              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[var(--accent-primary)]" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteCatalogAnime(Number(anime.id), anime.title)}
                              aria-label={`Delete ${anime.title}`}
                              className="min-w-[38px] min-h-[38px] p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 flex items-center justify-center transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
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
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1 disabled:opacity-40 transition-all"
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
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1 disabled:opacity-40 transition-all"
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
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-extrabold cursor-pointer"
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
