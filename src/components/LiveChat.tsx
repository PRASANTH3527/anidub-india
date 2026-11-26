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
  X,
  Eye,
  EyeOff,
  Ban,
  Flag,
  MoreHorizontal,
  Reply,
  RotateCcw,
  Check
} from 'lucide-react';
import { getCloudflareWsUrl } from '../config/cloudflare';
import { cloudflareApi } from '../services/cloudflareApi';
import { ANIME_CHARACTERS } from '../utils/randomUser';
import { syncAndDeduplicateChatMessages } from '../utils/chatDeduplication';
import { getVerifiedClerkUsername } from '../utils/chatIdentity';
import { useAuth } from '@clerk/clerk-react';
import { useUser } from '../lib/clerk';
import { EmptyState } from './ui/EclipseState';
import {
  blockChatUser,
  unblockChatUser,
  getBlockedChatUsers,
  filterVisibleChatMessages,
  formatSpoilerChatMessage,
  stripSpoilerMarker,
  isChatMessageSpoiler,
} from '../utils/chatModeration';
import {
  getSpoilerProtectionEnabled,
  setSpoilerProtectionEnabled,
  SPOILER_PROTECTION_EVENT,
} from '../utils/watchProgress';

export interface ChatReplyPreview {
  user: string;
  excerpt: string;
}

export interface ChatMessage {
  id: string | number;
  user: string;
  text: string;
  timestamp: string;
  isSelf?: boolean;
  isReview?: boolean;
  rating?: number | null;
  language?: string | null;
  deliveryStatus?: 'sending' | 'sent' | 'failed';
  replyTo?: ChatReplyPreview | null;
}

const REPLY_PREFIX_REGEX = /^\[reply:@([^|\]]+)\|([^\]]*)\]\s*/;

const encodeReplyText = (text: string, replyTo?: ChatReplyPreview | null): string => {
  if (!replyTo) return text;
  const safeUser = replyTo.user.replace(/[|\]]/g, '').trim().slice(0, 32);
  const safeExcerpt = replyTo.excerpt.replace(/[\r\n|\]]/g, ' ').trim().slice(0, 80);
  return `[reply:@${safeUser}|${safeExcerpt}] ${text}`;
};

const parseReplyFromText = (rawText: string): { replyTo: ChatReplyPreview | null; body: string } => {
  const match = rawText.match(REPLY_PREFIX_REGEX);
  if (!match) return { replyTo: null, body: rawText };
  return {
    replyTo: { user: match[1], excerpt: match[2] },
    body: rawText.slice(match[0].length),
  };
};

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

  // Moderation & Spoiler Protection states
  const [spoilerProtection, setSpoilerProtection] = useState<boolean>(() =>
    getSpoilerProtectionEnabled()
  );
  const [isSpoilerDraft, setIsSpoilerDraft] = useState(false);
  const [revealedMessageIds, setRevealedMessageIds] = useState<Record<string, boolean>>({});
  const [blockedUsers, setBlockedUsers] = useState<string[]>(() => getBlockedChatUsers());
  const [showBlockedManager, setShowBlockedManager] = useState(false);
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);
  const [reportingMessage, setReportingMessage] = useState<ChatMessage | null>(null);
  const [reportIssueType, setReportIssueType] = useState('Harassment or Abuse');
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [moderationToast, setModerationToast] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatReplyPreview | null>(null);
  const failedMessagesRef = useRef<Map<string, ChatMessage>>(new Map());

  useEffect(() => {
    const syncSpoilerPref = () => {
      const enabled = getSpoilerProtectionEnabled();
      setSpoilerProtection(enabled);
      if (enabled) {
        setRevealedMessageIds({});
      }
    };
    window.addEventListener(SPOILER_PROTECTION_EVENT, syncSpoilerPref);
    return () => window.removeEventListener(SPOILER_PROTECTION_EVENT, syncSpoilerPref);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('[data-chat-mod-menu]')) {
        setOpenMenuMessageId(null);
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

        // Retain any pending in-flight or failed local messages so user never silently loses unsent text
        const inFlightPending: ChatMessage[] = [];
        pendingOptimisticRef.current.forEach((pendingMsg, pId) => {
          if (!seenIds.has(pId)) {
            inFlightPending.push(pendingMsg);
          }
        });
        failedMessagesRef.current.forEach((failedMsg, fId) => {
          if (!seenIds.has(fId) && !pendingOptimisticRef.current.has(fId)) {
            inFlightPending.push(failedMsg);
          }
        });

        // ABSOLUTE SOURCE OF TRUTH: completely replace the state
        const nextState = [...uniqueFetched, ...inFlightPending];
        setMessages(nextState);

        try {
          localStorage.setItem(
            'cf_community_chat',
            JSON.stringify(nextState.filter((m) => m.deliveryStatus !== 'failed'))
          );
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

  const reconnectAttemptsRef = useRef(0);

  // 3. WebSocket Connection & Auto-Reconnect Logic
  useEffect(() => {
    let isSubscribed = true;

    const connectWebSocket = async () => {
      if (!isSubscribed) return;

      try {
        const token = isSignedIn ? await getToken() : null;
        if (!token) {
          // Unauthenticated visitors / guests receive live messages via REST polling;
          // they do not have an active WebSocket connection, so status remains disconnected/polling.
          setConnectionStatus('disconnected');
          return;
        }

        setConnectionStatus('connecting');
        const wsUrl = getCloudflareWsUrl('/ws');
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isSubscribed) return;
          ws.send(
            JSON.stringify({
              type: 'auth',
              token,
              ...(verifiedClerkUsername ? { username: verifiedClerkUsername } : {}),
            })
          );
          setConnectionStatus('connected');
          reconnectAttemptsRef.current = 0;
        };

        ws.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const data = JSON.parse(event.data);

            if (data && data.type === 'auth_ok') {
              setConnectionStatus('connected');
              return;
            }

            // Handle explicit WebSocket server rejection / error events (e.g. username mismatch, reserved name, rate limit)
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
          // Auto-reconnect with backoff using reconnectAttemptsRef
          const attempts = reconnectAttemptsRef.current;
          const delay = Math.min(10000, 1000 * Math.pow(1.5, attempts));
          reconnectAttemptsRef.current = attempts + 1;
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
  }, [isSignedIn, getToken, currentUserName, verifiedClerkUsername, mergeMessageLists]);

  // 4. Send Message & Review: Client-side unique ID + Verified Clerk Username + Direct REST & WebSocket Persistence
  const sendMessage = async (
    text: string,
    extra: {
      isReview?: boolean;
      rating?: number | null;
      language?: string | null;
      replyTo?: ChatReplyPreview | null;
      retryId?: string;
    } = {}
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

    const token = await getToken();
    if (!token) {
      console.error("No token!");
      setChatError('Unauthorized: Active Clerk session token unavailable. Please refresh or sign in again.');
      setTimeout(() => setChatError(null), 6000);
      return false;
    }

    // 1) CLIENT-SIDE UNIQUE ID: Generate or reuse retry ID
    const clientUniqueId = extra.retryId || (
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    );

    const payload: ChatMessage & { username: string } = {
      id: clientUniqueId,
      user: verifiedUsername,
      username: verifiedUsername,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true,
      isReview: Boolean(extra.isReview),
      rating: extra.rating ?? null,
      language: extra.language ?? null,
      deliveryStatus: 'sending',
      replyTo: extra.replyTo ?? null,
    };

    // Track as in-flight pending
    failedMessagesRef.current.delete(clientUniqueId);
    pendingOptimisticRef.current.set(clientUniqueId, payload);

    // 2) OPTIMISTIC UI: Instantly show message with Sending… status
    setMessages(prev => {
      const exists = prev.some(m => String(m.id) === clientUniqueId);
      const updated = exists
        ? prev.map(m => (String(m.id) === clientUniqueId ? payload : m))
        : [...prev, payload];
      try {
        localStorage.setItem('cf_community_chat', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 3) Persist to Backend D1 / SQLite Database with verified Clerk username and explicit JWT token
    try {
      const outboundPayload = {
        ...payload,
        type: 'message',
        token,
      };
      const resp = await cloudflareApi.sendChatMessage(outboundPayload, token);
      if (!resp.success) {
        throw new Error(resp.error || 'Failed to post message');
      }

      // Mark message as confirmed/sent
      pendingOptimisticRef.current.delete(clientUniqueId);
      failedMessagesRef.current.delete(clientUniqueId);
      setMessages(prev =>
        prev.map(m =>
          String(m.id) === clientUniqueId ? { ...m, deliveryStatus: 'sent' } : m
        )
      );

      // 4) Broadcast verified message over WebSocket if open
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          const wsPayload = {
            ...(resp.message || payload),
            type: 'message',
            user: verifiedUsername,
            username: verifiedUsername,
            token,
          };
          wsRef.current.send(JSON.stringify(wsPayload));
        } catch (err) {
          console.error('WebSocket send error:', err);
        }
      }

      setChatError(null);
      return true;
    } catch (err: any) {
      // Keep the failed message visible with explicit Failed — Retry state
      pendingOptimisticRef.current.delete(clientUniqueId);
      const failedMessage: ChatMessage = { ...payload, deliveryStatus: 'failed' };
      failedMessagesRef.current.set(clientUniqueId, failedMessage);
      setMessages(prev =>
        prev.map(m =>
          String(m.id) === clientUniqueId ? failedMessage : m
        )
      );

      console.warn('Network persistence note:', err);
      const errMsg = err.message || '';
      setChatError(errMsg || 'Message failed to deliver — tap Retry on your message.');
      setTimeout(() => setChatError(null), 8000);
      return false;
    }
  };

  const handleRetryFailedMessage = async (msg: ChatMessage) => {
    await sendMessage(msg.text, {
      isReview: msg.isReview,
      rating: msg.rating,
      language: msg.language,
      replyTo: msg.replyTo,
      retryId: String(msg.id),
    });
  };

  const handleDismissFailedMessage = (msgId: string | number) => {
    const strId = String(msgId);
    failedMessagesRef.current.delete(strId);
    setMessages(prev => prev.filter(m => String(m.id) !== strId));
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
      const withReply = encodeReplyText(trimmed, replyingTo);
      const formattedText = formatSpoilerChatMessage(withReply, isSpoilerDraft);
      success = await sendMessage(formattedText, { replyTo: replyingTo });
    }

    if (success) {
      setInputMessage('');
      setIsSpoilerDraft(false);
      setReplyingTo(null);

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

  const handleToggleSpoilerShield = () => {
    const next = !spoilerProtection;
    setSpoilerProtection(next);
    setSpoilerProtectionEnabled(next);
    if (next) {
      setRevealedMessageIds({});
    }
    setModerationToast(next ? 'Spoiler Shield enabled in Live Chat' : 'Spoiler Shield disabled');
    setTimeout(() => setModerationToast(null), 3000);
  };

  const handleBlockChatUser = (username: string) => {
    const updated = blockChatUser(username);
    setBlockedUsers(updated);
    setOpenMenuMessageId(null);
    setModerationToast(`Blocked @${username}. Messages hidden.`);
    setTimeout(() => setModerationToast(null), 3500);
  };

  const handleUnblockChatUser = (username: string) => {
    const updated = unblockChatUser(username);
    setBlockedUsers(updated);
    if (updated.length === 0) {
      setShowBlockedManager(false);
    }
    setModerationToast(`Unblocked @${username}`);
    setTimeout(() => setModerationToast(null), 3000);
  };

  const handleSubmitUserReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingMessage) return;
    setIsSubmittingReport(true);
    try {
      const excerpt = stripSpoilerMarker(reportingMessage.text).slice(0, 160);
      const result = await cloudflareApi.reportIssue({
        animeId: 0,
        animeTitle: 'Community Live Chat',
        issueType: `Chat Report: ${reportIssueType}`,
        description: `Reported user: @${reportingMessage.user}\nMessage ID: ${reportingMessage.id}\nExcerpt: "${excerpt}"\nDetails: ${reportDescription.trim() || 'No extra details provided'}`,
      });
      if (!result.success) {
        throw new Error(result.error || 'Failed to submit user report');
      }
      setModerationToast(`Reported @${reportingMessage.user} to moderators.`);
      setTimeout(() => setModerationToast(null), 4000);
      setReportingMessage(null);
      setReportDescription('');
    } catch (err: any) {
      setChatError(err?.message || 'Unable to submit report right now.');
      setTimeout(() => setChatError(null), 5000);
    } finally {
      setIsSubmittingReport(false);
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

  const visibleMessages = filterVisibleChatMessages(messages, blockedUsers);

  return (
    <div className={`bg-[#12141E] border border-[#292B39] rounded-2xl shadow-2xl flex flex-col font-sans text-[#F4F3FA] overflow-hidden transition-colors duration-150 ${className || ''}`}>
      
      {/* 1. CHANNEL HEADER BAR */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3 border-b border-[#292B39] bg-[#191C29]">
        {/* Left: Channel Info & User Identity */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#B49AF8]/15 border border-[#B49AF8]/30 text-[#B49AF8] flex items-center justify-center shrink-0">
            <Hash className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs sm:text-[13px] font-semibold text-[#F4F3FA] tracking-tight">
              live-chat
            </span>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${connectionStatus === 'connected' ? 'bg-[#34D399]' : 'bg-[#F9C876]'}`} />
            
            {/* Identity chip: Verified Clerk badge when signed in; editable guest name otherwise */}
            {isSignedIn && user ? (
              <div
                className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[#34D399] bg-[#34D399]/10 border border-[#34D399]/30 rounded-md px-2 py-0.5 font-medium"
                title="Verified Clerk Identity"
              >
                <ShieldCheck className="w-3 h-3 text-[#34D399] shrink-0" />
                <span className="truncate max-w-[140px]">@{currentUserName}</span>
              </div>
            ) : (
              <div className="relative hidden sm:inline-block">
                <button
                  type="button"
                  onClick={handleRandomizeName}
                  aria-label="Randomize guest display name"
                  className="text-[11px] text-[#A1A5B5] hover:text-[#F4F3FA] bg-[#12141E] hover:bg-[#0B0A10] border border-[#292B39] rounded-md px-2 py-0.5 flex items-center gap-1 transition-colors duration-150 cursor-pointer"
                  title="Sign in with Clerk to post (click to cycle guest tag)"
                >
                  <span className="truncate max-w-[100px] text-[#B49AF8] font-medium">@{guestName}</span>
                  <Dices className="w-2.5 h-2.5 text-[#A1A5B5] hover:text-[#F9C876] shrink-0" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Controls & Mode Switcher */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mode Switcher: Chat vs Dub Review */}
          <div className="flex items-center p-0.5 rounded-lg bg-[#12141E] border border-[#292B39] text-xs">
            <button
              type="button"
              onClick={() => setMode('chat')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 cursor-pointer ${
                mode === 'chat'
                  ? 'bg-[#B49AF8] text-[#0B0A10] font-bold'
                  : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setMode('review')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 cursor-pointer flex items-center gap-1 ${
                mode === 'review'
                  ? 'bg-[#F9C876] text-[#0B0A10] font-bold'
                  : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
              }`}
            >
              <Star className="w-2.5 h-2.5 fill-current" />
              <span>Review</span>
            </button>
          </div>

          {/* Spoiler Protection Toggle */}
          <button
            type="button"
            onClick={handleToggleSpoilerShield}
            aria-pressed={spoilerProtection}
            aria-label={spoilerProtection ? 'Disable spoiler protection' : 'Enable spoiler protection'}
            className={`px-2 py-1.5 rounded-lg border transition-colors duration-150 cursor-pointer flex items-center gap-1 ${
              spoilerProtection
                ? 'bg-[#F9C876]/15 border-[#F9C876]/40 text-[#F9C876]'
                : 'bg-[#12141E] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA]'
            }`}
            title={spoilerProtection ? 'Spoiler Shield: ON' : 'Spoiler Shield: OFF'}
          >
            {spoilerProtection ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span className="hidden md:inline text-[10px] font-bold">
              {spoilerProtection ? 'Spoiler ON' : 'Spoiler OFF'}
            </span>
          </button>

          {/* Blocked Users Manager Button */}
          {blockedUsers.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBlockedManager((prev) => !prev)}
              aria-label={`Manage ${blockedUsers.length} blocked users`}
              className="px-2 py-1.5 rounded-lg bg-[#F87171]/15 border border-[#F87171]/30 text-[#F87171] hover:text-[#F4F3FA] text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors duration-150"
              title="Manage blocked users"
            >
              <Ban className="w-3 h-3" />
              <span>{blockedUsers.length}</span>
            </button>
          )}

          {/* Auto-scroll Button */}
          <button
            type="button"
            onClick={() => {
              const next = !autoScroll;
              setAutoScroll(next);
              if (next) scrollToBottom(true);
            }}
            className={`p-1.5 rounded-lg border transition-colors duration-150 cursor-pointer ${
              autoScroll 
                ? 'bg-[#B49AF8]/15 border-[#B49AF8]/40 text-[#B49AF8]' 
                : 'bg-[#12141E] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA]'
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
            className="p-1.5 rounded-lg bg-[#12141E] hover:bg-[#0B0A10] border border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA] transition-colors duration-150 cursor-pointer disabled:opacity-50"
            title="Refresh chat history"
            aria-label="Refresh chat history"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-[#B49AF8]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Blocked Users Manager Drawer */}
      {showBlockedManager && blockedUsers.length > 0 && (
        <div className="px-3 py-2 bg-[#F87171]/10 border-b border-[#F87171]/25 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#F87171]">Blocked users:</span>
            {blockedUsers.map((u) => (
              <button
                key={`blocked_${u}`}
                type="button"
                onClick={() => handleUnblockChatUser(u)}
                aria-label={`Unblock ${u}`}
                className="px-2 py-0.5 rounded-md bg-[#0B0A10] border border-[#F87171]/35 text-[#F4F3FA] text-[11px] inline-flex items-center gap-1 cursor-pointer"
                title={`Unblock @${u}`}
              >
                <span>@{u}</span>
                <X className="w-3 h-3 text-[#F87171]" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowBlockedManager(false)}
            aria-label="Close blocked users panel"
            className="text-[11px] text-[#A1A5B5] hover:text-[#F4F3FA] cursor-pointer"
          >
            Close
          </button>
        </div>
      )}

      {/* Sync / Moderation Status Toast */}
      {(syncStatus || moderationToast) && (
        <div className="text-[10px] font-medium text-[#34D399] bg-[#34D399]/10 border-b border-[#34D399]/20 px-3 py-1.5 flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span>{moderationToast || `${syncStatus} — connected and synchronized.`}</span>
        </div>
      )}

      {/* 2. CONTINUOUS STREAM MESSAGE FEED */}
      <div
        ref={chatContainerRef}
        className="h-[400px] sm:h-[460px] md:h-[500px] overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4 space-y-2.5 bg-[#0B0A10]"
      >
        {visibleMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center p-2">
            <EmptyState
              icon={<Sparkles className="w-5 h-5" />}
              title="Welcome to Live Chat"
              description={
                messages.length > 0 && blockedUsers.length > 0
                  ? 'All current messages are from blocked users.'
                  : 'Say hello or share your thoughts on Tamil, Hindi, Telugu, and Malayalam dubs.'
              }
              className="w-full max-w-sm border-dashed"
            />
          </div>
        ) : (
          visibleMessages.map((msg) => {
            const userColor = getUsernameColor(msg.user);
            const avatarStyle = getAvatarStyle(msg.user, msg.isReview);
            const msgKey = String(msg.id);
            const isSpoilerMsg = isChatMessageSpoiler(msg);
            const shouldBlur = spoilerProtection && isSpoilerMsg && !revealedMessageIds[msgKey];
            const strippedText = stripSpoilerMarker(msg.text);
            const parsedReply = parseReplyFromText(strippedText);
            const effectiveReply = msg.replyTo || parsedReply.replyTo;
            const cleanBody = parsedReply.body;
            const isMenuOpen = openMenuMessageId === msgKey;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                data-testid="chat-message-bubble"
                className={`relative flex items-start gap-2.5 p-3 rounded-[12px] border transition-colors duration-180 motion-reduce:transition-none group ${
                  msg.deliveryStatus === 'failed'
                    ? 'bg-[#F87171]/10 border-[#F87171]/40'
                    : msg.isSelf
                      ? 'bg-[#B49AF8]/12 border-[#B49AF8]/30'
                      : 'bg-[#191C29] border-[#292B39]'
                }`}
              >
                {/* Avatar */}
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[10px] sm:text-[11px] font-bold shrink-0 border ${avatarStyle} mt-0.5`}>
                  {getInitials(msg.user)}
                </div>

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[12px] sm:text-[13px] font-semibold ${userColor} tracking-tight truncate max-w-[160px]`}>
                      {msg.user}
                    </span>

                    {msg.isSelf && (
                      <span className="text-[9px] font-bold text-[#B49AF8] bg-[#B49AF8]/15 border border-[#B49AF8]/30 px-1.5 py-0.5 rounded">
                        you
                      </span>
                    )}

                    {msg.isReview && (
                      <span className="text-[10px] font-semibold text-[#F9C876] bg-[#F9C876]/15 border border-[#F9C876]/30 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-[#F9C876]" />
                        <span>{msg.rating ? `${msg.rating}/10` : 'Dub Review'}</span>
                      </span>
                    )}

                    {isSpoilerMsg && (
                      <span className="text-[10px] font-bold text-[#F9C876] bg-[#F9C876]/15 border border-[#F9C876]/30 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                        <EyeOff className="w-2.5 h-2.5" />
                        <span>Spoiler</span>
                      </span>
                    )}

                    {msg.language && (
                      <span className="text-[10px] font-medium text-[#34D399] bg-[#34D399]/15 border border-[#34D399]/30 px-1.5 py-0.5 rounded">
                        {msg.language}
                      </span>
                    )}

                    <span className="text-[10px] text-[#A1A5B5] font-mono ml-auto select-none">
                      {msg.timestamp}
                    </span>

                    {/* Quick Reply Action */}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('chat');
                        setReplyingTo({
                          user: msg.user,
                          excerpt: shouldBlur ? 'Spoiler message' : cleanBody.slice(0, 80),
                        });
                      }}
                      aria-label={`Reply to ${msg.user}`}
                      className="p-1.5 rounded-lg text-[#A1A5B5] hover:text-[#B49AF8] hover:bg-[#12141E] transition-colors duration-180 motion-reduce:transition-none cursor-pointer sm:opacity-60 sm:group-hover:opacity-100 focus:opacity-100"
                      title={`Reply to @${msg.user}`}
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>

                    {/* Block / Report User Menu Button */}
                    {!msg.isSelf && (
                      <div className="relative" data-chat-mod-menu>
                        <button
                          type="button"
                          onClick={() => setOpenMenuMessageId(isMenuOpen ? null : msgKey)}
                          aria-label={`Moderate or report ${msg.user}`}
                          aria-expanded={isMenuOpen}
                          className="p-1.5 rounded-lg text-[#A1A5B5] hover:text-[#F4F3FA] hover:bg-[#12141E] transition-colors duration-180 motion-reduce:transition-none cursor-pointer sm:opacity-60 sm:group-hover:opacity-100 focus:opacity-100"
                          title={`Block or Report @${msg.user}`}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-full mt-1 w-40 rounded-[12px] bg-[#12141E] border border-[#292B39] shadow-2xl py-1 z-40">
                            <button
                              type="button"
                              onClick={() => handleBlockChatUser(msg.user)}
                              aria-label={`Block user ${msg.user}`}
                              className="w-full min-h-[38px] px-3 py-1.5 text-left text-xs text-[#F87171] hover:bg-[#F87171]/15 flex items-center gap-2 cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5 shrink-0" />
                              <span>Block User</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReportingMessage(msg);
                                setOpenMenuMessageId(null);
                              }}
                              aria-label={`Report user ${msg.user}`}
                              className="w-full min-h-[38px] px-3 py-1.5 text-left text-xs text-[#F9C876] hover:bg-[#F9C876]/15 flex items-center gap-2 cursor-pointer"
                            >
                              <Flag className="w-3.5 h-3.5 shrink-0" />
                              <span>Report User</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quoted Reply Block */}
                  {effectiveReply && (
                    <div className="mt-1.5 mb-1 px-2.5 py-1.5 rounded-lg bg-[#12141E]/80 border-l-2 border-[#B49AF8] text-[11px] text-[#A1A5B5] truncate">
                      <span className="font-semibold text-[#B49AF8] mr-1.5">@{effectiveReply.user}</span>
                      <span>{effectiveReply.excerpt}</span>
                    </div>
                  )}

                  {/* Message Body (with optional Spoiler Protection blur overlay) */}
                  <div className="relative mt-1">
                    {msg.isReview ? (
                      <div
                        className={`text-xs sm:text-[13px] text-[#F4F3FA] leading-relaxed border-l-2 border-[#F9C876] pl-2.5 py-1 bg-[#F9C876]/10 rounded-r break-words transition-all ${
                          shouldBlur ? 'blur-sm select-none opacity-45 pointer-events-none' : ''
                        }`}
                      >
                        {cleanBody}
                      </div>
                    ) : (
                      <p
                        className={`text-xs sm:text-[13px] text-[#F4F3FA] leading-relaxed break-words select-text font-normal transition-all ${
                          shouldBlur ? 'blur-sm select-none opacity-45 pointer-events-none' : ''
                        }`}
                      >
                        {cleanBody}
                      </p>
                    )}

                    {shouldBlur && (
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedMessageIds((prev) => ({ ...prev, [msgKey]: true }))
                        }
                        aria-label={`Reveal spoiler message from ${msg.user}`}
                        className="mt-1.5 min-h-[36px] px-3 py-1 rounded-[10px] bg-[#F9C876]/15 hover:bg-[#F9C876]/25 border border-[#F9C876]/35 text-[11px] font-bold text-[#F9C876] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Spoiler Hidden — Click to Reveal</span>
                      </button>
                    )}
                  </div>

                  {/* Delivery Status Footer (Sending / Sent / Failed — Retry) */}
                  {msg.isSelf && msg.deliveryStatus && (
                    <div className="mt-1.5 flex items-center justify-end gap-2 text-[10px]">
                      {msg.deliveryStatus === 'sending' && (
                        <span className="text-[#A1A5B5] font-medium">Sending…</span>
                      )}
                      {msg.deliveryStatus === 'sent' && (
                        <span className="text-[#34D399] font-medium inline-flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Sent</span>
                        </span>
                      )}
                      {msg.deliveryStatus === 'failed' && (
                        <div className="flex items-center gap-2">
                          <span className="text-[#F87171] font-semibold">Failed to send</span>
                          <button
                            type="button"
                            onClick={() => handleRetryFailedMessage(msg)}
                            className="px-2 py-0.5 rounded-md bg-[#F87171]/20 hover:bg-[#F87171]/30 border border-[#F87171]/40 text-[#F4F3FA] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors duration-180"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Retry</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDismissFailedMessage(msg.id)}
                            aria-label="Dismiss failed message"
                            className="text-[#A1A5B5] hover:text-[#F4F3FA] cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Report User Inline Modal */}
      {reportingMessage && (
        <div
          className="fixed inset-0 z-[80] bg-[#0B0A10]/85 flex items-center justify-center p-4"
          onClick={() => setReportingMessage(null)}
        >
          <form
            onSubmit={handleSubmitUserReport}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-[#12141E] border border-[#292B39] p-5 shadow-2xl space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#F9C876]">
                <Flag className="w-4 h-4" />
                <h4 className="text-sm font-bold text-[#F4F3FA]">Report @{reportingMessage.user}</h4>
              </div>
              <button
                type="button"
                onClick={() => setReportingMessage(null)}
                aria-label="Close report user modal"
                className="p-1.5 rounded-lg text-[#A1A5B5] hover:text-[#F4F3FA] hover:bg-[#191C29] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[11px] text-[#A1A5B5] bg-[#191C29] border border-[#292B39] rounded-xl p-2.5 line-clamp-2">
              "{stripSpoilerMarker(reportingMessage.text)}"
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-[#F4F3FA]">Reason</label>
              <select
                value={reportIssueType}
                onChange={(e) => setReportIssueType(e.target.value)}
                aria-label="Report reason"
                className="w-full bg-[#191C29] border border-[#292B39] rounded-xl px-3 py-2 text-xs text-[#F4F3FA] focus:outline-none focus:border-[#B49AF8]"
              >
                <option value="Harassment or Abuse">Harassment or Abuse</option>
                <option value="Spam or Scam Links">Spam or Scam Links</option>
                <option value="Unmarked Spoilers">Unmarked Spoilers</option>
                <option value="Inappropriate Content">Inappropriate Content</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-[#F4F3FA]">Additional Details (Optional)</label>
              <textarea
                rows={2}
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Tell our moderators what happened..."
                className="w-full bg-[#191C29] border border-[#292B39] rounded-xl p-2.5 text-xs text-[#F4F3FA] placeholder-[#A1A5B5] focus:outline-none focus:border-[#B49AF8] resize-none"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  handleBlockChatUser(reportingMessage.user);
                  setReportingMessage(null);
                }}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-[#F87171]/15 hover:bg-[#F87171]/25 border border-[#F87171]/35 text-[#F87171] text-xs font-bold cursor-pointer"
              >
                Block & Close
              </button>
              <button
                type="submit"
                disabled={isSubmittingReport}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] text-xs font-extrabold cursor-pointer disabled:opacity-50"
              >
                {isSubmittingReport ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. STICKY BOTTOM COMPOSER */}
      <div className="sticky bottom-0 p-3 border-t border-[#292B39] bg-[#191C29] space-y-2 z-20">
        
        {/* Error Warning */}
        {chatError && (
          <div role="alert" className="px-3 py-2 rounded-[12px] bg-[#F87171]/10 border border-[#F87171]/35 text-[#F87171] text-xs font-medium flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 text-[#F87171] shrink-0" />
              <span className="break-words">{chatError}</span>
            </div>
            <button
              type="button"
              onClick={() => setChatError(null)}
              className="p-1.5 rounded-md text-[#F87171] hover:text-[#F4F3FA] hover:bg-[#F87171]/20 transition-colors duration-180 shrink-0 cursor-pointer"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Active Reply Preview Chip */}
        {replyingTo && mode === 'chat' && (
          <div
            data-testid="chat-reply-preview"
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-[12px] bg-[#12141E] border border-[#B49AF8]/35 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Reply className="w-3.5 h-3.5 text-[#B49AF8] shrink-0" />
              <span className="text-[#B49AF8] font-semibold shrink-0">@{replyingTo.user}</span>
              <span className="text-[#A1A5B5] truncate">{replyingTo.excerpt}</span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              aria-label="Cancel reply"
              className="p-1 rounded-md text-[#A1A5B5] hover:text-[#F4F3FA] cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Review Mode Filters */}
        {mode === 'review' && (
          <div className="flex items-center flex-wrap gap-2 px-1 text-xs text-[#F9C876]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A1A5B5]">Reviewing:</span>
            <select
              value={reviewLang}
              onChange={(e) => setReviewLang(e.target.value)}
              className="min-h-[36px] bg-[#12141E] border border-[#292B39] rounded-[10px] px-2.5 text-[11px] text-[#F9C876] font-medium focus:outline-none focus:border-[#B49AF8] cursor-pointer"
            >
              <option value="Tamil Dub">Tamil Dub</option>
              <option value="Telugu Dub">Telugu Dub</option>
              <option value="Hindi Dub">Hindi Dub</option>
              <option value="Malayalam Dub">Malayalam Dub</option>
              <option value="Kannada Dub">Kannada Dub</option>
            </select>

            <div className="flex items-center gap-1 min-h-[36px] bg-[#12141E] border border-[#292B39] px-2.5 rounded-[10px]">
              <Star className="w-3 h-3 fill-[#F9C876] text-[#F9C876] shrink-0" />
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(parseFloat(e.target.value))}
                className="bg-transparent text-[11px] text-[#F9C876] font-semibold focus:outline-none cursor-pointer"
              >
                {[10, 9.5, 9.0, 8.5, 8.0, 7.5, 7.0, 6.0, 5.0].map(r => (
                  <option key={`chat_rating_${r}`} value={r} className="bg-[#12141E] text-[#F4F3FA]">{r}/10</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Floating Emoji Picker Popover */}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-full mb-2 left-3 sm:left-4 bg-[#12141E] border border-[#292B39] rounded-[12px] shadow-2xl p-1.5 flex items-center gap-1 z-50"
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReactionClick(emoji)}
                aria-label={`Insert ${emoji} reaction`}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#191C29] text-sm transition-colors duration-180 cursor-pointer"
                title={`Add ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Active Username Indicator */}
        <div className="text-xs text-[#A1A5B5] flex items-center justify-between gap-2 px-1 select-none">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0">{isSignedIn && user ? 'Verified:' : 'Visitor:'}</span>
            <strong className="text-[#F4F3FA] font-semibold tracking-wide truncate">
              {currentUserName}
            </strong>
          </div>
          {!isSignedIn && (
            <span className="text-[11px] text-[#F9C876] shrink-0">
              Sign in with Clerk to post
            </span>
          )}
        </div>

        {/* 44px Eclipse Composer with Smiley, Spoiler Tag & Send */}
        <form onSubmit={handleSendMessageSubmit} className="relative">
          <div className={`relative flex items-center min-h-[44px] bg-[#12141E] focus-within:bg-[#0B0A10] border rounded-[12px] px-2 py-1 gap-1.5 transition-colors duration-180 motion-reduce:transition-none ${
            mode === 'review'
              ? 'border-[#F9C876]/40 focus-within:border-[#F9C876]'
              : 'border-[#292B39] focus-within:border-[#B49AF8]'
          }`}>
            
            {/* Embedded Smiley Emoji Picker Toggle Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(prev => !prev)}
              className={`w-9 h-9 rounded-lg hover:bg-[#191C29] flex items-center justify-center transition-colors duration-180 cursor-pointer shrink-0 ${
                showEmojiPicker ? 'text-[#F9C876] bg-[#191C29]' : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
              }`}
              title="Add reaction emoji"
              aria-label="Add reaction emoji"
            >
              <Smile className="w-4 h-4" />
            </button>

            {mode === 'chat' && (
              <button
                type="button"
                onClick={() => setIsSpoilerDraft((prev) => !prev)}
                aria-pressed={isSpoilerDraft}
                aria-label="Mark message as spoiler"
                className={`min-h-[32px] px-2.5 rounded-lg text-[10px] font-bold transition-colors duration-180 cursor-pointer shrink-0 border ${
                  isSpoilerDraft
                    ? 'bg-[#F9C876]/20 border-[#F9C876]/40 text-[#F9C876]'
                    : 'bg-[#191C29] border-[#292B39] text-[#A1A5B5] hover:text-[#F4F3FA]'
                }`}
                title="Tag this message as a spoiler"
              >
                Spoiler
              </button>
            )}

            {/* Seamless Text Input */}
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                !isSignedIn
                  ? 'Sign in with Clerk to post...'
                  : mode === 'review'
                  ? `Review as ${currentUserName} (${reviewLang})...`
                  : defaultAnimeTitle
                    ? `Message about ${defaultAnimeTitle}...`
                    : `Message as ${currentUserName}...`
              }
              className="flex-1 bg-transparent text-xs sm:text-[13px] text-[#F4F3FA] placeholder-[#A1A5B5] focus:outline-none min-w-0 py-1.5"
            />

            {/* Embedded Send Button */}
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-colors duration-180 cursor-pointer disabled:opacity-30 disabled:pointer-events-none ${
                mode === 'review'
                  ? 'bg-[#F9C876] text-[#0B0A10]'
                  : 'bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10]'
              }`}
              title={mode === 'review' ? 'Post Dub Review' : 'Send message'}
              aria-label={mode === 'review' ? 'Post Dub Review' : 'Send message'}
            >
              <Send className="w-4 h-4 fill-current ml-0.5" />
            </button>
          </div>
        </form>
      </div>

    </div>
  );
};
