'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  ExternalLink, 
  RefreshCw,
  Search,
  Sparkles,
  LogOut,
  Radio,
  Check,
  AlertCircle
} from 'lucide-react';
import { dbService } from '../services/databaseService';
import { AnimeRecord } from '../types/database';
import { DubLanguage } from '../types/anime';

interface AdminDashboardProps {
  onExitAdmin?: () => void;
}

const DUB_COLORS: Record<string, string> = {
  Tamil: 'bg-amber-950/70 border-amber-500/40 text-amber-300',
  Telugu: 'bg-sky-950/70 border-sky-500/40 text-sky-300',
  Hindi: 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300',
  Malayalam: 'bg-purple-950/70 border-purple-500/40 text-purple-300',
  Kannada: 'bg-rose-950/70 border-rose-500/40 text-rose-300',
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onExitAdmin }) => {
  const [pendingSubmissions, setPendingSubmissions] = useState<AnimeRecord[]>([]);
  const [approvedAnime, setApprovedAnime] = useState<AnimeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await dbService.forceRefresh();
      setPendingSubmissions(dbService.getPendingSubmissions());
      setApprovedAnime(dbService.getApprovedAnime());
    } catch (err) {
      console.error('Failed to sync admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsub = dbService.subscribe(() => {
      setPendingSubmissions(dbService.getPendingSubmissions());
      setApprovedAnime(dbService.getApprovedAnime());
    });
    return unsub;
  }, []);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setActionNotice({ message, type });
    setTimeout(() => {
      setActionNotice(null);
    }, 3500);
  };

  const handleApprove = async (id: string, title: string) => {
    setProcessingId(id);
    try {
      const success = dbService.approveSubmission(id, 'Approved via Live Stealth Admin', 'Admin (prasanth123)');
      if (success) {
        showNotification(`✓ Approved "${title}"! Now live on AniDub India.`);
      } else {
        showNotification(`Failed to approve item`, 'error');
      }
    } catch (e: any) {
      showNotification(`Error approving: ${e.message}`, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to reject and delete "${title}"?`)) {
      return;
    }
    setProcessingId(id);
    try {
      dbService.deleteSubmission(id);
      showNotification(`Removed "${title}" from submissions list.`);
    } catch (e: any) {
      showNotification(`Error deleting: ${e.message}`, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const currentList = activeTab === 'pending' ? pendingSubmissions : approvedAnime;
  const filteredItems = currentList.filter(item => 
    item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.dubs || []).some(d => d.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.studio || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full bg-gradient-to-b from-[#141b2d] via-[#101524] to-[#0b0f17] border-b border-purple-500/30 text-neutral-100 p-4 sm:p-6 lg:p-8 font-sans transition-all duration-300">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Control Ribbon */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#161d30]/90 border border-purple-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-400/40">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-black text-lg sm:text-xl text-white tracking-tight">
                  Stealth Admin Panel
                </h2>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Review submissions, approve regional dubs, and manage JSONBin.io database in real-time.
              </p>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-[#0c101a] border border-neutral-800 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-neutral-400 font-medium">Pending:</span>
              <span className="font-bold text-amber-400">{pendingSubmissions.length}</span>
              <span className="text-neutral-600">|</span>
              <span className="text-neutral-400 font-medium">Live Catalog:</span>
              <span className="font-bold text-emerald-400">{approvedAnime.length}</span>
            </div>

            <button 
              onClick={fetchData}
              disabled={isLoading}
              title="Force Sync with JSONBin"
              className="p-2.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700/80 border border-neutral-700 text-neutral-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
            </button>

            {onExitAdmin && (
              <button 
                onClick={onExitAdmin}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit Admin</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Toast Notification */}
        {actionNotice && (
          <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all animate-in slide-in-from-top-2 ${
            actionNotice.type === 'success' 
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200' 
              : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
          }`}>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {actionNotice.message}
            </span>
            <button onClick={() => setActionNotice(null)} className="text-neutral-400 hover:text-white ml-2">✕</button>
          </div>
        )}

        {/* Tab Selector & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Tabs */}
          <div className="flex items-center gap-2 p-1 bg-[#131929] border border-neutral-800 rounded-xl w-fit">
            <button 
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'pending' 
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending Approvals</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === 'pending' ? 'bg-amber-700 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}>
                {pendingSubmissions.length}
              </span>
            </button>

            <button 
              onClick={() => setActiveTab('approved')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'approved' 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Live Catalog</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === 'approved' ? 'bg-purple-700 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}>
                {approvedAnime.length}
              </span>
            </button>
          </div>

          {/* Search Filter */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search by title, ID, language..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#131929] border border-neutral-800 focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Content Section: Pending Submissions or Live Catalog */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3 bg-[#111726]/40 border border-neutral-800/80 rounded-2xl">
            <RefreshCw className="w-7 h-7 text-purple-400 animate-spin mx-auto" />
            <p className="text-xs text-neutral-400 font-medium">Synchronizing with JSONBin.io database...</p>
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item) => {
              const isPending = item.status === 'pending' || item.submissionStatus === 'pending';
              const isProcessing = processingId === item.id;

              return (
                <div 
                  key={item.id}
                  className={`relative flex flex-col sm:flex-row gap-4 p-4 rounded-2xl border transition-all duration-200 ${
                    isPending 
                      ? 'bg-[#151a2d]/90 border-amber-500/30 hover:border-amber-500/60 shadow-xl' 
                      : 'bg-[#121726]/90 border-neutral-800 hover:border-purple-500/40'
                  }`}
                >
                  {/* Poster Thumbnail */}
                  <div className="w-full sm:w-28 h-40 sm:h-auto shrink-0 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 relative">
                    <img 
                      src={item.poster || item.imageUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600'} 
                      alt={item.title} 
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-md text-[9px] font-bold text-white uppercase border border-white/10">
                      {item.type || 'Series'}
                    </div>
                  </div>

                  {/* Details Area */}
                  <div className="flex flex-col justify-between flex-grow min-w-0 space-y-2.5">
                    <div>
                      {/* Title & External Link */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-heading font-black text-white text-base truncate" title={item.title}>
                            {item.title}
                          </h3>
                          {item.romajiTitle && item.romajiTitle !== item.title && (
                            <p className="text-[11px] text-neutral-400 italic truncate">{item.romajiTitle}</p>
                          )}
                        </div>

                        <a 
                          href={`#anime/${item.id}`}
                          title="Preview Anime Page"
                          className="p-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      {/* Meta Tags: Year, Studio, Rating */}
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-400 font-semibold mt-1">
                        <span>{item.releaseYear || '2024'}</span>
                        <span>•</span>
                        <span>{item.studio || 'Studio'}</span>
                        <span>•</span>
                        <span className="text-amber-400">★ {item.rating?.toFixed(1) || '8.0'}</span>
                        {item.airingStatus && (
                          <>
                            <span>•</span>
                            <span className={item.airingStatus === 'Ongoing' ? 'text-emerald-400' : 'text-neutral-400'}>
                              {item.airingStatus} {item.releaseDay ? `(${item.releaseDay})` : ''}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Dubbed Languages Badges */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(item.dubs || []).map((dub) => (
                          <span 
                            key={dub} 
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${DUB_COLORS[dub] || 'bg-neutral-800 border-neutral-700 text-neutral-300'}`}
                          >
                            {dub} Dub
                          </span>
                        ))}
                      </div>

                      {/* Synopsis Preview */}
                      <p className="text-xs text-neutral-300 line-clamp-2 mt-2 leading-relaxed">
                        {item.synopsis || 'No synopsis provided.'}
                      </p>
                    </div>

                    {/* Submitter & Action Buttons */}
                    <div className="pt-2 border-t border-neutral-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="text-[10px] text-neutral-400 truncate">
                        Submitted by <strong className="text-neutral-200">{item.submittedBy?.userName || 'User'}</strong>
                        {item.submittedAt && (
                          <span> • {new Date(item.submittedAt).toLocaleDateString()}</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isPending ? (
                          <>
                            <button 
                              onClick={() => handleDelete(item.id, item.title)}
                              disabled={isProcessing}
                              className="px-3 py-1.5 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>

                            <button 
                              onClick={() => handleApprove(item.id, item.title)}
                              disabled={isProcessing}
                              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve Live</span>
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleDelete(item.id, item.title)}
                            disabled={isProcessing}
                            className="px-2.5 py-1 rounded-lg border border-neutral-800 text-neutral-400 hover:text-rose-400 hover:border-rose-500/30 text-xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="py-16 text-center bg-[#111726]/40 border border-neutral-800/80 rounded-3xl p-8 max-w-md mx-auto shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-neutral-800/60 border border-neutral-700/60 mx-auto mb-4 flex items-center justify-center text-neutral-400">
              {activeTab === 'pending' ? <CheckCircle2 className="w-7 h-7 text-emerald-400" /> : <Clock className="w-7 h-7 text-purple-400" />}
            </div>
            <h3 className="font-heading font-black text-lg text-white mb-1.5">
              {activeTab === 'pending' ? 'All Submissions Approved' : 'No Items Found'}
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              {activeTab === 'pending' 
                ? 'Great job! There are currently no pending anime dubs awaiting moderation. Any new user submissions will appear here instantly.'
                : 'No anime matches your search query in the catalog.'}
            </p>
          </div>
        )}

      </div>
    </div>
  );
};
