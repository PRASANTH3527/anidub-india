import React from 'react';
import { Command, X, CornerDownLeft, ChevronRight } from 'lucide-react';
import type { AdminAnimeRecord, AdminTabId, CommandPaletteResults } from './types';
import { formatLanguageText } from './types';

export interface AdminCommandPaletteProps {
  isOpen: boolean;
  query: string;
  results: CommandPaletteResults;
  onQueryChange: (q: string) => void;
  onClose: () => void;
  onSelectTab: (tab: AdminTabId) => void;
  onSelectAnime: (anime: AdminAnimeRecord) => void;
}

export const AdminCommandPalette: React.FC<AdminCommandPaletteProps> = ({
  isOpen,
  query,
  results,
  onQueryChange,
  onClose,
  onSelectTab,
  onSelectAnime,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center pt-16 sm:pt-24 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl p-[1px] bg-gradient-to-r from-purple-500 via-cyan-400 to-indigo-500 animate-gradient shadow-[0_0_60px_rgba(168,85,247,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#090d18] rounded-2xl overflow-hidden flex flex-col max-h-[80vh]">
          <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-[#0c1222]">
            <Command className="w-5 h-5 text-purple-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Type a command, jump to tab, or search anime title..."
              className="w-full bg-transparent text-sm text-white placeholder-neutral-400 outline-none"
            />
            {query && (
              <button
                onClick={() => onQueryChange('')}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono text-neutral-400 border border-white/15 shrink-0">
              ESC
            </kbd>
          </div>

          <div className="overflow-y-auto p-3 space-y-4 max-h-[55vh]">
            {results.actions.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
                  Quick Operations
                </div>
                {results.actions.map((act) => {
                  const Icon = act.icon;
                  return (
                    <button
                      key={act.id}
                      onClick={act.action}
                      className="w-full p-2.5 rounded-xl hover:bg-white/[0.06] flex items-center justify-between text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white group-hover:text-purple-200 transition-colors">
                            {act.title}
                          </div>
                          <div className="text-[10px] text-neutral-400">{act.desc}</div>
                        </div>
                      </div>
                      <CornerDownLeft className="w-3.5 h-3.5 text-neutral-500 group-hover:text-cyan-400 transition-colors" />
                    </button>
                  );
                })}
              </div>
            )}

            {results.nav.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
                  Navigation &amp; Tabs
                </div>
                {results.nav.map((navItem) => {
                  const Icon = navItem.icon;
                  return (
                    <button
                      key={navItem.id}
                      onClick={() => {
                        onSelectTab(navItem.tab);
                        onClose();
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-white/[0.06] flex items-center justify-between text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white group-hover:text-cyan-200 transition-colors">
                            {navItem.title}
                          </div>
                          <div className="text-[10px] text-neutral-400">{navItem.desc}</div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-cyan-400 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>
            )}

            {results.animes.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
                  Catalog Anime Matches (Click to Edit)
                </div>
                {results.animes.map((anime) => {
                  const langsText = formatLanguageText(anime.languages);
                  return (
                    <button
                      key={`cmd-anime-${anime.id}`}
                      onClick={() => {
                        onSelectAnime(anime);
                        onClose();
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-white/[0.06] flex items-center justify-between text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={anime.image || anime.posterUrl || anime.cover_image || anime.poster || '/logo.png'}
                          alt={anime.title}
                          className="w-8 h-11 rounded-md object-cover ring-1 ring-white/10 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                            {anime.title}
                          </div>
                          <div className="text-[10px] text-neutral-400 font-mono flex items-center gap-2">
                            <span>#{anime.id}</span>
                            {langsText && <span>{langsText}</span>}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[10px] font-mono font-bold">
                        EDIT
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-2.5 bg-[#070a13] border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-400 px-4">
            <div className="flex items-center gap-3">
              <span>↑↓ Navigate</span>
              <span>↵ Execute</span>
            </div>
            <span>Cloudflare D1 Quick Terminal</span>
          </div>
        </div>
      </div>
    </div>
  );
};
