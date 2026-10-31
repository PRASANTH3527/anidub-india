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
  Volume2
} from 'lucide-react';
import { CLOUDFLARE_API_URL, getCloudflareUrl } from '../config/cloudflare';
import { generateRandomUsername } from '../utils/randomUser';
import { formatRelativeTime } from '../utils/timestamps';

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

const ANIME_CHARACTERS = [
  'Tanjiro', 'Nezuko', 'Zenitsu', 'Inosuke', 'Giyu', 'Rengoku', 'Tengen', 'Muzan', 'Akaza', 'Shinobu',
  'Goku', 'Vegeta', 'Gohan', 'Piccolo', 'Trunks', 'Frieza', 'Beerus', 'Bulma', 'Krillin', 'Broly',
  'Luffy', 'Zoro', 'Sanji', 'Nami', 'Robin', 'Chopper', 'Franky', 'Brook', 'Jinbe', 'Shanks',
  'Naruto', 'Sasuke', 'Kakashi', 'Itachi', 'Madara', 'Minato', 'Hinata', 'Jiraiya', 'Gaara', 'Shikamaru',
  'Gojo', 'Sukuna', 'Yuji', 'Megumi', 'Nobara', 'Nanami', 'Toji', 'Geto', 'Maki', 'Inumaki',
  'Eren', 'Mikasa', 'Armin', 'Levi', 'Erwin', 'Hange', 'Reiner', 'Zeke', 'Jean', 'Sasha',
  'Denji', 'Makima', 'Power', 'Aki', 'Himeno', 'Kobeni', 'Kishibe', 'Quanxi', 'Reze', 'Kishibe',
  'Asta', 'Yuno', 'Noelle', 'Yami', 'Julius', 'Magna', 'Luck', 'Charmy', 'Finral', 'Gauche',
  'Bojji', 'Kage', 'Daida', 'Hiling', 'Domas', 'Bein', 'Ouken', 'Miranja', 'Desha', 'Seyn'
];

const INDIAN_REGIONS = [
  'Delhi', 'Chennai', 'Mumbai', 'Bengaluru', 'Kolkata', 'Hyderabad', 'Kerala', 'Pune',
  'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Patna', 'Varanasi', 'Chandigarh', 'Goa',
  'Surat', 'Indore', 'Bhopal', 'Visakhapatnam', 'Coimbatore', 'Madurai', 'Mysuru', 'Mangaluru',
  'Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Guwahati', 'Shillong', 'Imphal', 'Aizawl',
  'Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur',
  'Vadodara', 'Rajkot', 'Surat', 'Gandhinagar', 'Jodhpur', 'Udaipur', 'Ajmer', 'Kota',
  'Kanpur', 'Agra', 'Meerut', 'Prayagraj', 'Noida', 'Gurugram', 'Dehradun', 'Haridwar',
  'Srinagar', 'Jammu', 'Leh', 'Amritsar', 'Ludhiana', 'Jalandhar', 'Patiala'
];

export interface LiveChatProps {
  className?: string;
  defaultAnimeTitle?: string;
}

export const LiveChat: React.FC<LiveChatProps> = ({ className, defaultAnimeTitle }) => {
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
    return [
      {
        id: 'welcome_init',
        user: 'AniDub_Bot',
        text: 'Welcome to the Live Indian Anime Dub Community! Stream officially in Hindi, Tamil, Telugu, Malayalam & Kannada.',
        timestamp: 'Just now',
        isSelf: false
      }
    ];
  });

  const [inputMessage, setInputMessage] = useState('');
  const [guestName, setGuestName] = useState(() => {
    return generateRandomUsername();
  });
  const [autoScroll, setAutoScroll] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

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
      isSelf: msg.user === guestName || Boolean(msg.isSelf),
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
  }, [guestName]);

  // 2. Fetch existing chat & review history from Backend / D1 Database
  const fetchChatHistory = useCallback(async () => {
    setIsSyncing(true);
    try {
      // Try Cloudflare Worker / Express /api/chat endpoint
      const primaryUrl = getCloudflareUrl('/api/chat');
      let response: Response | null = null;

      try {
        response = await fetch(primaryUrl, {
          headers: { 'Accept': 'application/json' }
        });
      } catch {}

      if (!response || !response.ok) {
        response = await fetch('/api/chat', {
          headers: { 'Accept': 'application/json' }
        }).catch(() => null);
      }

      if (response && response.ok) {
        const data = await response.json();
        const incomingMessages = Array.isArray(data) 
          ? data 
          : (data.messages || data.data || []);

        if (Array.isArray(incomingMessages) && incomingMessages.length > 0) {
          setMessages(prev => {
            const merged = mergeMessageLists(prev, incomingMessages);
            try {
              localStorage.setItem('cf_community_chat', JSON.stringify(merged));
            } catch {}
            return merged;
          });
          setSyncStatus('History loaded');
        }
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
        const wsUrl = 'wss://anime-chat.samayaprasanth0.workers.dev/ws';

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
                isSelf: data.user === guestName,
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
  }, [reconnectAttempts, guestName, mergeMessageLists]);

  // 4. Send Message & Review: WebSocket + Direct REST Persistence
  const sendMessage = async (
    text: string, 
    extra: { isReview?: boolean; rating?: number | null; language?: string | null } = {}
  ) => {
    if (!text.trim()) return;

    const payload: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user: guestName.trim() || 'AnimeFan_IN',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true,
      isReview: Boolean(extra.isReview),
      rating: extra.rating ?? null,
      language: extra.language ?? null
    };

    // 1) Instantly update local state & LocalStorage
    setMessages(prev => {
      const merged = mergeMessageLists(prev, [payload]);
      try {
        localStorage.setItem('cf_community_chat', JSON.stringify(merged));
      } catch {}
      return merged;
    });

    // 2) Broadcast over WebSocket if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(payload));
      } catch (err) {
        console.error('WebSocket send error:', err);
      }
    }

    // 3) Persist to Backend D1 / SQLite Database via HTTP POST
    try {
      const chatApiUrl = getCloudflareUrl('/api/chat');
      let res = await fetch(chatApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => null);

      if (!res || !res.ok) {
        await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('Network persistence note:', err);
    }
  };

  const handleSendMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    if (mode === 'review') {
      sendMessage(inputMessage.trim(), {
        isReview: true,
        rating: reviewRating,
        language: reviewLang
      });
    } else {
      sendMessage(inputMessage.trim());
    }

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
  };

  const handleRandomizeName = () => {
    const chosen = generateRandomUsername();
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
    <div className={`bg-white/[0.05] backdrop-blur-3xl border border-white/10 rounded-3xl p-5 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-5 font-sans text-white ${className || ''}`}>
      
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`w-2.5 h-2.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-amber-400'}`} />
            <MessageSquare className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-black text-white tracking-wide">
              Live Community Chat & Reviews
            </h3>
          </div>
          <p className="text-xs text-neutral-300/80">
            Real-time chat with anime fans across India. All messages and dub reviews are synchronized instantly.
          </p>
        </div>

        {/* Right Connection & Sync Indicators */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-semibold ${
            connectionStatus === 'connected' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span className="capitalize">{connectionStatus}</span>
          </div>

          <button
            type="button"
            onClick={fetchChatHistory}
            disabled={isSyncing}
            title="Refresh & sync history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{syncStatus} — connected and synchronized.</span>
        </div>
      )}

      {/* Mode Switcher: Live Chat vs Dub Review */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode('chat')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            mode === 'chat'
              ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] border border-purple-400/40'
              : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10'
          }`}
        >
          💬 Live Chat
        </button>
        <button
          type="button"
          onClick={() => setMode('review')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            mode === 'review'
              ? 'bg-gradient-to-r from-amber-500 to-pink-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)] border border-amber-400/40'
              : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10'
          }`}
        >
          <Star className="w-3.5 h-3.5 fill-current" />
          <span>⭐ Post Dub Review</span>
        </button>
      </div>

      {/* 2. SCROLLABLE MESSAGE STREAM */}
      <div 
        ref={chatContainerRef}
        className="h-80 sm:h-96 overflow-y-auto overscroll-contain pr-2 space-y-4 rounded-2xl bg-black/40 border border-white/10 p-4 scrollbar-thin scrollbar-thumb-purple-600/50"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-2 text-neutral-400">
            <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">No messages yet</h4>
            <p className="text-xs max-w-xs">Be the first to spark a conversation or review in the live chat!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3.5 group animate-in fade-in duration-200">
              {/* Gradient Avatar */}
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-white text-xs font-black shrink-0 shadow-md ${
                msg.isReview 
                  ? 'bg-gradient-to-tr from-amber-500 via-orange-500 to-pink-500' 
                  : 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500'
              }`}>
                {getInitials(msg.user)}
              </div>

              {/* Message Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white tracking-wide">
                    {msg.user}
                  </span>
                  {msg.isSelf && (
                    <span className="bg-purple-950/80 text-purple-300 border border-purple-500/40 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                      You
                    </span>
                  )}
                  {msg.isReview && (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-amber-300" />
                      <span>{msg.rating ? `${msg.rating}/10` : 'Dub Review'}</span>
                    </span>
                  )}
                  {msg.language && (
                    <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                      {msg.language}
                    </span>
                  )}
                  <span className="text-[10px] text-neutral-400">
                    {msg.timestamp}
                  </span>
                </div>

                <div className={`mt-1.5 p-3.5 rounded-2xl text-xs leading-relaxed max-w-2xl break-words shadow-inner ${
                  msg.isReview
                    ? 'bg-gradient-to-r from-amber-950/30 to-purple-950/30 border border-amber-500/30 text-amber-100'
                    : 'bg-white/[0.04] border border-white/10 text-neutral-200'
                }`}>
                  {msg.text}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. CONTROLS & INPUT FORM */}
      <div className="space-y-3.5">
        {/* Auto-scroll toggle bar */}
        <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input 
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => {
                const checked = e.target.checked;
                setAutoScroll(checked);
                if (checked) {
                  scrollToBottom(true);
                }
              }}
              className="accent-purple-500 rounded cursor-pointer"
            />
            <span>Auto-scroll to latest messages</span>
          </label>
          <span className="text-[11px] text-purple-300/80 font-medium">
            {messages.length} messages
          </span>
        </div>

        {/* Quick Reactions Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-xs text-neutral-400 font-semibold shrink-0 mr-1">
            Quick React:
          </span>
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleReactionClick(emoji)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs transition-all cursor-pointer shrink-0 active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSendMessageSubmit} className="space-y-3">
          {/* Top row: Nickname & Dub Review Options */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-neutral-400 font-semibold whitespace-nowrap">
              Posting as:
            </span>
            <input 
              type="text"
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                localStorage.setItem('anidub_guest_chat_name', e.target.value);
              }}
              className="bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-400 w-36 sm:w-44 shadow-inner"
              placeholder="Your nickname"
            />
            <button
              type="button"
              onClick={handleRandomizeName}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-neutral-200 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
              title="Generate random anime fan nickname"
            >
              <Dices className="w-3.5 h-3.5 text-amber-400" />
              <span>Randomize</span>
            </button>

            {/* If in Review Mode, show language dropdown & rating selector */}
            {mode === 'review' && (
              <div className="flex items-center gap-2 flex-wrap ml-auto">
                <select
                  value={reviewLang}
                  onChange={(e) => setReviewLang(e.target.value)}
                  className="bg-black/60 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-300 focus:outline-none"
                >
                  <option value="Tamil Dub">Tamil Dub</option>
                  <option value="Telugu Dub">Telugu Dub</option>
                  <option value="Hindi Dub">Hindi Dub</option>
                  <option value="Malayalam Dub">Malayalam Dub</option>
                  <option value="Kannada Dub">Kannada Dub</option>
                </select>

                <div className="flex items-center gap-1 bg-black/60 border border-amber-500/40 px-3 py-2 rounded-xl">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <select
                    value={reviewRating}
                    onChange={(e) => setReviewRating(parseFloat(e.target.value))}
                    className="bg-transparent text-xs text-amber-400 font-bold focus:outline-none cursor-pointer"
                  >
                    {[10, 9.5, 9.0, 8.5, 8.0, 7.5, 7.0, 6.0, 5.0].map(r => (
                      <option key={r} value={r} className="bg-neutral-900 text-white">{r}/10</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Message Input & Glowing Send Button */}
          <div className="flex gap-2.5">
            <input 
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                mode === 'review'
                  ? `Write your ${reviewLang} review & voice acting feedback...`
                  : defaultAnimeTitle 
                    ? `Chat live about ${defaultAnimeTitle}...`
                    : "Send a live message to the community..."
              }
              className="flex-1 bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-400 shadow-inner"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className={`text-white px-6 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 active:scale-95 ${
                mode === 'review'
                  ? 'bg-gradient-to-r from-amber-500 to-pink-600 hover:from-amber-400 hover:to-pink-500 shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]'
              }`}
            >
              <Send className="w-4 h-4 fill-white" />
              <span>{mode === 'review' ? 'Post Review' : 'Send'}</span>
            </button>
          </div>
        </form>
      </div>

    </div>
  );
};
