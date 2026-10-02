'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Layers,
  BarChart3,
  Languages,
  Film,
  Tv,
  TrendingUp,
  Filter
} from 'lucide-react';
import { dbService } from '../services/databaseService';
import { AnimeRecord } from '../types/database';
import { DubLanguage } from '../types/anime';
import { useToast } from './Toast';
import { AdminSkeleton } from './SkeletonGrid';

interface AdminDashboardProps {
  onExitAdmin?: () => void;
}

const SUPPORTED_LANGUAGES: { name: DubLanguage; label: string; bg: string; text: string; border: string; bar: string }[] = [
  { name: 'Tamil', label: 'Tam', bg: 'bg-amber-950/60', text: 'text-amber-300', border: 'border-amber-500/40', bar: 'bg-amber-500' },
  { name: 'Telugu', label: 'Tel', bg: 'bg-sky-950/60', text: 'text-sky-300', border: 'border-sky-500/40', bar: 'bg-sky-500' },
  { name: 'Hindi', label: 'Hin', bg: 'bg-emerald-950/60', text: 'text-emerald-300', border: 'border-emerald-500/40', bar: 'bg-emerald-500' },
  { name: 'Malayalam', label: 'Mal', bg: 'bg-purple-950/60', text: 'text-purple-300', border: 'border-purple-500/40', bar: 'bg-purple-500' },
  { name: 'Kannada', label: 'Kan', bg: 'bg-rose-950/60', text: 'text-rose-300', border: 'border-rose-500/40', bar: 'bg-rose-500' },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onExitAdmin }) => {
  const [pendingSubmissions, setPendingSubmissions] = useState<AnimeRecord[]>([]);
  const [approvedAnime, setApprovedAnime] = useState<AnimeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState<string>('All');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const toast = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await dbService.forceRefresh();
      setPendingSubmissions(dbService.getPendingSubmissions());
      setApprovedAnime(dbService.getApprovedAnime());
    } catch (err: any) {
      console.error('Failed to sync admin data:', err);
      toast.error('Sync Error', 'Could not refresh JSONBin database.');
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

  // ==========================================================================
  // 1. Enhanced Stealth Admin Analytics Calculations
  // ==========================================================================
  const analytics = useMemo(() => {
    const totalApproved = approvedAnime.length;
    const totalPending = pendingSubmissions.length;
    const totalAll = totalApproved + totalPending;

    // Language counts for approved and total
    const languageCounts: Record<DubLanguage, { approved: number; total: number; percentage: number }> = {
      Tamil: { approved: 0, total: 0, percentage: 0 },
      Telugu: { approved: 0, total: 0, percentage: 0 },
      Hindi: { approved: 0, total: 0, percentage: 0 },
      Malayalam: { approved: 0, total: 0, percentage: 0 },
      Kannada: { approved: 0, total: 0, percentage: 0 },
    };

    const allRecords = [...approvedAnime, ...pendingSubmissions];

    SUPPORTED_LANGUAGES.forEach(({ name }) => {
      const appCount = approvedAnime.filter((a) => (a.dubs || []).includes(name)).length;
      const totCount = allRecords.filter((a) => (a.dubs || []).includes(name)).length;
      const pct = totalApproved > 0 ? Math.round((appCount / totalApproved) * 100) : 0;
      languageCounts[name] = { approved: appCount, total: totCount, percentage: pct };
    });

    const seriesCount = approvedAnime.filter((a) => a.type === 'Series').length;
    const moviesCount = approvedAnime.filter((a) => a.type === 'Movie').length;

    return {
      totalApproved,
      totalPending,
      totalAll,
      languageCounts,
      seriesCount,
      moviesCount,
    };
  }, [approvedAnime, pendingSubmissions]);

  // Actions
  const handleApprove = async (id: string, title: string) => {
    setProcessingId(id);
    try {
      const success = dbService.approveSubmission(id, 'Approved via Live Stealth Admin', 'Admin (prasanth123)');
      if (success) {
        toast.success('Approved Live!', `"${title}" is now published on the public catalog.`);
      } else {
        toast.error('Action Failed', 'Could not approve record.');
      }
    } catch (e: any) {
      toast.error('Approval Error', e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to reject and remove "${title}"?`)) {
      return;
    }
    setProcessingId(id);
    try {
      dbService.deleteSubmission(id);
      toast.info('Submission Removed', `"${title}" has been deleted from submissions.`);
    } catch (e: any) {
      toast.error('Delete Error', e.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Filter items
  const currentList = activeTab === 'pending' ? pendingSubmissions : approvedAnime;
  const filteredItems = currentList.filter((item) => {
    const matchesSearch = 
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.studio || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLanguage = 
      selectedLanguageFilter === 'All' || 
      (item.dubs || []).includes(selectedLanguageFilter as DubLanguage);

    return matchesSearch && matchesLanguage;
  });

  return (
    <div className="w-full bg-gradient-to-b from-[#121729] via-[#0f1422] to-[#0b0f17] border-b border-purple-500/30 text-neutral-100 p-4 sm:p-6 lg:p-8 font-sans transition-all duration-300">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Control Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#151c2e]/90 border border-purple-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-400/40">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-black text-lg sm:text-xl text-white tracking-tight">
                  Stealth Admin & Moderation Panel
                </h2>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Real-time JSONBin.io database analytics, regional dub approvals, and submission queue.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5">
            <button 
              onClick={fetchData}
              disabled={isLoading}
              title="Force Sync with JSONBin"
              className="p-2.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700/80 active:scale-95 border border-neutral-700 text-neutral-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer shadow-md"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
            </button>

            {onExitAdmin && (
              <button 
                onClick={onExitAdmin}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 active:scale-95 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit Admin</span>
              </button>
            )}
          </div>
        </div>

        {/* ================================================================== */}
        {/* 1. Enhanced Analytics Dashboard Section */}
        {/* ================================================================== */}
        <div className="bg-[#131929]/95 border border-purple-500/20 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-heading font-black text-sm sm:text-base text-white">
                  Database Analytics Overview
                </h3>
                <p className="text-[11px] text-neutral-400">Live metrics across regional dub catalogs</p>
              </div>
            </div>
            
            <span className="text-[11px] font-bold text-neutral-500 bg-[#0c101a] px-3 py-1 rounded-full border border-neutral-800">
              Total Records: <strong className="text-purple-300">{analytics.totalAll}</strong>
            </span>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. Total Approved */}
            <div className="bg-[#0e1320] border border-emerald-500/30 rounded-2xl p-4 flex flex-col justify-between hover:border-emerald-500/50 transition-colors group">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold mb-1">
                <span>Approved Live</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {analytics.totalApproved}
                </span>
                <span className="text-[10px] text-emerald-400 font-bold uppercase">Public</span>
              </div>
              <p className="text-[10px] text-neutral-500 mt-1">Live in AniDub catalog</p>
            </div>

            {/* 2. Total Pending */}
            <div className="bg-[#0e1320] border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between hover:border-amber-500/50 transition-colors group">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold mb-1">
                <span>Pending Approvals</span>
                <Clock className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {analytics.totalPending}
                </span>
                <span className="text-[10px] text-amber-400 font-bold uppercase">Queue</span>
              </div>
              <p className="text-[10px] text-neutral-500 mt-1">Awaiting moderation</p>
            </div>

            {/* 3. Series Count */}
            <div className="bg-[#0e1320] border border-neutral-800 rounded-2xl p-4 flex flex-col justify-between hover:border-neutral-700 transition-colors">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold mb-1">
                <span>Anime Series</span>
                <Tv className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {analytics.seriesCount}
                </span>
                <span className="text-[10px] text-purple-400 font-bold uppercase">Shows</span>
              </div>
              <p className="text-[10px] text-neutral-500 mt-1">Multi-episode formats</p>
            </div>

            {/* 4. Movies Count */}
            <div className="bg-[#0e1320] border border-neutral-800 rounded-2xl p-4 flex flex-col justify-between hover:border-neutral-700 transition-colors">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold mb-1">
                <span>Anime Movies</span>
                <Film className="w-4 h-4 text-sky-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {analytics.moviesCount}
                </span>
                <span className="text-[10px] text-sky-400 font-bold uppercase">Films</span>
              </div>
              <p className="text-[10px] text-neutral-500 mt-1">Theatrical releases</p>
            </div>
          </div>

          {/* Regional Dub Language Breakdown */}
          <div className="pt-2 border-t border-neutral-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5 text-purple-400" />
                Regional Dub Language Breakdown
              </span>
              <span className="text-[10px] text-neutral-400">Click any language to filter table</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const countInfo = analytics.languageCounts[lang.name];
                const isSelected = selectedLanguageFilter === lang.name;

                return (
                  <button
                    key={lang.name}
                    onClick={() => setSelectedLanguageFilter(isSelected ? 'All' : lang.name)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group active:scale-95 ${
                      isSelected
                        ? 'bg-[#182138] border-purple-500 shadow-md shadow-purple-600/20 ring-1 ring-purple-400'
                        : `${lang.bg} ${lang.border} hover:border-purple-500/50`
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-bold ${lang.text}`}>
                        {lang.name}
                      </span>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-black/40 text-neutral-300 border border-white/10">
                        {lang.label}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-black text-white">
                        {countInfo.approved}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-medium">
                        {countInfo.percentage}% share
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-black/40 h-1 rounded-full mt-2 overflow-hidden">
                      <div 
                        className={`h-full ${lang.bar} transition-all duration-500`}
                        style={{ width: `${Math.max(8, countInfo.percentage)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Selector & Search Ribbon */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Tabs */}
          <div className="flex items-center gap-2 p-1 bg-[#131929] border border-neutral-800 rounded-2xl w-fit">
            <button 
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
                activeTab === 'pending' 
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending Approvals</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'pending' ? 'bg-amber-700 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}>
                {pendingSubmissions.length}
              </span>
            </button>

            <button 
              onClick={() => setActiveTab('approved')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
                activeTab === 'approved' 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Live Catalog</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'approved' ? 'bg-purple-700 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}>
                {approvedAnime.length}
              </span>
            </button>
          </div>

          {/* Search & Language Filter Controls */}
          <div className="flex items-center gap-2">
            {selectedLanguageFilter !== 'All' && (
              <button
                onClick={() => setSelectedLanguageFilter('All')}
                className="px-2.5 py-2 rounded-xl bg-purple-900/40 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <span>{selectedLanguageFilter}</span>
                <span className="text-[10px]">✕</span>
              </button>
            )}

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search title, ID, studio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#131929] border border-neutral-800 focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Content Section: Pending Submissions or Live Catalog */}
        {isLoading ? (
          <AdminSkeleton />
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
                          className="p-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 active:scale-95 text-neutral-300 hover:text-white transition-colors shrink-0 cursor-pointer"
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
                        {(item.dubs || []).map((dub) => {
                          const langObj = SUPPORTED_LANGUAGES.find((l) => l.name === dub);
                          return (
                            <span 
                              key={dub} 
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${langObj ? `${langObj.bg} ${langObj.border} ${langObj.text}` : 'bg-neutral-800 border-neutral-700 text-neutral-300'}`}
                            >
                              {dub} Dub
                            </span>
                          );
                        })}
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
                              className="px-3.5 py-1.5 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 active:scale-95 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>

                            <button 
                              onClick={() => handleApprove(item.id, item.title)}
                              disabled={isProcessing}
                              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve Live</span>
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleDelete(item.id, item.title)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-xl border border-neutral-800 hover:border-rose-500/40 text-neutral-400 hover:text-rose-300 hover:bg-rose-500/10 active:scale-95 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
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
          <div className="py-16 text-center bg-[#111726]/40 border border-neutral-800/80 rounded-3xl p-8 max-w-md mx-auto shadow-2xl animate-in fade-in duration-300">
            <div className="w-14 h-14 rounded-2xl bg-neutral-800/60 border border-neutral-700/60 mx-auto mb-4 flex items-center justify-center text-neutral-400">
              {activeTab === 'pending' ? <CheckCircle2 className="w-7 h-7 text-emerald-400" /> : <Clock className="w-7 h-7 text-purple-400" />}
            </div>
            <h3 className="font-heading font-black text-lg text-white mb-1.5">
              {activeTab === 'pending' ? 'All Submissions Approved' : 'No Items Found'}
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              {activeTab === 'pending' 
                ? 'Great job! There are currently no pending anime dubs awaiting moderation. Any new user submissions will appear here instantly.'
                : 'No anime matches your filter criteria.'}
            </p>
          </div>
        )}

      </div>
    </div>
  );
};
