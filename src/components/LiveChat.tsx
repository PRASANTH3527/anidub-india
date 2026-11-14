import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  MessageSquare, 
  RefreshCw, 
  Sparkles, 
  Send, 
  Dices,
  CheckCircle2,
  AlertCircle,
  Star,
  ShieldCheck,
  Hash,
  ArrowDown,
  Smile,
  X
} from 'lucide-react';
import { getCloudflareWsUrl } from '../config/cloudflare';
import { cloudflareApi } from '../services/cloudflareApi';
import { ANIME_CHARACTERS } from '../utils/randomUser';
import { syncAndDeduplicateChatMessages } from '../utils/chatDeduplication';
import { getVerifiedClerkUsername } from '../utils/chatIdentity';
import { useUser, useAuth, getClerkSessionToken } from '../lib/clerk';

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

// Refined, professional username color palette (Slack & Linear style)
const USER_COLORS = [
  'text-violet-300',
  'text-sky-300',
  'text-indigo-300',
  'text-teal-300',
  'text-emerald-300',
  'text-amber-300',
  'text-rose-300',
  'text-pink-300',
  'text-cyan-300',
  'text-purple-300',
  'text-fuchsia-300',
  'text-blue-300'
];

const getUsernameColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
};

// Premium muted avatar styling (Slack / Linear style subtle dark background + refined border)
const AVATAR_STYLES = [
  'bg-purple-950/70 border-purple-500/30 text-purple-200',
  'bg-indigo-950/70 border-indigo-500/30 text-indigo-200',
  'bg-sky-950/70 border-sky-500/30 text-sky-200',
  'bg-teal-950/70 border-teal-500/30 text-teal-200',
  'bg-emerald-950/70 border-emerald-500/30 text-emerald-200',
  'bg-amber-950/70 border-amber-500/30 text-amber-200',
  'bg-rose-950/70 border-rose-500/30 text-rose-200',
  'bg-fuchsia-950/70 border-fuchsia-500/30 text-fuchsia-200',
  'bg-slate-900/80 border-slate-600/30 text-slate-200'
];

const getAvatarStyle = (name: string, isReview?: boolean): string => {
  if (isReview) return 'bg-amber-950/70 border-amber-500/40 text-amber-300';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_STYLES[Math.abs(hash) % AVATAR_STYLES.length];
};

export interface LiveChatProps {
  className?: string;
  defaultAnimeTitle?: string;
}

export const LiveChat: React.FC<LiveChatProps> = ({ className, defaultAnimeTitle }) => {
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
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

  const verifiedClerkUsername = isSignedIn && user ? getVerifiedClerkUsername(user) : '';
  const currentUserName = verifiedClerkUsername || guestName;
  const [autoScroll, setAutoScroll] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const [mode, setMode] = useState<'chat' | 'review'>('chat');
  const [reviewRating, setReviewRating] = useState<number>(9.0);
  const [reviewLang, setReviewLang] = useState<string>('Tamil Dub');

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const isInitialMountRef = useRef(true);
  const reconnectTimerRef = useRef<any>(null);
  const pendingOptimisticRef = useRef<Map<string, ChatMessage>>(new Map());

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

  // Smart auto-scroll on message updates (instant on first mount; smooth if user is already near bottom)
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      scrollToBottom(false);
      return;
    }

    // SMART SCROLLING:
    // When new messages arrive (via polling or typing), automatically scroll to the bottom
    // ONLY if the user is already near the bottom of the chat. Don't forcefully scroll them down
    // if they are reading older messages.
    const container = chatContainerRef.current;
    if (!container || !autoScroll) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    // Consider user near the bottom if within 150px of bottom
    const isNearBottom = distanceFromBottom <= 150;

    if (isNearBottom) {
      scrollToBottom(true);
    }
  }, [messages, autoScroll, scrollToBottom]);

  // Scroll to bottom when user re-enables autoScroll toggle
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom(true);
    }
  }, [autoScroll, scrollToBottom]);

  // Helper: Deduplicate and merge message lists cleanly with database overwrite & temp message removal
  const mergeMessageLists = useCallback((existing: ChatMessage[], incoming: any[]): ChatMessage[] => {
    return syncAndDeduplicateChatMessages(existing, incoming, currentUserName);
  }, [currentUserName]);

  // 2. Fetch existing chat & review history from Backend / D1 Database
  // ABSOLUTE SOURCE OF TRUTH: completely replaces the state with database messages
  const fetchMessages = useCallback(async (options: { silent?: boolean } = { silent: false }) => {
    const isSilent = Boolean(options.silent);
    if (!isSilent) {
      setIsSyncing(true);
    }
    try {
      const data = await cloudflareApi.fetchChatHistory();
      if (Array.isArray(data)) {
        // Map database records into ChatMessage format using exact persistent ID
        const fetchedMessages: ChatMessage[] = data.map((item: any) => ({
          id: String(item.id ?? `${item.user}_${item.timestamp}`),
          user: String(item.user || 'Anonymous Fan'),
          text: String(item.text || item.comment || item.message || ''),
          timestamp: String(item.timestamp || 'Just now'),
          isSelf: Boolean(item.user === currentUserName || (user?.id && item.clerk_user_id === user.id)),
          isReview: Boolean(item.isReview || item.rating),
          rating: item.rating !== undefined && item.rating !== null ? Number(item.rating) : null,
          language: item.language || null
        }));

        // Deduplicate any repeated IDs in fetched batch
        const seenIds = new Set<string>();
        const uniqueFetched: ChatMessage[] = [];
        for (const msg of fetchedMessages) {
          const strId = String(msg.id);
          if (!seenIds.has(strId)) {
            seenIds.add(strId);
            uniqueFetched.push(msg);
          }
        }

        // Clean resolved in-flight items that are now confirmed in database
        uniqueFetched.forEach(m => {
          pendingOptimisticRef.current.delete(String(m.id));
        });

        // Retain any pending in-flight messages that have not yet landed in the database
        const inFlightPending: ChatMessage[] = [];
        pendingOptimisticRef.current.forEach((pendingMsg, pId) => {
          if (!seenIds.has(pId)) {
            inFlightPending.push(pendingMsg);
          }
        });

        // ABSOLUTE SOURCE OF TRUTH: completely replace the state
        const nextState = [...uniqueFetched, ...inFlightPending];
        setMessages(nextState);

        try {
          localStorage.setItem('cf_community_chat', JSON.stringify(nextState));
        } catch {}

        if (!isSilent) {
          setSyncStatus('History loaded');
        }
      }
    } catch (err) {
      if (!isSilent) {
        console.warn('Could not fetch backend chat history, using local cache:', err);
      }
    } finally {
      if (!isSilent) {
        setIsSyncing(false);
        setTimeout(() => setSyncStatus(null), 2500);
      }
    }
  }, [currentUserName, user?.id]);

  // Backward compatibility alias for manual refresh action
  const fetchChatHistory = useCallback(() => {
    return fetchMessages({ silent: false });
  }, [fetchMessages]);

  // Load backend history on mount
  useEffect(() => {
    fetchMessages({ silent: false });
  }, [fetchMessages]);

  const fetchMessagesRef = useRef(fetchMessages);
  fetchMessagesRef.current = fetchMessages;

  // PREVENT INTERVAL DUPLICATION: Ensure the useEffect handling the setInterval has a strict cleanup
  // function (return () => clearInterval(intervalId);) so React Strict Mode doesn't spawn multiple overlapping polling loops
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchMessagesRef.current({ silent: true });
    }, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

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

    const connectWebSocket = async () => {
      if (!isSubscribed) return;

      try {
        const token = isSignedIn
          ? ((await getToken()) || (await getClerkSessionToken()))
          : await getClerkSessionToken();
        if (!token) {
          // Unauthenticated visitors receive live messages via REST sync polling;
          // WebSocket upgrades strictly require a verified Clerk session.
          setConnectionStatus('connected');
          return;
        }

        setConnectionStatus('connecting');
        const baseWsUrl = getCloudflareWsUrl('/ws', token);
        const wsUrl = verifiedClerkUsername
          ? `${baseWsUrl}${baseWsUrl.includes('?') ? '&' : '?'}username=${encodeURIComponent(verifiedClerkUsername)}`
          : baseWsUrl;

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

            // Handle explicit WebSocket server rejection / error events (e.g. username mismatch or reserved name)
            if (data && (data.type === 'error' || (data.error && !data.text && !data.comment))) {
              const errorText = String(data.error || data.message || 'WebSocket message rejected by server.');
              setChatError(errorText);
              if (data.messageId !== undefined && data.messageId !== null) {
                const rejectedId = String(data.messageId);
                pendingOptimisticRef.current.delete(rejectedId);
                setMessages(prev => prev.filter(m => String(m.id) !== rejectedId));
              }
              setTimeout(() => setChatError(null), 8000);
              return;
            }

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
          if (isSubscribed) {
            setChatError('WebSocket connection error occurred while verifying chat session.');
            setTimeout(() => setChatError(null), 6000);
          }
        };

        ws.onclose = (event) => {
          if (!isSubscribed) return;
          setConnectionStatus('disconnected');
          if (event && event.code >= 4000 && event.reason) {
            setChatError(event.reason);
          }
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
  }, [reconnectAttempts, isSignedIn, getToken, currentUserName, verifiedClerkUsername, mergeMessageLists]);

  // 4. Send Message & Review: Client-side unique ID + Verified Clerk Username + Direct REST & WebSocket Persistence
  const sendMessage = async (
    text: string, 
    extra: { isReview?: boolean; rating?: number | null; language?: string | null } = {}
  ): Promise<boolean> => {
    if (!text.trim()) return false;

    if (!isSignedIn || !user) {
      setChatError('Please sign in with Clerk to send messages in Live Chat.');
      setTimeout(() => setChatError(null), 6000);
      return false;
    }

    const verifiedUsername = getVerifiedClerkUsername(user);
    if (!verifiedUsername) {
      setChatError('Unable to resolve verified Clerk username from your account profile.');
      return false;
    }

    // 1) CLIENT-SIDE UNIQUE ID: Generate a unique ID (crypto.randomUUID() or Date.now().toString())
    // Use this exact ID for both the optimistic UI update AND send it to the backend to be saved as the message ID.
    const clientUniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const payload: ChatMessage & { username: string } = {
      id: clientUniqueId,
      user: verifiedUsername,
      username: verifiedUsername,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true,
      isReview: Boolean(extra.isReview),
      rating: extra.rating ?? null,
      language: extra.language ?? null
    };

    // Track as in-flight pending
    pendingOptimisticRef.current.set(clientUniqueId, payload);

    // 2) OPTIMISTIC UI: Instantly add the message with exact clientUniqueId so user sees it without delay
    setMessages(prev => {
      if (prev.some(m => String(m.id) === clientUniqueId)) return prev;
      const updated = [...prev, payload];
      try {
        localStorage.setItem('cf_community_chat', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 3) Persist to Backend D1 / SQLite Database with verified Clerk username
    try {
      const token = (await getToken().catch(() => null)) || (await getClerkSessionToken());
      const resp = await cloudflareApi.sendChatMessage(payload, token);
      if (!resp.success) {
        throw new Error(resp.error || 'Failed to post message');
      }

      // Mark message as confirmed/resolved from in-flight
      pendingOptimisticRef.current.delete(clientUniqueId);

      // 4) Broadcast verified message over WebSocket if open
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          const wsPayload = {
            ...(resp.message || payload),
            user: verifiedUsername,
            username: verifiedUsername,
          };
          wsRef.current.send(JSON.stringify(wsPayload));
        } catch (err) {
          console.error('WebSocket send error:', err);
        }
      }

      setChatError(null);
      return true;
    } catch (err: any) {
      // Rollback the optimistic message on error so user knows it wasn't saved
      pendingOptimisticRef.current.delete(clientUniqueId);
      setMessages(prev => prev.filter(m => String(m.id) !== clientUniqueId));

      console.warn('Network persistence note:', err);
      const errMsg = err.message || '';
      setChatError(errMsg || 'Failed to post message');
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
    setShowEmojiPicker(false);
  };

  const getInitials = (name: string) => {
    const clean = name.replace(/[^a-zA-Z]/g, '');
    return (clean.slice(0, 2) || 'AF').toUpperCase();
  };

  return (
    <div className={`bg-[#0a0e1a]/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col font-sans text-white overflow-hidden transition-all ${className || ''}`}>
      
      {/* 1. CHANNEL HEADER BAR (Slack / Linear Style) */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5 border-b border-white/[0.06] bg-black/20">
        {/* Left: Channel Info & User Identity */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <Hash className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs sm:text-[13px] font-semibold text-neutral-200 tracking-tight">
              live-chat
            </span>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${connectionStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-amber-400'}`} />
            
            {/* Identity chip: Verified Clerk badge when signed in; editable guest name otherwise */}
            {isSignedIn && user ? (
              <div
                className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-md px-2 py-0.5 font-medium"
                title="Verified Clerk Identity"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate max-w-[140px]">@{currentUserName}</span>
              </div>
            ) : (
              <div className="relative hidden sm:inline-block">
                <button
                  type="button"
                  onClick={handleRandomizeName}
                  className="text-[11px] text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-md px-1.5 py-0.5 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Sign in with Clerk to post (click to cycle guest tag)"
                >
                  <span className="truncate max-w-[100px] text-purple-300 font-medium">@{guestName}</span>
                  <Dices className="w-2.5 h-2.5 text-neutral-400 hover:text-amber-300 shrink-0" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Controls & Mode Switcher */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mode Switcher: Chat vs Dub Review */}
          <div className="flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs">
            <button
              type="button"
              onClick={() => setMode('chat')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                mode === 'chat'
                  ? 'bg-purple-600/80 text-white shadow-xs font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setMode('review')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                mode === 'review'
                  ? 'bg-amber-500/80 text-white shadow-xs font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Star className="w-2.5 h-2.5 fill-current" />
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
            className={`p-1.5 rounded-md border transition-all cursor-pointer ${
              autoScroll 
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' 
                : 'bg-white/[0.03] border-white/[0.08] text-neutral-500 hover:text-neutral-300'
            }`}
            title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll paused'}
            aria-label="Toggle auto-scroll"
          >
            <ArrowDown className="w-3 h-3" />
          </button>

          {/* Refresh / Sync Button */}
          <button
            type="button"
            onClick={fetchChatHistory}
            disabled={isSyncing}
            className="p-1.5 rounded-md bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-neutral-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            title="Refresh chat history"
            aria-label="Refresh chat history"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sync Status Toast */}
      {syncStatus && (
        <div className="text-[10px] font-medium text-emerald-400/90 bg-emerald-500/10 border-b border-emerald-500/15 px-3 py-1 flex items-center gap-1.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span>{syncStatus} — connected and synchronized.</span>
        </div>
      )}

      {/* 2. CONTINUOUS STREAM MESSAGE FEED (Tight Slack / Linear Style) */}
      <div 
        ref={chatContainerRef}
        className="h-[390px] sm:h-[450px] md:h-[490px] overflow-y-auto overscroll-contain px-3 py-2 sm:px-4 sm:py-2.5 space-y-1 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-2 text-neutral-400 p-6">
            <div className="w-9 h-9 rounded-xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-semibold text-neutral-200">Welcome to Live Chat!</h4>
            <p className="text-[11px] max-w-xs text-neutral-400">Say hello or share your thoughts on regional anime dubs.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const userColor = getUsernameColor(msg.user);
            const avatarStyle = getAvatarStyle(msg.user, msg.isReview);

            return (
              <motion.div 
                key={msg.id} 
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-start gap-2.5 px-2 py-1 -mx-1.5 rounded-lg hover:bg-white/[0.025] transition-colors group"
              >
                {/* Refined Smaller Avatar with Subtle Border */}
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center text-[10px] sm:text-[11px] font-bold shrink-0 border shadow-xs ${avatarStyle} mt-0.5`}>
                  {getInitials(msg.user)}
                </div>

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  {/* Sender Header Line (tight vertical spacing, subtle faded timestamp) */}
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className={`text-[12px] sm:text-[13px] font-semibold ${userColor} hover:underline cursor-pointer tracking-tight`}>
                      {msg.user}
                    </span>

                    {msg.isSelf && (
                      <span className="text-[8px] font-bold text-purple-300/90 bg-purple-500/10 border border-purple-500/20 px-1 py-0.2 rounded">
                        you
                      </span>
                    )}

                    {msg.isReview && (
                      <span className="text-[9px] font-medium text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5">
                        <Star className="w-2 h-2 fill-amber-300" />
                        <span>{msg.rating ? `${msg.rating}/10` : 'Dub Review'}</span>
                      </span>
                    )}

                    {msg.language && (
                      <span className="text-[9px] font-medium text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                        {msg.language}
                      </span>
                    )}

                    <span className="text-[10px] text-neutral-500/70 font-mono ml-auto sm:ml-1 select-none">
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Message Body (Tight Slack / Linear Typography) */}
                  {msg.isReview ? (
                    <div className="mt-0.5 text-xs text-amber-100/90 leading-relaxed border-l-2 border-amber-500/50 pl-2 py-0.5 bg-amber-500/[0.03] rounded-r break-words">
                      {msg.text}
                    </div>
                  ) : (
                    <p className="mt-0.5 text-xs sm:text-[13px] text-neutral-200/95 leading-snug break-words select-text font-normal">
                      {msg.text}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* 3. INPUT AREA POLISH (Streamlined, zero clutter, embedded emoji & send) */}
      <div className="p-2.5 sm:p-3 border-t border-white/[0.06] bg-black/20 space-y-2 relative">
        
        {/* Error Warning (e.g., WebSocket / identity verification error) */}
        {chatError && (
          <div className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center justify-between gap-2 shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="break-words">{chatError}</span>
            </div>
            <button
              type="button"
              onClick={() => setChatError(null)}
              className="p-1 rounded-md text-rose-300 hover:text-white hover:bg-rose-500/20 transition-all shrink-0 cursor-pointer"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* If in Review Mode, show sleek mini filters for language & rating */}
        {mode === 'review' && (
          <div className="flex items-center gap-2 px-1 text-xs text-amber-300/90">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Reviewing:</span>
            <select
              value={reviewLang}
              onChange={(e) => setReviewLang(e.target.value)}
              className="bg-black/50 border border-amber-500/30 rounded-md px-2 py-0.5 text-[11px] text-amber-300 font-medium focus:outline-none cursor-pointer"
            >
              <option value="Tamil Dub">Tamil Dub</option>
              <option value="Telugu Dub">Telugu Dub</option>
              <option value="Hindi Dub">Hindi Dub</option>
              <option value="Malayalam Dub">Malayalam Dub</option>
              <option value="Kannada Dub">Kannada Dub</option>
            </select>

            <div className="flex items-center gap-0.5 bg-black/50 border border-amber-500/30 px-1.5 py-0.5 rounded-md">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(parseFloat(e.target.value))}
                className="bg-transparent text-[11px] text-amber-400 font-semibold focus:outline-none cursor-pointer"
              >
                {[10, 9.5, 9.0, 8.5, 8.0, 7.5, 7.0, 6.0, 5.0].map(r => (
                  <option key={`chat_rating_${r}`} value={r} className="bg-neutral-900 text-white">{r}/10</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Floating Emoji Picker Popover */}
        {showEmojiPicker && (
          <div 
            ref={emojiPickerRef}
            className="absolute bottom-full mb-2 left-3 sm:left-4 bg-[#101424] border border-white/10 rounded-xl shadow-2xl p-1.5 flex items-center gap-1 z-50 animate-in fade-in zoom-in-95 duration-150"
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReactionClick(emoji)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-sm transition-all duration-150 hover:scale-125 active:scale-75 cursor-pointer"
                title={`Add ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Active Username Indicator directly above Chat Input Box */}
        <div className="text-xs text-gray-400 mb-1 flex items-center justify-between px-1 select-none">
          <div className="flex items-center gap-1.5">
            <span>{isSignedIn && user ? '🛡️ Verified Clerk Identity:' : '👤 Visitor Mode:'}</span>
            <strong className="text-white font-semibold tracking-wide">
              {currentUserName}
            </strong>
          </div>
          {!isSignedIn && (
            <span className="text-[11px] text-amber-300/90">
              Sign in with Clerk to post
            </span>
          )}
        </div>

        {/* Sleek, Single Pill Input with Integrated Smiley and Send Button */}
        <form onSubmit={handleSendMessageSubmit} className="relative">
          <div className={`relative flex items-center bg-white/[0.04] hover:bg-white/[0.06] focus-within:bg-[#111624] border rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 transition-all shadow-inner ${
            mode === 'review'
              ? 'border-amber-500/30 focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-500/20'
              : 'border-white/10 focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/20'
          }`}>
            
            {/* Embedded Smiley Emoji Picker Toggle Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(prev => !prev)}
              className={`p-1.5 rounded-full hover:bg-white/10 transition-all duration-200 hover:scale-110 active:scale-90 cursor-pointer shrink-0 mr-1 ${
                showEmojiPicker ? 'text-amber-300 bg-white/10' : 'text-neutral-400 hover:text-white'
              }`}
              title="Add reaction emoji"
              aria-label="Add reaction emoji"
            >
              <Smile className="w-4 h-4" />
            </button>

            {/* Seamless Text Input with Dynamic 'Posting as...' in Placeholder */}
            <input 
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                !isSignedIn
                  ? 'Sign in with Clerk to post in Live Chat...'
                  : mode === 'review'
                  ? `Review as ${currentUserName} (${reviewLang})...`
                  : defaultAnimeTitle 
                    ? `Message as ${currentUserName} about ${defaultAnimeTitle}...`
                    : `Message as ${currentUserName}...`
              }
              className="flex-1 bg-transparent text-xs sm:text-[13px] text-white placeholder-neutral-500 focus:outline-none min-w-0 py-1"
            />

            {/* Embedded Circular Send Button */}
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 hover:scale-105 active:scale-90 cursor-pointer disabled:opacity-20 disabled:pointer-events-none shadow-sm ${
                mode === 'review'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/20'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-600/20'
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
