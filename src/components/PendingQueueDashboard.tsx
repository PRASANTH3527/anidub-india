'use client';

import React, { useState, useEffect } from 'react';
import { 
  Database, 
  RefreshCw, 
  Loader2, 
  Upload, 
  Users, 
  Clock, 
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { dbService } from '../services/databaseService';
import { useToast } from './Toast';

interface PendingQueueDashboardProps {
  onSyncSuccess?: () => void;
}

export const PendingQueueDashboard: React.FC<PendingQueueDashboardProps> = ({ onSyncSuccess }) => {
  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
  const [adminUploads, setAdminUploads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingUser, setIsSyncingUser] = useState(false);
  const [isSyncingAdmin, setIsSyncingAdmin] = useState(false);
  const toast = useToast();

  const fetchData = async () => {
    // We don't necessarily need to set isLoading(true) for every refresh 
    // to avoid flickering if we're just updating counts
    try {
      const [users, admins] = await Promise.all([
        dbService.getPendingRtdbSubmissions(),
        dbService.getAdminPendingRtdbUploads()
      ]);
      setUserSubmissions(users);
      setAdminUploads(admins);
    } catch (err) {
      console.error('[PendingQueue] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSyncUser = async () => {
    setIsSyncingUser(true);
    try {
      const res = await dbService.syncRtdbToFirestore();
      if (res.success > 0) {
        toast.success('Sync Success', `${res.success} user submissions synced.`);
        onSyncSuccess?.();
      } else {
        toast.info('Sync Info', 'No new user items to sync.');
      }
      fetchData();
    } catch (err) {
      toast.error('Sync Failed', 'Failed to sync user submissions.');
    } finally {
      setIsSyncingUser(false);
    }
  };

  const handleSyncAdmin = async () => {
    setIsSyncingAdmin(true);
    try {
      const res = await dbService.syncAdminRtdbToFirestore();
      if (res.success > 0) {
        toast.success('Sync Success', `${res.success} bulk upload records synced.`);
        onSyncSuccess?.();
      } else {
        toast.info('Sync Info', 'No new bulk items to sync.');
      }
      fetchData();
    } catch (err) {
      toast.error('Sync Failed', 'Failed to sync bulk uploads.');
    } finally {
      setIsSyncingAdmin(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary-theme" />
        <p className="text-neutral-400 font-medium">Fetching Cloud Fallback Queue...</p>
      </div>
    );
  }

  const totalPending = userSubmissions.length + adminUploads.length;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#121829] border border-neutral-800 p-5 rounded-3xl shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Total Queue</span>
          </div>
          <p className="text-3xl font-black text-white">{totalPending}</p>
          <p className="text-[10px] text-neutral-500 mt-1">Stuck in RTDB Fallback</p>
        </div>

        <div className="bg-[#121829] border border-neutral-800 p-5 rounded-3xl shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">User Submissions</span>
          </div>
          <p className="text-3xl font-black text-white">{userSubmissions.length}</p>
          <button 
            onClick={handleSyncUser}
            disabled={isSyncingUser || userSubmissions.length === 0}
            className="mt-2 text-[10px] font-black uppercase text-amber-500 hover:text-amber-400 disabled:opacity-30 transition-colors flex items-center gap-1"
          >
            {isSyncingUser ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Sync Users
          </button>
        </div>

        <div className="bg-[#121829] border border-neutral-800 p-5 rounded-3xl shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Upload className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Admin Bulk JSON</span>
          </div>
          <p className="text-3xl font-black text-white">{adminUploads.length}</p>
          <button 
            onClick={handleSyncAdmin}
            disabled={isSyncingAdmin || adminUploads.length === 0}
            className="mt-2 text-[10px] font-black uppercase text-purple-500 hover:text-purple-400 disabled:opacity-30 transition-colors flex items-center gap-1"
          >
            {isSyncingAdmin ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Sync Admin
          </button>
        </div>
      </div>

      {totalPending === 0 ? (
        <div className="bg-[#121829]/50 border border-dashed border-neutral-800 rounded-3xl py-12 px-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500/30 mx-auto mb-4" />
          <h4 className="text-white font-bold">Queue is Empty</h4>
          <p className="text-xs text-neutral-500 mt-1">All submissions have been successfully processed into Firestore.</p>
          <button 
            onClick={fetchData}
            className="mt-6 px-4 py-2 rounded-xl bg-neutral-800 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-700 transition-all"
          >
            Refresh Data
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Submissions List */}
          <div className="bg-[#121829] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="font-heading font-black text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                User Pending Queue
              </h3>
              <span className="bg-amber-500/10 text-amber-500 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-500/20">
                {userSubmissions.length} Items
              </span>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto divide-y divide-neutral-800/50 flex-grow custom-scrollbar">
              {userSubmissions.length > 0 ? userSubmissions.map((item, idx) => (
                <div key={item.id || idx} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.fallbackAt ? new Date(item.fallbackAt).toLocaleTimeString() : 'Recently'}
                      </span>
                      <span>•</span>
                      <span className="text-amber-400 font-medium">
                        {Array.isArray(item.dubs) ? item.dubs[0] : item.language || 'Dub'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase text-neutral-600 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                      RTDB
                    </span>
                  </div>
                </div>
              )) : (
                <div className="p-8 text-center italic text-neutral-600 text-xs">No pending user submissions.</div>
              )}
            </div>

            <div className="p-4 bg-neutral-900/50 border-t border-neutral-800">
              <button
                onClick={handleSyncUser}
                disabled={isSyncingUser || userSubmissions.length === 0}
                className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSyncingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>Move to Firestore</span>
              </button>
            </div>
          </div>

          {/* Admin Bulk Uploads List */}
          <div className="bg-[#121829] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="font-heading font-black text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-500" />
                Bulk Import Queue
              </h3>
              <span className="bg-purple-500/10 text-purple-500 text-[10px] font-black px-2 py-0.5 rounded-full border border-purple-500/20">
                {adminUploads.length} Items
              </span>
            </div>

            <div className="max-h-[400px] overflow-y-auto divide-y divide-neutral-800/50 flex-grow custom-scrollbar">
              {adminUploads.length > 0 ? adminUploads.map((item, idx) => (
                <div key={item.id || idx} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.fallbackAt ? new Date(item.fallbackAt).toLocaleTimeString() : 'Recently'}
                      </span>
                      <span>•</span>
                      <span className="text-purple-400 font-medium">
                        {item.type || 'Anime'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase text-neutral-600 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                      RTDB
                    </span>
                  </div>
                </div>
              )) : (
                <div className="p-8 text-center italic text-neutral-600 text-xs">No pending bulk uploads.</div>
              )}
            </div>

            <div className="p-4 bg-neutral-900/50 border-t border-neutral-800">
              <button
                onClick={handleSyncAdmin}
                disabled={isSyncingAdmin || adminUploads.length === 0}
                className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSyncingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>Sync JSON to Firestore</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Bottom Alert about Quota */}
      <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-300 leading-relaxed">
          <p className="font-bold">Realtime Database Fallback Active</p>
          <p className="mt-1 opacity-70">
            Records here were automatically saved to RTDB because the Firestore daily write quota was exceeded. 
            Once the quota resets (usually at midnight PST), you can manually sync these records back to the main Firestore database using the buttons above.
          </p>
        </div>
      </div>
    </div>
  );
};
