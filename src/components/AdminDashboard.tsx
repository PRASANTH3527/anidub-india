'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  RefreshCw,
  Search,
  MessageSquare,
  User,
  Calendar
} from 'lucide-react';
import { dbService } from '../services/databaseService';
import { AnimeRecord } from '../types/database';

export const AdminDashboard: React.FC = () => {
  const [pendingSubmissions, setPendingSubmissions] = useState<AnimeRecord[]>([]);
  const [approvedAnime, setApprovedAnime] = useState<AnimeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await dbService.forceRefresh();
      setPendingSubmissions(dbService.getPendingSubmissions());
      setApprovedAnime(dbService.getApprovedAnime());
    } catch (err) {
      console.error('Failed to fetch data:', err);
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

  const handleApprove = async (id: string) => {
    if (confirm('Approve this submission for public catalog?')) {
      const success = dbService.approveSubmission(id, 'Approved via Admin Dashboard');
      if (!success) alert('Failed to approve local record');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Reason for rejection?');
    if (reason !== null) {
      dbService.rejectSubmission(id, reason || 'Incomplete info');
    }
  };

  const filteredItems = (activeTab === 'pending' ? pendingSubmissions : approvedAnime).filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-transparent text-neutral-100 p-4 sm:px-8 sm:py-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-heading font-black text-xl text-white tracking-tight">Moderation Panel</h1>
              <p className="text-[10px] text-neutral-400 font-medium">Approve community submissions to go live</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={fetchData}
              disabled={isLoading}
              className="p-2 rounded-xl bg-neutral-800/50 border border-neutral-700 hover:border-purple-500/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 p-1.5 bg-[#131926] border border-neutral-800 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'pending' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pending ({pendingSubmissions.length})
          </button>
          <button 
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'approved' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved ({approvedAnime.length})
          </button>
        </div>

        {/* List Section */}
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search by title or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#131926] border border-neutral-800 rounded-xl pl-11 pr-4 py-3 text-xs focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>

          {isLoading ? (
            <div className="py-20 text-center space-y-4">
              <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mx-auto" />
              <p className="text-xs text-neutral-400 font-medium">Synchronizing...</p>
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredItems.map((item) => (
                <div 
                  key={item.id}
                  className="bg-[#131926] border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row gap-5 hover:border-neutral-700 transition-all group"
                >
                  {/* Poster */}
                  <div className="w-full sm:w-24 h-36 sm:h-32 shrink-0 rounded-xl overflow-hidden border border-neutral-800 relative">
                    <img 
                      src={item.poster} 
                      alt={item.title} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-bold text-white border border-white/10 uppercase">
                      {item.type}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-grow min-w-0 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-heading font-black text-white text-lg truncate group-hover:text-purple-400 transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest truncate">
                          ID: {item.id} • {item.releaseYear} • {item.studio}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a 
                          href={`/#anime/${item.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {item.dubs.map(dub => (
                        <span key={dub} className="px-2 py-0.5 rounded-md bg-purple-950/40 border border-purple-500/30 text-[10px] font-bold text-purple-300">
                          {dub} Dub
                        </span>
                      ))}
                    </div>

                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                      {item.synopsis}
                    </p>

                    <div className="pt-2 flex items-center justify-between border-t border-neutral-800/50">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-[9px] font-bold text-neutral-500">
                          {item.submittedBy?.userName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <p className="text-[10px] text-neutral-500">
                          By <span className="text-neutral-300 font-bold">{item.submittedBy?.userName || 'Community Member'}</span> • {new Date(item.submittedAt).toLocaleDateString()}
                        </p>
                      </div>

                      {activeTab === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleReject(item.id)}
                            className="px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-[10px] font-bold transition-colors flex items-center gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                          <button 
                            onClick={() => handleApprove(item.id)}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve Live
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-24 text-center bg-[#131926]/50 border border-neutral-800 rounded-3xl p-8 max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-neutral-800/50 border border-neutral-700/50 mx-auto mb-4 flex items-center justify-center text-neutral-500">
                <Clock className="w-7 h-7" />
              </div>
              <h3 className="font-heading font-black text-xl text-white mb-2">No Items Found</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Everything is up to date! New community submissions will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
