import React from 'react';
import {
  FileSpreadsheet,
  X,
  Sparkles,
  Terminal,
  Check,
  Copy,
  Database,
  FileCode,
  Download,
} from 'lucide-react';

export interface AdminCsvHelpModalProps {
  isOpen: boolean;
  hasCopiedHeaders: boolean;
  hasCopiedSnippet: boolean;
  onClose: () => void;
  onCopyHeaders: () => void;
  onCopySnippet: () => void;
  onDownloadTemplate: () => void;
}

export const AdminCsvHelpModal: React.FC<AdminCsvHelpModalProps> = ({
  isOpen,
  hasCopiedHeaders,
  hasCopiedSnippet,
  onClose,
  onCopyHeaders,
  onCopySnippet,
  onDownloadTemplate,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] rounded-2xl p-[1px] bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 animate-gradient shadow-[0_0_60px_rgba(168,85,247,0.35)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#090d18] rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#0c1222] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                <FileSpreadsheet className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight">CSV Import Specification Guide</h3>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-[10px] font-mono text-purple-300 font-semibold">
                    Strict 13-Column Format
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 font-semibold">
                    Pipe Delimiter (|)
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Strict column mapping rules, pipe-separated arrays, and multi-season syntax for 100% error-free catalog ingestion.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
            <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-start gap-3 shadow-inner">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-purple-300" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Zero Column-Shifting Architecture</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/30 text-purple-200">Critical Rule</span>
                </h4>
                <p className="text-neutral-300 leading-relaxed text-xs">
                  We use the pipe symbol <code className="px-1.5 py-0.5 rounded bg-purple-900/60 font-mono text-purple-300 font-bold border border-purple-500/40">|</code> to separate values in array fields (<strong className="text-white">Languages</strong>, <strong className="text-white">Genres</strong>, and <strong className="text-white">Seasons</strong>). This completely prevents common CSV column-shifting bugs where standard commas inside cells accidentally push data into subsequent columns!
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-300 font-semibold flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Exact Required Header Row (13 Columns in Order)</span>
                </span>
                <button
                  onClick={onCopyHeaders}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 hover:text-cyan-200 text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {hasCopiedHeaders ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{hasCopiedHeaders ? 'Headers Copied!' : 'Copy Header Row'}</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-black/60 border border-white/10 font-mono text-[11px] text-cyan-300 break-all select-all leading-relaxed">
                Title,Cover Image,Release Year,Languages,Genres,Studio,Type,Status,Episodes,Platform,Ratings,Synopsis,Seasons
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-neutral-300 font-semibold flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-purple-400" />
                <span>Column Mapping Reference</span>
              </span>

              <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.04] border-b border-white/10 text-[11px] font-mono text-neutral-400 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Column Header</th>
                      <th className="py-2.5 px-3">Format / Delimiter</th>
                      <th className="py-2.5 px-3">Required?</th>
                      <th className="py-2.5 px-3">Sample Value</th>
                      <th className="py-2.5 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    <tr className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-bold text-white">Title</td>
                      <td className="py-2.5 px-3 text-neutral-300">Text</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-semibold">Yes</td>
                      <td className="py-2.5 px-3 text-cyan-300">Solo Leveling</td>
                      <td className="py-2.5 px-3 text-neutral-400 font-sans">Primary title used to generate slug</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-bold text-white">Cover Image</td>
                      <td className="py-2.5 px-3 text-neutral-300">URL</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-semibold">Yes</td>
                      <td className="py-2.5 px-3 text-cyan-300">https://images.unsplash.com/...</td>
                      <td className="py-2.5 px-3 text-neutral-400 font-sans">Maps strictly to poster/cover_image</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-bold text-white">Release Year</td>
                      <td className="py-2.5 px-3 text-neutral-300">Integer (YYYY)</td>
                      <td className="py-2.5 px-3 text-neutral-400">Optional</td>
                      <td className="py-2.5 px-3 text-cyan-300">2024</td>
                      <td className="py-2.5 px-3 text-neutral-400 font-sans">Defaults to 2024 if blank</td>
                    </tr>
                    <tr className="hover:bg-purple-500/5 bg-purple-500/[0.02]">
                      <td className="py-2.5 px-3 font-bold text-purple-300">Languages</td>
                      <td className="py-2.5 px-3 text-purple-300 font-bold">Pipe Separated (|)</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-semibold">Yes</td>
                      <td className="py-2.5 px-3 text-purple-200 font-bold">Tamil|Telugu|Hindi</td>
                      <td className="py-2.5 px-3 text-neutral-300 font-sans">Available Indian regional dub audio tracks</td>
                    </tr>
                    <tr className="hover:bg-purple-500/5 bg-purple-500/[0.02]">
                      <td className="py-2.5 px-3 font-bold text-purple-300">Genres</td>
                      <td className="py-2.5 px-3 text-purple-300 font-bold">Pipe Separated (|)</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-semibold">Yes</td>
                      <td className="py-2.5 px-3 text-purple-200 font-bold">Action|Fantasy|Supernatural</td>
                      <td className="py-2.5 px-3 text-neutral-300 font-sans">Genre categories</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-bold text-white">Studio</td>
                      <td className="py-2.5 px-3 text-neutral-300">Text</td>
                      <td className="py-2.5 px-3 text-neutral-400">Optional</td>
                      <td className="py-2.5 px-3 text-cyan-300">A-1 Pictures</td>
                      <td className="py-2.5 px-3 text-neutral-400 font-sans">Animation studio name</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-bold text-white">Type</td>
                      <td className="py-2.5 px-3 text-neutral-300">Enum Text</td>
                      <td className="py-2.5 px-3 text-neutral-400">Optional</td>
                      <td className="py-2.5 px-3 text-cyan-300">TV Series</td>
                      <td className="py-2.5 px-3 text-neutral-400 font-sans">TV Series, Movie, OVA, ONA, Special</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-bold text-white">Status</td>
                      <td className="py-2.5 px-3 text-neutral-300">Airing / Completed</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-semibold">Yes</td>
                      <td className="py-2.5 px-3 text-cyan-300">Completed</td>
                      <td className="py-2.5 px-3 text-neutral-400 font-sans">Case-insensitive; checks for 'complete'</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-bold text-white">Episodes</td>
                      <td className="py-2.5 px-3 text-neutral-300">Integer</td>
                      <td className="py-2.5 px-3 text-neutral-400">Optional</td>
                      <td className="py-2.5 px-3 text-cyan-300">12</td>
                      <td className="py-2.5 px-3 text-neutral-400 font-sans">Total episodes count</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-bold text-white">Platform</td>
                      <td className="py-2.5 px-3 text-neutral-300">Text</td>
                      <td className="py-2.5 px-3 text-neutral-400">Optional</td>
                      <td className="py-2.5 px-3 text-cyan-300">Crunchyroll</td>
                      <td className="py-2.5 px-3 text-neutral-400 font-sans">Crunchyroll, Netflix, JioCinema, etc.</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-bold text-white">Ratings</td>
                      <td className="py-2.5 px-3 text-neutral-300">Decimal (0.0 - 10.0)</td>
                      <td className="py-2.5 px-3 text-neutral-400">Optional</td>
                      <td className="py-2.5 px-3 text-cyan-300">8.5</td>
                      <td className="py-2.5 px-3 text-neutral-400 font-sans">IMDb/MAL aggregated score</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-bold text-white">Synopsis</td>
                      <td className="py-2.5 px-3 text-neutral-300">Quoted Text ("...")</td>
                      <td className="py-2.5 px-3 text-neutral-400">Optional</td>
                      <td className="py-2.5 px-3 text-cyan-300">"Story text..."</td>
                      <td className="py-2.5 px-3 text-neutral-400 font-sans">Always quote if synopsis contains commas</td>
                    </tr>
                    <tr className="hover:bg-cyan-500/5 bg-cyan-500/[0.02]">
                      <td className="py-2.5 px-3 font-bold text-cyan-300">Seasons</td>
                      <td className="py-2.5 px-3 text-cyan-300 font-bold">Pipe &amp; Colon (|:)</td>
                      <td className="py-2.5 px-3 text-neutral-400">Optional</td>
                      <td className="py-2.5 px-3 text-cyan-200 font-bold">Season 1:26|Season 2:11</td>
                      <td className="py-2.5 px-3 text-neutral-300 font-sans">Populates Mixed Entries (Seasons, OVAs) in Edit Modal</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-300 font-semibold flex items-center gap-2">
                  <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ready-to-Use Complete Sample CSV</span>
                </span>
                <button
                  onClick={onCopySnippet}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-emerald-300 hover:text-emerald-200 text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {hasCopiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{hasCopiedSnippet ? 'Sample Copied!' : 'Copy Sample Data'}</span>
                </button>
              </div>

              <pre className="p-3.5 rounded-xl bg-black/80 border border-white/10 font-mono text-[10px] text-neutral-300 overflow-x-auto leading-relaxed select-all">
                {`Title,Cover Image,Release Year,Languages,Genres,Studio,Type,Status,Episodes,Platform,Ratings,Synopsis,Seasons
Solo Leveling,https://images.unsplash.com/photo-1578632767115-351597fd14f5?w=300,2024,Tamil|Telugu|Hindi,Action|Fantasy,A-1 Pictures,TV Series,Completed,12,Crunchyroll,8.5,"In a world where hunters must battle deadly monsters, a weak hunter gets a second chance to level up.","Season 1:12"
Demon Slayer: Hashira Training,https://images.unsplash.com/photo-1578632767115-351597fd14f5?w=300,2024,Tamil|Hindi,Action|Supernatural,Ufotable,TV Series,Airing,8,Crunchyroll,8.9,"Tanjiro goes to see the Stone Hashira, Himejima, who intends to prepare him for the battles to come.","Season 1:26|Season 2:11|Season 3:11|Season 4:8"
Dr. Stone,https://images.unsplash.com/photo-1578632767115-351597fd14f5?w=300,2019,Tamil|Telugu|Malayalam,Sci-Fi|Adventure,TMS Entertainment,TV Series,Completed,24,Crunchyroll,8.1,"After a blinding green light strikes the Earth, humanity is turned to stone.","Season 1:24|Season 2:11|Season 3:22"`}
              </pre>
            </div>
          </div>

          <div className="p-4 sm:p-5 border-t border-white/10 bg-[#0c1222] flex items-center justify-between flex-wrap gap-3 shrink-0">
            <button
              onClick={onDownloadTemplate}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download .CSV Template</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Close Guide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
