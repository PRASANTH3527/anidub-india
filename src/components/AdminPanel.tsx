import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Check, 
  X, 
  Edit3, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  ExternalLink, 
  Trash2, 
  ArrowLeft, 
  RefreshCw, 
  Eye, 
  Lock, 
  Send, 
  Radio, 
  Settings2, 
  Sparkles 
} from 'lucide-react';
import { AnimeRecord } from '../types/database';
import { dbService } from '../services/databaseService';
import { authService } from '../services/authService';
import { telegramService, TelegramMessageLog, TelegramConfig } from '../services/telegramService';
import { DubLanguage, StreamingPlatform } from '../types/anime';

interface AdminPanelProps {
  onBackToHome: () => void;
  onViewAnime: (anime: AnimeRecord) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToHome, onViewAnime }) => {
  const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());
  const [isAdmin, setIsAdmin] = useState(authService.isAdmin());
  
  const [pendingList, setPendingList] = useState<AnimeRecord[]>([]);
  const [approvedList, setApprovedList] = useState<AnimeRecord[]>([]);
  const [rejectedList, setRejectedList] = useState<AnimeRecord[]>([]);
  const [telegramLogs, setTelegramLogs] = useState<TelegramMessageLog[]>([]);
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(telegramService.getConfig());
  
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'telegram'>('pending');

  // Telegram Settings State
  const [botToken, setBotToken] = useState(telegramConfig.botToken);
  const [adminChatId, setAdminChatId] = useState(telegramConfig.adminChatId);
  const [publicChannelId, setPublicChannelId] = useState(telegramConfig.publicChannelId);
  const [enableLiveApi, setEnableLiveApi] = useState(telegramConfig.enabled);
  const [showConfigSaved, setShowConfigSaved] = useState(false);

  // Edit Modal State
  const [editingRecord, setEditingRecord] = useState<AnimeRecord | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSynopsis, setEditSynopsis] = useState('');
  const [editStudio, setEditStudio] = useState('');
  const [editDubs, setEditDubs] = useState<DubLanguage[]>([]);

  // Reject Modal State
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Could not verify official licensing on specified OTT platforms.');

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const refreshData = () => {
    setPendingList(dbService.getPendingSubmissions());
    setApprovedList(dbService.getApprovedAnime());
    setRejectedList(dbService.getRejectedSubmissions());
    setTelegramLogs(telegramService.getLogs());
    setTelegramConfig(telegramService.getConfig());
  };

  useEffect(() => {
    refreshData();
    const unsubAuth = authService.subscribe((user) => {
      setCurrentUser(user);
      setIsAdmin(authService.isAdmin());
    });
    const unsubDb = dbService.subscribe(refreshData);
    const unsubTg = telegramService.subscribe(refreshData);

    return () => {
      unsubAuth();
      unsubDb();
      unsubTg();
    };
  }, []);

  // One-click switch to Admin for demonstration
  const handleElevateToAdmin = async () => {
    await authService.loginWithGoogle(true);
    setIsAdmin(true);
    showToast('Logged in as Admin Moderator (admin@anidub.in)');
  };

  const handleApprove = (id: string, title: string) => {
    dbService.approveSubmission(id, undefined, currentUser?.displayName || 'Admin');
    showToast(`Approved "${title}"! Published live & broadcasted to Telegram channel.`);
  };

  const handleOpenEdit = (record: AnimeRecord) => {
    setEditingRecord(record);
    setEditTitle(record.title);
    setEditSynopsis(record.synopsis);
    setEditStudio(record.studio);
    setEditDubs([...record.dubs]);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    dbService.editSubmission(editingRecord.id, {
      title: editTitle.trim(),
      synopsis: editSynopsis.trim(),
      studio: editStudio.trim(),
      dubs: editDubs,
    });

    showToast(`Updated changes for "${editTitle}".`);
    setEditingRecord(null);
  };

  const handleConfirmReject = () => {
    if (!rejectingId) return;
    const target = pendingList.find((p) => p.id === rejectingId);
    dbService.rejectSubmission(rejectingId, rejectReason, currentUser?.displayName || 'Admin');
    showToast(`Submission "${target?.title || ''}" was rejected.`);
    setRejectingId(null);
  };

  const handleDelete = (id: string) => {
    dbService.deleteSubmission(id);
    showToast('Record deleted from database.');
  };

  // Telegram Inline Action Trigger (Approve / Reject via Telegram Bot)
  const handleTelegramInlineAction = (action: 'approve' | 'reject', animeId: string) => {
    const success = telegramService.handleTelegramCallback(action, animeId, 'Telegram Admin Bot');
    if (success) {
      if (action === 'approve') {
        showToast('✅ Approved via Telegram Bot Callback! Forwarded to Public Channel.');
      } else {
        showToast('❌ Rejected via Telegram Bot Callback.');
      }
    }
  };

  // Save Telegram Bot Settings
  const handleSaveTelegramConfig = (e: React.FormEvent) => {
    e.preventDefault();
    telegramService.saveConfig({
      botToken: botToken.trim(),
      adminChatId: adminChatId.trim(),
      publicChannelId: publicChannelId.trim() || '@anidub_india',
      enabled: enableLiveApi,
    });
    setShowConfigSaved(true);
    setTimeout(() => setShowConfigSaved(false), 3000);
    showToast('Telegram Bot webhook & API credentials saved!');
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHome}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Back to Directory"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
              <h2 className="font-heading font-black text-2xl text-white">
                Admin Moderation & Telegram Bot Console
              </h2>
              <span className="bg-purple-950 text-purple-300 border border-purple-700/60 text-[10px] font-bold px-2 py-0.5 rounded-full">
                /admin-panel
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Review submissions directly on the web or moderate using the Telegram Bot callback buttons.
            </p>
          </div>
        </div>

        {/* Admin status pill or Login Switch */}
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-700/50 px-3 py-1.5 rounded-xl text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-300 font-bold">Admin Verified:</span>
              <span className="text-neutral-300">{currentUser?.email}</span>
            </div>
          ) : (
            <button
              onClick={handleElevateToAdmin}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Login as Admin (admin@anidub.in)</span>
            </button>
          )}

          <button
            onClick={refreshData}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1e1435] text-white px-4 py-3 rounded-2xl border border-purple-500 shadow-2xl text-xs font-semibold flex items-center gap-2.5 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div 
          onClick={() => setActiveTab('pending')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-[#182032] border-amber-500/80 shadow-lg ring-1 ring-amber-500/40'
              : 'bg-[#131926] border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-neutral-400">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2">
            {pendingList.length}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">Awaiting decision</p>
        </div>

        <div 
          onClick={() => setActiveTab('telegram')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'telegram'
              ? 'bg-[#182032] border-sky-500/80 shadow-lg ring-1 ring-sky-500/40'
              : 'bg-[#131926] border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-neutral-400">Telegram Bot</span>
            <Send className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-400 mt-2">
            {telegramLogs.length}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">Dispatches & Channel</p>
        </div>

        <div 
          onClick={() => setActiveTab('approved')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'approved'
              ? 'bg-[#182032] border-emerald-500/80 shadow-lg'
              : 'bg-[#131926] border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-neutral-400">Live in Directory</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">
            {approvedList.length}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">Approved & visible</p>
        </div>

        <div 
          onClick={() => setActiveTab('rejected')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'rejected'
              ? 'bg-[#182032] border-rose-500/80 shadow-lg'
              : 'bg-[#131926] border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-neutral-400">Rejected</span>
            <X className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 mt-2">
            {rejectedList.length}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">Declined entries</p>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="space-y-4">
        
        {/* TAB 1: PENDING SUBMISSIONS */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-black text-lg text-white">
                Submissions Awaiting Approval ({pendingList.length})
              </h3>
              <span className="text-xs text-neutral-400">
                Only approved entries are fetched on the home page and search feeds.
              </span>
            </div>

            {pendingList.length > 0 ? (
              <div className="space-y-3">
                {pendingList.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#131926] border border-amber-900/40 hover:border-amber-500/50 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between transition-all shadow-lg"
                  >
                    {/* Poster + Info */}
                    <div className="flex gap-4 items-start min-w-0">
                      <img
                        src={item.poster}
                        alt={item.title}
                        className="w-16 h-22 object-cover rounded-xl shrink-0 shadow border border-neutral-700"
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-amber-950/80 text-amber-300 border border-amber-800/60 text-[10px] font-bold px-2 py-0.5 rounded">
                            PENDING MODERATION
                          </span>
                          <span className="text-xs text-neutral-400">
                            {item.type} • {item.releaseYear}
                          </span>
                        </div>

                        <h4 className="font-bold text-base text-white truncate">
                          {item.title}
                        </h4>

                        <div className="flex flex-wrap gap-1 items-center pt-0.5">
                          <span className="text-[10px] text-neutral-400 font-semibold mr-1">Dubs:</span>
                          {item.dubs.map((d) => (
                            <span
                              key={d}
                              className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800/50"
                            >
                              {d}
                            </span>
                          ))}
                        </div>

                        <div className="text-[11px] text-neutral-400 pt-1">
                          <span>Submitted by: <strong>{item.submittedBy?.userName}</strong> ({item.submittedBy?.userEmail})</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Approve, Edit, Reject */}
                    <div className="flex flex-wrap items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        onClick={() => handleApprove(item.id, item.title)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/30 transition-all"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>

                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="px-3 py-2 rounded-xl bg-[#1b2336] hover:bg-[#232e47] text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => setRejectingId(item.id)}
                        className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-rose-950/60 text-neutral-300 hover:text-rose-300 border border-neutral-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#131926]/50 border border-neutral-800 rounded-3xl p-12 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto opacity-70" />
                <h4 className="font-bold text-white text-base">All caught up!</h4>
                <p className="text-xs text-neutral-400">
                  There are no pending submissions in the moderation queue.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TELEGRAM BOT ADMIN APPROVAL SYSTEM & BROADCAST CHANNEL */}
        {activeTab === 'telegram' && (
          <div className="space-y-6">
            
            {/* Header info banner */}
            <div className="bg-gradient-to-r from-sky-950/60 to-purple-950/50 border border-sky-800/50 rounded-3xl p-6 shadow-xl space-y-2">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-sky-400" />
                <h3 className="font-heading font-black text-xl text-white">
                  Telegram Bot Admin Approval & Channel Broadcasting
                </h3>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed max-w-3xl">
                When any user submits anime dub details on the website, this webhook triggers an instant message to your private Telegram Bot. 
                Clicking <strong className="text-emerald-400">[✅ Approve]</strong> or <strong className="text-rose-400">[❌ Reject]</strong> on Telegram updates the database status, making it live on the site, and automatically forwards the announcement to your public Telegram Channel.
              </p>
            </div>

            {/* Grid: Live Bot Approval Cards & Live Broadcast Channel Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Left Column: Telegram Private Bot Approval Messages */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <h4 className="font-heading font-black text-base text-white">
                      Private Admin Bot Chat (@AniDubAdminBot)
                    </h4>
                  </div>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    Chat ID: {telegramConfig.adminChatId || '712933804'}
                  </span>
                </div>

                {pendingList.length > 0 ? (
                  <div className="space-y-4">
                    {pendingList.map((item) => (
                      <div
                        key={item.id}
                        className="bg-[#17212b] border border-neutral-700 rounded-2xl overflow-hidden shadow-2xl max-w-md mx-auto"
                      >
                        {/* Telegram Header */}
                        <div className="bg-[#242f3d] px-4 py-2 flex items-center justify-between text-xs border-b border-neutral-700/60">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold text-[10px]">
                              🤖
                            </div>
                            <span className="font-bold text-white">AniDub Admin Bot</span>
                          </div>
                          <span className="text-[10px] text-neutral-400">Just now</span>
                        </div>

                        {/* Telegram Message Body */}
                        <div className="p-3.5 space-y-3">
                          <img
                            src={item.poster}
                            alt={item.title}
                            className="w-full h-48 object-cover rounded-xl shadow"
                          />
                          <div className="text-xs text-neutral-200 font-mono space-y-1 leading-relaxed bg-[#0e1621] p-3 rounded-xl border border-neutral-800">
                            <p className="text-amber-400 font-bold">🚨 NEW ANIME DUB SUBMISSION</p>
                            <p>🎬 <strong>Title:</strong> {item.title}</p>
                            <p>🌐 <strong>Dub:</strong> {item.dubs.join(', ')}</p>
                            <p>📺 <strong>Platform:</strong> {item.platforms[0]?.name || 'Crunchyroll'}</p>
                            <p>👤 <strong>Submitter:</strong> {item.submittedBy?.userName || 'User'}</p>
                            <p className="text-neutral-400 pt-1 text-[11px]">_Status: PENDING ADMIN APPROVAL_</p>
                          </div>

                          {/* Telegram Inline Keyboard Buttons */}
                          <div className="space-y-1.5 pt-1">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => handleTelegramInlineAction('approve', item.id)}
                                className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                              >
                                <span>✅ Approve</span>
                              </button>
                              <button
                                onClick={() => handleTelegramInlineAction('reject', item.id)}
                                className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                              >
                                <span>❌ Reject</span>
                              </button>
                            </div>
                            <button
                              onClick={() => onViewAnime(item)}
                              className="w-full py-1.5 rounded-xl bg-[#242f3d] hover:bg-[#2c384a] text-sky-300 font-semibold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <span>🌐 View on AniDub India</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#131926] border border-neutral-800 rounded-3xl p-8 text-center text-xs text-neutral-400 space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-white font-bold">No Pending Submissions</p>
                    <p>When a user submits a dub on the website, the notification message card with inline buttons will appear here!</p>
                  </div>
                )}
              </div>

              {/* Right Column: Public Telegram Channel Broadcast Preview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-purple-400 animate-pulse" />
                    <h4 className="font-heading font-black text-base text-white">
                      Public Telegram Channel Feed ({telegramConfig.publicChannelId || '@anidub_india'})
                    </h4>
                  </div>
                  <span className="text-[11px] text-purple-400 font-bold">Live Broadcasting</span>
                </div>

                {/* Channel Message Card */}
                {approvedList.slice(0, 2).map((item) => (
                  <div
                    key={'broadcast-' + item.id}
                    className="bg-[#17212b] border border-neutral-700/80 rounded-2xl overflow-hidden shadow-2xl max-w-md mx-auto"
                  >
                    <div className="bg-[#242f3d] px-4 py-2 flex items-center justify-between text-xs border-b border-neutral-700/60">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                          📢
                        </div>
                        <span className="font-bold text-white">AniDub India Community</span>
                        <span className="text-[9px] bg-purple-900 text-purple-200 px-1 rounded">Channel</span>
                      </div>
                      <span className="text-[10px] text-neutral-400">Broadcast</span>
                    </div>

                    <div className="p-3.5 space-y-3">
                      <img
                        src={item.poster}
                        alt={item.title}
                        className="w-full h-44 object-cover rounded-xl shadow"
                      />
                      <div className="text-xs text-neutral-200 font-mono space-y-1.5 leading-relaxed bg-[#0e1621] p-3.5 rounded-xl border border-neutral-800">
                        <p className="text-purple-300 font-black">🎉 NEW ANIME DUB ADDED TO ANIDUB INDIA!</p>
                        <p className="text-white font-bold text-sm">🔥 {item.title.toUpperCase()}</p>
                        <p>🎙 <strong>Audio:</strong> {item.dubs.join(', ')} Dubs</p>
                        <p>📺 <strong>Platform:</strong> {item.platforms[0]?.name || 'Crunchyroll'}</p>
                        <p>⭐ <strong>Rating:</strong> {item.rating.toFixed(1)} / 10</p>
                        <p className="text-neutral-400 text-[11px] pt-1">
                          📖 {item.synopsis.slice(0, 110)}...
                        </p>
                        <p className="text-sky-400 text-[11px] pt-1">
                          {item.dubs.map((d) => `#${d}`).join(' ')} #AnimeIndia #AniDub
                        </p>
                      </div>

                      <button
                        onClick={() => onViewAnime(item)}
                        className="w-full py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>🎬 View on AniDub India Website</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Telegram Bot Credentials & Webhook Settings Card */}
            <div className="bg-[#131926] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-purple-400" />
                  <h4 className="font-heading font-black text-base text-white">
                    Live Telegram Bot API & Webhook Configuration
                  </h4>
                </div>
                {showConfigSaved && (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Credentials Saved!</span>
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveTelegramConfig} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-neutral-300 font-bold mb-1">
                    TELEGRAM_BOT_TOKEN
                  </label>
                  <input
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="e.g. 7129384910:AAHq_w7..."
                    className="w-full bg-[#182032] border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-neutral-500 mt-1 block">From @BotFather</span>
                </div>

                <div>
                  <label className="block text-neutral-300 font-bold mb-1">
                    ADMIN_CHAT_ID (Private Chat)
                  </label>
                  <input
                    type="text"
                    value={adminChatId}
                    onChange={(e) => setAdminChatId(e.target.value)}
                    placeholder="e.g. 192847192"
                    className="w-full bg-[#182032] border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-neutral-500 mt-1 block">Your Telegram User ID from @userinfobot</span>
                </div>

                <div>
                  <label className="block text-neutral-300 font-bold mb-1">
                    PUBLIC_CHANNEL_ID
                  </label>
                  <input
                    type="text"
                    value={publicChannelId}
                    onChange={(e) => setPublicChannelId(e.target.value)}
                    placeholder="e.g. @anidub_india"
                    className="w-full bg-[#182032] border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-neutral-500 mt-1 block">Channel username where bot is admin</span>
                </div>

                <div className="sm:col-span-3 flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-neutral-300 font-semibold text-xs">
                    <input
                      type="checkbox"
                      checked={enableLiveApi}
                      onChange={(e) => setEnableLiveApi(e.target.checked)}
                      className="rounded accent-purple-600 w-4 h-4 cursor-pointer"
                    />
                    <span>Dispatch live HTTP requests to Telegram Bot API (api.telegram.org)</span>
                  </label>

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-purple-600/30 transition-colors"
                  >
                    Save Telegram Settings
                  </button>
                </div>
              </form>
            </div>

          </div>
        )}

        {/* TAB 3: APPROVED ANIME */}
        {activeTab === 'approved' && (
          <div className="space-y-4">
            <h3 className="font-heading font-black text-lg text-white">
              Approved Live Anime ({approvedList.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {approvedList.slice(0, 15).map((anime) => (
                <div
                  key={anime.id}
                  className="bg-[#131926] border border-neutral-800 rounded-2xl p-3 flex gap-3 items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={anime.poster}
                      alt={anime.title}
                      className="w-12 h-16 object-cover rounded-lg shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-white truncate">{anime.title}</h4>
                      <p className="text-[10px] text-neutral-400">{anime.releaseYear} • {anime.studio}</p>
                      <div className="flex gap-1 mt-1">
                        {anime.dubs.slice(0, 3).map((d) => (
                          <span key={d} className="text-[8px] bg-neutral-800 px-1 rounded text-neutral-300">
                            {d.slice(0, 3)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => onViewAnime(anime)}
                      className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
                      title="View Info Page"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(anime)}
                      className="p-1.5 text-neutral-400 hover:text-purple-300 rounded-lg hover:bg-neutral-800"
                      title="Edit Anime"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: REJECTED SUBMISSIONS */}
        {activeTab === 'rejected' && (
          <div className="space-y-4">
            <h3 className="font-heading font-black text-lg text-white">
              Rejected Submissions ({rejectedList.length})
            </h3>
            {rejectedList.length > 0 ? (
              <div className="space-y-3">
                {rejectedList.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#131926] border border-rose-950/40 rounded-2xl p-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-white">{item.title}</h4>
                      <p className="text-xs text-rose-400 mt-0.5">
                        Reason: {item.rejectionReason || 'Declined during review'}
                      </p>
                      <span className="text-[10px] text-neutral-500">
                        Reviewed by {item.reviewedBy || 'Admin'} on {item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(item.id, item.title)}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-emerald-950 text-neutral-300 hover:text-emerald-400 border border-neutral-700 text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Re-Approve
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-neutral-500 hover:text-rose-400 rounded-lg hover:bg-neutral-800"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500 italic">No rejected submissions.</p>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal Dialog */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setEditingRecord(null)} className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-[#141b29] border border-purple-500/40 rounded-3xl p-6 shadow-2xl z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-heading font-black text-base text-white">
                Edit Submission Details
              </h3>
              <button onClick={() => setEditingRecord(null)} className="p-1 rounded text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-300 font-bold mb-1">Anime Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-[#182032] border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-bold mb-1">Studio</label>
                <input
                  type="text"
                  value={editStudio}
                  onChange={(e) => setEditStudio(e.target.value)}
                  className="w-full bg-[#182032] border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-bold mb-1">Synopsis</label>
                <textarea
                  rows={3}
                  value={editSynopsis}
                  onChange={(e) => setEditSynopsis(e.target.value)}
                  className="w-full bg-[#182032] border border-neutral-700 rounded-xl px-3 py-2 text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer shadow-lg shadow-purple-600/30"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Reason Modal Dialog */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setRejectingId(null)} className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#141b29] border border-rose-500/40 rounded-3xl p-6 shadow-2xl z-10 space-y-4">
            <h3 className="font-heading font-black text-base text-white">
              Reject Dub Submission
            </h3>
            <p className="text-xs text-neutral-400">
              Please enter the reason for rejection (visible to user / moderation audit):
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-[#182032] border border-neutral-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectingId(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer shadow-lg shadow-rose-600/30"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
