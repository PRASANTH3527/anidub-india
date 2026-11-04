import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageSquare, 
  Radio, 
  RefreshCw, 
  Sparkles, 
  Send, 
  Dices,
  Flame,
  CheckCircle2,
  AlertCircle,
  Star,
  ShieldCheck,
  Volume2,
  Hash,
  ArrowDown,
  Smile
} from 'lucide-react';
import { CLOUDFLARE_API_URL, getCloudflareUrl, getCloudflareWsUrl } from '../config/cloudflare';
import { cloudflareApi } from '../services/cloudflareApi';
import { generateRandomUsername, ANIME_CHARACTERS } from '../utils/randomUser';
import { formatRelativeTime } from '../utils/timestamps';
import { useUser } from '@clerk/clerk-react';

export interface ChatMessage {
  id: string | number;
  user: string;
  text: string;
  timestamp: string;
  isSelf?: boolean;
  isReview?: boolean;
  rating?: number | null;
  language?: string | null;
}

const QUICK_REACTIONS = ['🔥', '❤️', '⚡', '🍿', '😭', '✨', '💯', '🎌'];

// Distinct, recognizable username colors (Twitch & Discord style)
const USER_COLORS = [
  'text-purple-400',
  'text-sky-400',
  'text-pink-400',
  'text-amber-400',
  'text-emerald-400',
  'text-rose-400',
  'text-indigo-400',
  'text-teal-400',
  'text-orange-400',
  'text-cyan-400',
  'text-violet-400',
  'text-yellow-400'
];

const getUsernameColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
};

const AVATAR_GRADIENTS = [
  'from-purple-600 to-indigo-600',
  'from-blue-600 to-cyan-600',
  'from-emerald-600 to-teal-600',
  'from-rose-600 to-pink-600',
  'from-amber-600 to-orange-600',
  'from-violet-600 to-fuchsia-600'
];

const getAvatarGradient = (name: string, isReview?: boolean): string => {
  if (isReview) return 'from-amber-500 to-orange-600';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

export interface LiveChatProps {
  className?: string;
  defaultAnimeTitle?: string;
}

export const LiveChat: React.FC<LiveChatProps> = ({ className, defaultAnimeTitle }) => {
  const { user, isSignedIn } = useUser();
  // 1. Initial State loaded from LocalStorage
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('cf_community_chat');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return [];
  });

  const getClerkSuffix = (userId?: string): string => {
    const uid = userId || localStorage.getItem('anidub_device_fp') || 'guest_' + Math.random();
    if (!localStorage.getItem('anidub_device_fp') && !userId) {
      localStorage.setItem('anidub_device_fp', uid);
    }
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = ((hash << 5) - hash) + uid.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(36);
    return (hex + uid).replace(/[^a-z0-9]/gi, '').substring(0, 4).toLowerCase();
  };

  const [inputMessage, setInputMessage] = useState('');
  const [guestName, setGuestName] = useState(() => {
    try {
      const saved = localStorage.getItem('anidub_guest_chat_name');
      const suffix = getClerkSuffix(user?.id);
      if (saved && saved.includes('_')) {
        const parts = saved.split('_');
        const char = parts[0] || ANIME_CHARACTERS[Math.floor(Math.random() * ANIME_CHARACTERS.length)];
        return `${char}_${suffix}`;
      }
      const char = ANIME_CHARACTERS[Math.floor(Math.random() * ANIME_CHARACTERS.length)];
      return `${char}_${suffix}`;
    } catch {
      return `AnimeFan_${getClerkSuffix(user?.id)}`;
    }
  });

  useEffect(() => {
    if (user?.id) {
      const suffix = getClerkSuffix(user.id);
      setGuestName(prev => {
        const parts = prev.split('_');
        const char = parts[0] || 'AnimeFan';
        const updated = `${char}_${suffix}`;
        localStorage.setItem('anidub_guest_chat_name', updated);
        return updated;
      });
    }
  }, [user?.id]);

  const currentUserName = guestName;
  const [autoScroll, setAutoScroll] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  // Review Mode toggling
  const [mode, setMode] = useState<'chat' | 'review'>('chat');
  const [reviewRating, setReviewRating] = useState<number>(9.0);
  const [reviewLang, setReviewLang] = useState<string>('Tamil Dub');

  const wsRef = useRef<WebSocket | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const isInitialMountRef = useRef(true);
  const reconnectTimerRef = useRef<any>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    if (!autoScroll || !chatContainerRef.current) return;

    // Apply auto-scroll-to-bottom STRICTLY to the inner scrollable chat container,
    // ensuring the main window and outer page layout never shift or jump.
    const container = chatContainerRef.current;
    if (smooth) {
      try {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      } catch {
        container.scrollTop = container.scrollHeight;
      }
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }, [autoScroll]);

  // Auto-scroll on message updates (instant on first mount, smooth on subsequent incoming messages)
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      scrollToBottom(false);
    } else {
      scrollToBottom(true);
    }
  }, [messages, scrollToBottom]);

  // Scroll to bottom when user re-enables autoScroll toggle
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom(true);
    }
  }, [autoScroll, scrollToBottom]);

  // Helper: Deduplicate and merge message lists cleanly
  const mergeMessageLists = useCallback((existing: ChatMessage[], incoming: any[]): ChatMessage[] => {
    const seen = new Set<string>();
    const result: ChatMessage[] = [];

    const normalize = (msg: any): ChatMessage => ({
      id: msg.id || `msg_${msg.user}_${msg.timestamp}_${msg.text?.slice(0, 10)}`,
      user: msg.user || 'Anonymous Fan',
      text: msg.text || msg.comment || '',
      timestamp: msg.timestamp || 'Just now',
      isSelf: msg.user === currentUserName || Boolean(msg.isSelf),
      isReview: Boolean(msg.isReview || msg.rating),
      rating: msg.rating !== undefined ? Number(msg.rating) : null,
      language: msg.language || null
    });

    // Merge in chronological order
    const all = [...existing, ...incoming].map(normalize);
    for (const item of all) {
      const key = `${item.id}-${item.user}-${item.text?.trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }

    return result.slice(-150); // Keep last 150 messages
  }, [currentUserName]);

  // 2. Fetch existing chat & review history from Backend / D1 Database
  const fetchChatHistory = useCallback(async () => {
    setIsSyncing(true);
    try {
      const data = await cloudflareApi.fetchChatHistory();
      if (Array.isArray(data) && data.length > 0) {
        setMessages(prev => {
          const merged = mergeMessageLists(prev, data);
          try {
            localStorage.setItem('cf_community_chat', JSON.stringify(merged));
          } catch {}
          return merged;
        });
        setSyncStatus('History loaded');
      }
    } catch (err) {
      console.warn('Could not fetch backend chat history, using local cache:', err);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 2500);
    }
  }, [mergeMessageLists]);

  // Load backend history on mount
  useEffect(() => {
    fetchChatHistory();
  }, [fetchChatHistory]);

  // Sync across tabs via window storage event
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cf_community_chat' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setMessages(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 3. WebSocket Connection & Auto-Reconnect Logic
  useEffect(() => {
    let isSubscribed = true;

    const connectWebSocket = () => {
      if (!isSubscribed) return;

      try {
        setConnectionStatus('connecting');
        const wsUrl = getCloudflareWsUrl('/ws');

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isSubscribed) return;
          setConnectionStatus('connected');
          setReconnectAttempts(0);
        };

        ws.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const data = JSON.parse(event.data);
            
            // Handle array of history messages sent on connection
            if (Array.isArray(data)) {
              setMessages(prev => {
                const merged = mergeMessageLists(prev, data);
                try {
                  localStorage.setItem('cf_community_chat', JSON.stringify(merged));
                } catch {}
                return merged;
              });
              return;
            }

            // Handle { messages: [...] } or { history: [...] }
            if (data && (Array.isArray(data.messages) || Array.isArray(data.history))) {
              const list = data.messages || data.history;
              setMessages(prev => {
                const merged = mergeMessageLists(prev, list);
                try {
                  localStorage.setItem('cf_community_chat', JSON.stringify(merged));
                } catch {}
                return merged;
              });
              return;
            }

            // Handle single message or review
            if (data && (data.text || data.comment)) {
              const incomingMsg: ChatMessage = {
                id: data.id || `msg_${Date.now()}_${Math.random()}`,
                user: data.user || 'Anonymous Fan',
                text: data.text || data.comment,
                timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isSelf: data.user === currentUserName,
                isReview: Boolean(data.isReview || data.rating),
                rating: data.rating !== undefined ? Number(data.rating) : null,
                language: data.language || null
              };

              setMessages(prev => {
                const merged = mergeMessageLists(prev, [incomingMsg]);
                try {
                  localStorage.setItem('cf_community_chat', JSON.stringify(merged));
                } catch {}
                return merged;
              });
            }
          } catch (e) {
            console.error('Failed to parse incoming WebSocket message:', e);
          }
        };

        ws.onerror = (err) => {
          console.warn('WebSocket connection note:', err);
        };

        ws.onclose = () => {
          if (!isSubscribed) return;
          setConnectionStatus('disconnected');
          // Auto-reconnect with backoff
          const delay = Math.min(10000, 1000 * Math.pow(1.5, reconnectAttempts));
          setReconnectAttempts(prev => prev + 1);
          reconnectTimerRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        };
      } catch {
        setConnectionStatus('disconnected');
      }
    };

    connectWebSocket();

    return () => {
      isSubscribed = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [reconnectAttempts, currentUserName, mergeMessageLists]);

  // 4. Send Message & Review: WebSocket + Direct REST Persistence
  const sendMessage = async (
    text: string, 
    extra: { isReview?: boolean; rating?: number | null; language?: string | null } = {}
  ): Promise<boolean> => {
    if (!text.trim()) return false;

    const payload: ChatMessage & { clerk_user_id?: string } = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user: currentUserName.trim() || 'AnimeFan_IN',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true,
      isReview: Boolean(extra.isReview),
      rating: extra.rating ?? null,
      language: extra.language ?? null,
      clerk_user_id: user?.id || localStorage.getItem('anidub_device_fp') || 'guest'
    };

    // 1) Persist to Backend D1 / SQLite Database via HTTP POST with impersonation validation
    try {
      const resp = await cloudflareApi.sendChatMessage(payload);
      if (!resp.success) {
        throw new Error(resp.error || 'Failed to post message');
      }

      // 2) Update local state & LocalStorage once verified by database
      setMessages(prev => {
        const merged = mergeMessageLists(prev, [payload]);
        try {
          localStorage.setItem('cf_community_chat', JSON.stringify(merged));
        } catch {}
        return merged;
      });

      // 3) Broadcast over WebSocket if open
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify(payload));
        } catch (err) {
          console.error('WebSocket send error:', err);
        }
      }

      setChatError(null);
      return true;
    } catch (err: any) {
      console.warn('Network persistence note:', err);
      const errMsg = err.message || '';
      if (errMsg.includes('already claimed') || errMsg.includes('claimed by another') || errMsg.includes('taken')) {
        setChatError('Name taken, please choose another or use Randomize');
      } else {
        setChatError(errMsg || 'Failed to post message');
      }
      setTimeout(() => setChatError(null), 8000);
      return false;
    }
  };

  const handleSendMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputMessage.trim();
    if (!trimmed) return;

    let success = false;
    if (mode === 'review') {
      success = await sendMessage(trimmed, {
        isReview: true,
        rating: reviewRating,
        language: reviewLang
      });
    } else {
      success = await sendMessage(trimmed);
    }

    if (success) {
      setInputMessage('');

      // Ensure user's new message is scrolled into view within the container
      if (chatContainerRef.current) {
        setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
              top: chatContainerRef.current.scrollHeight,
              behavior: 'smooth'
            });
          }
        }, 50);
      }
    }
  };

  const handleRandomizeName = () => {
    setChatError(null);
    const char = ANIME_CHARACTERS[Math.floor(Math.random() * ANIME_CHARACTERS.length)];
    const suffix = getClerkSuffix(user?.id);
    const chosen = `${char}_${suffix}`;
    setGuestName(chosen);
    localStorage.setItem('anidub_guest_chat_name', chosen);
  };

  const handleReactionClick = (emoji: string) => {
    setInputMessage(prev => prev ? `${prev} ${emoji}` : emoji);
  };

  const getInitials = (name: string) => {
    const clean = name.replace(/[^a-zA-Z]/g, '');
    return (clean.slice(0, 2) || 'AF').toUpperCase();
  };

  return (
    <div className={`bg-[#0c101c]/90 backdrop-blur-2xl border border-white/[0.08] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col font-sans text-white overflow-hidden transition-all ${className || ''}`}>
      
      {/* 1. CHANNEL HEADER BAR (Discord / Twitch Style) */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-white/[0.06] bg-black/25">
        {/* Left: Channel Info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <Hash className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-black text-white tracking-wide truncate">
              live-chat
            </span>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${connectionStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-[11px] text-neutral-400 font-medium hidden sm:inline shrink-0">
              · {messages.length} messages
            </span>
          </div>
        </div>

        {/* Right: Controls & Mode Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mode Switcher: Chat vs Dub Review */}
          <div className="flex items-center p-0.5 rounded-lg bg-white/[0.05] border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setMode('chat')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                mode === 'chat'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              💬 Chat
            </button>
            <button
              type="button"
              onClick={() => setMode('review')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                mode === 'review'
                  ? 'bg-gradient-to-r from-amber-500 to-pink-500 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Star className="w-3 h-3 fill-current" />
              <span>Review</span>
            </button>
          </div>

          {/* Auto-scroll Button */}
          <button
            type="button"
            onClick={() => {
              const next = !autoScroll;
              setAutoScroll(next);
              if (next) scrollToBottom(true);
            }}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              autoScroll 
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' 
                : 'bg-white/5 border-white/10 text-neutral-500 hover:text-neutral-300'
            }`}
            title={autoScroll ? 'Auto-scroll enabled (click to pause)' : 'Auto-scroll paused (click to resume)'}
            aria-label="Toggle auto-scroll"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          {/* Refresh / Sync Button */}
          <button
            type="button"
            onClick={fetchChatHistory}
            disabled={isSyncing}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            title="Refresh chat history"
            aria-label="Refresh chat history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-purple-400' : ''}`} />
          </button>

          {/* Connection Status Pill */}
          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
            connectionStatus === 'connected' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            <Radio className="w-3 h-3 animate-pulse" />
            <span className="capitalize">{connectionStatus}</span>
          </div>
        </div>
      </div>

      {/* Sync Status Toast */}
      {syncStatus && (
        <div className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border-b border-emerald-500/20 px-3.5 py-1 flex items-center gap-1.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span>{syncStatus} — connected and synchronized.</span>
        </div>
      )}

      {/* 2. CONTINUOUS STREAM MESSAGE FEED (Discord / Twitch Style) */}
      <div 
        ref={chatContainerRef}
        className="h-[390px] sm:h-[450px] md:h-[490px] overflow-y-auto overscroll-contain px-3 py-2 sm:px-4 sm:py-3 space-y-1 sm:space-y-1.5 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-2 text-neutral-400 p-6">
            <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-white">Welcome to Live Chat!</h4>
            <p className="text-[11px] max-w-xs text-neutral-400">Say hello or share your favorite regional dub reactions.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const userColor = getUsernameColor(msg.user);
            const avatarGrad = getAvatarGradient(msg.user, msg.isReview);

            return (
              <div 
                key={msg.id} 
                className="flex items-start gap-2.5 px-2 py-1 -mx-1.5 rounded-lg hover:bg-white/[0.03] transition-colors group"
              >
                {/* Compact Circular Avatar */}
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-[11px] font-black shrink-0 shadow-sm bg-gradient-to-tr ${avatarGrad} ring-1 ring-white/10 mt-0.5`}>
                  {getInitials(msg.user)}
                </div>

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  {/* Sender Header Line */}
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className={`text-xs font-bold ${userColor} hover:underline cursor-pointer tracking-tight`}>
                      {msg.user}
                    </span>

                    {msg.isSelf && (
                      <span className="text-[9px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-1 py-0.2 rounded">
                        YOU
                      </span>
                    )}

                    {msg.isReview && (
                      <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-amber-300" />
                        <span>{msg.rating ? `${msg.rating}/10` : 'Dub Review'}</span>
                      </span>
                    )}

                    {msg.language && (
                      <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                        {msg.language}
                      </span>
                    )}

                    <span className="text-[10px] text-neutral-500 font-mono ml-auto sm:ml-1 select-none">
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Message Body (Clean Text, No Bulky Boxes) */}
                  {msg.isReview ? (
                    <div className="mt-0.5 text-xs text-amber-100/90 leading-relaxed border-l-2 border-amber-500/60 pl-2.5 py-0.5 bg-amber-500/[0.04] rounded-r break-words">
                      {msg.text}
                    </div>
                  ) : (
                    <p className="mt-0.5 text-xs sm:text-[13px] text-neutral-200 leading-snug break-words select-text">
                      {msg.text}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. COMPACT CONTROLS & STREAMLINED PILL INPUT */}
      <div className="p-2.5 sm:p-3 border-t border-white/[0.06] bg-black/30 space-y-2">
        {/* Error Warning */}
        {chatError && (
          <div className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center justify-between gap-2 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate">{chatError}</span>
            </div>
            <button
              type="button"
              onClick={handleRandomizeName}
              className="px-2 py-0.5 rounded-md bg-rose-500/25 hover:bg-rose-500/35 text-white text-[10px] font-bold tracking-wide uppercase transition-all shrink-0 cursor-pointer"
            >
              🎲 Randomize
            </button>
          </div>
        )}

        {/* Compact Micro-Controls: User Name & Quick Emojis */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Left: Nickname & Dub Review Options */}
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-[11px] text-neutral-400 font-medium shrink-0">
              Posting as:
            </span>
            <div className="relative flex items-center">
              <input 
                type="text"
                value={guestName}
                onChange={(e) => {
                  setChatError(null);
                  setGuestName(e.target.value);
                  localStorage.setItem('anidub_guest_chat_name', e.target.value);
                }}
                className={`bg-white/[0.06] hover:bg-white/[0.1] border rounded-lg px-2 py-0.5 text-xs text-purple-300 focus:text-white font-semibold focus:outline-none w-28 sm:w-36 transition-colors ${
                  chatError ? 'border-rose-500/80 ring-1 ring-rose-500/50' : 'border-white/10 focus:border-purple-400'
                }`}
                placeholder="Nickname"
                title="Click to edit nickname"
              />
            </div>
            <button
              type="button"
              onClick={handleRandomizeName}
              className="p-1 rounded-md bg-white/[0.06] hover:bg-white/15 border border-white/10 text-amber-400 hover:text-amber-300 transition-transform active:scale-90 cursor-pointer"
              title="Randomize username"
              aria-label="Randomize username"
            >
              <Dices className="w-3.5 h-3.5" />
            </button>

            {/* If in Review Mode, show compact language & rating selects */}
            {mode === 'review' && (
              <div className="flex items-center gap-1 shrink-0 ml-1">
                <select
                  value={reviewLang}
                  onChange={(e) => setReviewLang(e.target.value)}
                  className="bg-black/60 border border-amber-500/30 rounded-lg px-2 py-0.5 text-[11px] text-amber-300 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="Tamil Dub">Tamil Dub</option>
                  <option value="Telugu Dub">Telugu Dub</option>
                  <option value="Hindi Dub">Hindi Dub</option>
                  <option value="Malayalam Dub">Malayalam Dub</option>
                  <option value="Kannada Dub">Kannada Dub</option>
                </select>

                <div className="flex items-center gap-0.5 bg-black/60 border border-amber-500/30 px-1.5 py-0.5 rounded-lg">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
                  <select
                    value={reviewRating}
                    onChange={(e) => setReviewRating(parseFloat(e.target.value))}
                    className="bg-transparent text-[11px] text-amber-400 font-bold focus:outline-none cursor-pointer"
                  >
                    {[10, 9.5, 9.0, 8.5, 8.0, 7.5, 7.0, 6.0, 5.0].map(r => (
                      <option key={`chat_rating_${r}`} value={r} className="bg-neutral-900 text-white">{r}/10</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Right: Quick React Emojis */}
          <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar shrink-0 ml-auto">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReactionClick(emoji)}
                className="px-1.5 py-0.5 rounded-md hover:bg-white/10 text-xs transition-transform active:scale-90 cursor-pointer shrink-0"
                title={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Streamlined Single Horizontal Pill Row Input */}
        <form onSubmit={handleSendMessageSubmit} className="relative">
          <div className={`relative flex items-center bg-[#131929] hover:bg-[#161d30] focus-within:bg-[#161d30] border rounded-full px-3 py-1 sm:px-4 sm:py-1.5 transition-all shadow-inner ${
            mode === 'review'
              ? 'border-amber-500/40 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-500/20'
              : 'border-white/10 focus-within:border-purple-500/60 focus-within:ring-2 focus-within:ring-purple-500/20'
          }`}>
            {/* Left Indicator Icon */}
            <div className="text-neutral-400 shrink-0 mr-2">
              {mode === 'review' ? (
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ) : (
                <Smile className="w-3.5 h-3.5 text-purple-400" />
              )}
            </div>

            {/* Input Field */}
            <input 
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                mode === 'review'
                  ? `Write your ${reviewLang} review & voice cast feedback...`
                  : defaultAnimeTitle 
                    ? `Chat live about ${defaultAnimeTitle}...`
                    : "Send a message..."
              }
              className="flex-1 bg-transparent text-xs sm:text-[13px] text-white placeholder-neutral-500 focus:outline-none min-w-0 py-1"
            />

            {/* Embedded Circular Send Button */}
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 cursor-pointer disabled:opacity-30 disabled:pointer-events-none shadow-md ${
                mode === 'review'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/30'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-600/30'
              }`}
              title={mode === 'review' ? 'Post Dub Review' : 'Send message'}
              aria-label={mode === 'review' ? 'Post Dub Review' : 'Send message'}
            >
              <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current ml-0.5" />
            </button>
          </div>
        </form>
      </div>

    </div>
  );
};
