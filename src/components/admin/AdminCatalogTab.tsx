import React from 'react';
import {
  Database,
  Loader2,
  Upload,
  Download,
  HelpCircle,
  Info,
  Plus,
  Search,
  X,
  Star,
  Edit3,
  Trash2,
} from 'lucide-react';
import type { AdminAnimeRecord } from './types';

export interface AdminCatalogTabProps {
  loading: boolean;
  isImporting: boolean;
  catalogCount: number;
  filteredCatalog: AdminAnimeRecord[];
  searchQuery: string;
  deletingId: number | string | null;
  onSearchChange: (q: string) => void;
  onTriggerFileUpload: () => void;
  onExportCsv: () => void;
  onOpenCsvHelp: () => void;
  onOpenAddModal: () => void;
  onOpenEditModal: (anime: AdminAnimeRecord) => void;
  onDeleteAnime: (e: React.MouseEvent, anime: AdminAnimeRecord) => void;
}

export const AdminCatalogTab: React.FC<AdminCatalogTabProps> = ({
  loading,
  isImporting,
  catalogCount,
  filteredCatalog,
  searchQuery,
  deletingId,
  onSearchChange,
  onTriggerFileUpload,
  onExportCsv,
  onOpenCsvHelp,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteAnime,
}) => {
  return (
    <div className="space-y-6">
      <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Catalog Matrix Control</h2>
              <p className="text-xs text-neutral-400">Direct global data persistence on Cloudflare Worker &amp; D1</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono text-neutral-300">
              <strong className="text-white font-bold">{filteredCatalog.length}</strong> ACTIVE ENTRIES
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onTriggerFileUpload}
              className="h-9 px-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-purple-400/50 text-neutral-200 hover:text-white text-xs font-semibold inline-flex items-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
            >
              {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" /> : <Upload className="w-3.5 h-3.5 text-purple-400" />}
              <span>Import CSV</span>
            </button>

            <button
              onClick={onExportCsv}
              className="h-9 px-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-emerald-400/50 text-neutral-200 hover:text-white text-xs font-semibold inline-flex items-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <div className="relative group inline-flex items-center">
              <button
                onClick={onOpenCsvHelp}
                aria-label="CSV Format & Header Guide"
                className="h-9 px-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-400/60 text-purple-300 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
              >
                <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                <span>CSV Guide</span>
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                <div className="px-3 py-1.5 rounded-lg bg-[#090d18] text-white text-[11px] font-mono border border-purple-500/40 shadow-2xl whitespace-nowrap flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Exact 13 headers &amp; pipe '|' separator rules</span>
                </div>
                <div className="w-2 h-2 bg-[#090d18] border-r border-b border-purple-500/40 rotate-45 -mt-1" />
              </div>
            </div>
          </div>

          <button
            onClick={onOpenAddModal}
            className="h-9 px-5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 bg-[length:200%_200%] animate-gradient text-white text-xs font-black tracking-wider uppercase inline-flex items-center gap-2 shadow-[0_0_25px_rgba(168,85,247,0.4)] ring-1 ring-white/20 hover:scale-[1.02] active:scale-95 transition-all duration-300 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>ADD NEW ANIME</span>
          </button>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="relative">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter catalog by anime title, ID, language, genre, studio..."
              className="w-full bg-[#0a0d16]/90 border border-white/10 focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(6,182,212,0.25)] rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-neutral-500 outline-none transition-all duration-300"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                title="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1 font-mono">
              <span>Filtering catalog for: "{searchQuery}"</span>
              <span className="text-cyan-300 font-bold">{filteredCatalog.length} of {catalogCount} titles</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={`catalog_skeleton_${n}`} className="relative overflow-hidden p-4 sm:p-5 rounded-2xl bg-white/[0.025] backdrop-blur-xl border border-white/10 shadow-lg flex items-center justify-between gap-4">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                <div className="flex items-center gap-4">
                  <div className="w-14 h-20 sm:w-16 sm:h-22 rounded-xl bg-white/10 shrink-0" />
                  <div className="space-y-2">
                    <div className="h-4 w-44 sm:w-64 bg-white/10 rounded" />
                    <div className="h-3 w-32 bg-white/10 rounded" />
                    <div className="flex gap-2">
                      <div className="h-4 w-12 bg-white/10 rounded" />
                      <div className="h-4 w-12 bg-white/10 rounded" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-16 bg-white/10 rounded-xl" />
                  <div className="h-8 w-8 bg-white/10 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCatalog.length === 0 ? (
          <div className="text-center py-16 bg-white/[0.025] backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
            <p className="text-xs text-neutral-400 font-mono">No catalog records match your query.</p>
          </div>
        ) : (
          filteredCatalog.map((anime) => (
            <div
              key={`catalog_entry_${anime.id}_${anime.image || anime.posterUrl || anime.cover_image || ''}`}
              className="group relative p-4 sm:p-5 rounded-2xl bg-white/[0.025] hover:bg-white/[0.06] backdrop-blur-xl border border-white/10 hover:border-purple-500/50 shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 hover:scale-[1.01]"
            >
              <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-purple-500/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              <div className="flex items-center gap-4 min-w-0">
                <div className="relative shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <img
                    src={anime.image || anime.posterUrl || anime.cover_image || anime.poster || '/logo.png'}
                    alt={anime.title}
                    className="w-14 h-20 sm:w-16 sm:h-22 rounded-xl object-cover ring-1 ring-white/15 shadow-md shadow-black/60 group-hover:ring-purple-400/50"
                  />
                  {anime.type && (
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[9px] font-mono text-cyan-300 border border-cyan-500/30">
                      {anime.type}
                    </span>
                  )}
                </div>

                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Live D1</span>
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono">#{anime.id}</span>
                    {anime.rating && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 font-mono font-semibold flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{anime.rating}</span>
                      </span>
                    )}
                    {anime.platform && (
                      <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-mono">
                        {anime.platform}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-purple-200 transition-colors truncate max-w-md">
                    {anime.title}
                  </h4>

                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {anime.hindi && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-semibold shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                        Hindi
                      </span>
                    )}
                    {anime.tamil && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-semibold shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                        Tamil
                      </span>
                    )}
                    {anime.telugu && (
                      <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-semibold shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                        Telugu
                      </span>
                    )}
                    {anime.studio && (
                      <span className="text-[11px] text-neutral-400 ml-1 font-mono">
                        Studio: <span className="text-purple-300 font-sans">{anime.studio}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 shrink-0">
                <button
                  onClick={() => onOpenEditModal(anime)}
                  className="h-9 px-4 rounded-xl bg-white/[0.05] hover:bg-purple-600/20 border border-white/10 hover:border-purple-400/50 text-white hover:text-purple-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(168,85,247,0.25)]"
                >
                  <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  disabled={deletingId === (anime.id || anime._id)}
                  onClick={(e) => onDeleteAnime(e, anime)}
                  className="h-9 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-400/60 text-rose-300 hover:text-rose-100 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(244,63,94,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
                  title={deletingId === (anime.id || anime._id) ? 'Deleting from Cloudflare...' : 'Delete from catalog'}
                >
                  {deletingId === (anime.id || anime._id) ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                      <span className="hidden sm:inline">Purging...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                      <span className="hidden sm:inline">Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
