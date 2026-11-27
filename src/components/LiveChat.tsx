import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, X, Send, Users, Reply, Flag, RefreshCw, AlertCircle, Wifi, WifiOff
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { cloudflareApi } from '../services/cloudflareApi';
import { getCloudflareWsUrl } from '../config/cloudflare';
import { getVerifiedClerkUsername } from '../utils/chatIdentity';

interface Message {
  id: string;
  user: string;
  avatar?: string;
  text: string;
  timestamp: string;
  isSelf?: boolean;
  replyToUser?: string;
  replyToText?: string;
  deliveryState?: 'sending' | 'sent' | 'failed';
  room?: string;
}

interface LiveChatProps {
  user: { id?: string; name: string; email: string; avatar?: string } | null;
  onOpenAuth: () => void;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  embedded?: boolean;
  activeRoom?: string;
}

type ConnectionState = 'Connecting' | 'Connected' | 'Reconnecting' | 'Offline';

export const LiveChat: React.FC<LiveChatProps> = ({
  user,
  onOpenAuth,
  onShowToast,
  embedded = false,
  activeRoom = 'Global',
}) => {
  const { getToken } = useAuth();
  const [isOpen, setIsOpen] = useState(embedded);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('Connecting');
  const [chatError, setChatError] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<{ user: string; text: string } | null>(null);
  const [mutedUsers, setMutedUsers] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('anidub_muted_chat_users') || '[]');
    } catch {
      return [];
    }
  });
  const [spoilerShield, setSpoilerShield] = useState<boolean>(() => {
    try {
      return localStorage.getItem('anidub_chat_spoiler_shield') !== 'false';
    } catch {
      return true;
    }
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const verifiedUsername = getVerifiedClerkUsername(user) || user?.name || 'AnimeFan';

  const handleToggleSpoilerShield = () => {
    const next = !spoilerShield;
    setSpoilerShield(next);
    try {
      localStorage.setItem('anidub_chat_spoiler_shield', String(next));
    } catch {
      // ignore
    }
    if (onShowToast) {
      onShowToast(next ? 'Spoiler Shield enabled' : 'Spoiler Shield disabled', 'info');
    }
  };

  useEffect(() => {
    if (embedded) setIsOpen(true);
  }, [embedded]);

  useEffect(() => {
    if (!isOpen && !embedded) return;

    let isMounted = true;
    const fetchMessages = async (isInitial = false) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (isMounted) setConnectionState('Offline');
        return;
      }
      if (isInitial && isMounted) {
        setConnectionState('Connecting');
      }
      try {
        const cfMessages = await cloudflareApi.getChatMessages();
        if (!isMounted) return;
        setConnectionState('Connected');
        if (Array.isArray(cfMessages)) {
          const formatted: Message[] = cfMessages.map((m: any) => ({
            id: String(m.id),
            user: m.user_name || m.user || 'AnimeFan',
            avatar: m.user_avatar || undefined,
            text: m.message || m.text || '',
            timestamp: new Date(m.created_at || Date.now()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            isSelf: Boolean(user && (m.user_name || m.user) === verifiedUsername),
            deliveryState: 'sent',
          }));
          setMessages((prev) => {
            const seen = new Set(formatted.map((f) => f.id));
            const pendingOrFailed = prev.filter((p) => p.deliveryState !== 'sent' && !seen.has(p.id));
            return [...formatted, ...pendingOrFailed];
          });
        }
      } catch {
        if (isMounted) {
          setConnectionState((prev) => (prev === 'Connected' ? 'Reconnecting' : 'Offline'));
        }
      }
    };

    fetchMessages(true);
    const interval = setInterval(() => fetchMessages(false), 12000);

    let ws: WebSocket | null = null;
    if (typeof WebSocket !== 'undefined') {
      try {
        const wsUrl = getCloudflareWsUrl('/ws');
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = async () => {
          if (!isMounted) return;
          setConnectionState('Connected');
          setChatError(null);
          if (user) {
            try {
              const token = await getToken();
              if (token && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    type: 'auth',
                    token,
                    username: verifiedUsername,
                  })
                );
              }
            } catch {
              // Token handshake best-effort
            }
          }
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'error') {
              const errorText = data.error || data.message || 'Unable to send chat message.';
              setChatError(errorText);
              onShowToast?.(errorText, 'error');
              return;
            }
            if (data.type === 'message' || (data.text && data.user)) {
              const incomingId = String(data.id || Date.now());
              const incoming: Message = {
                id: incomingId,
                user: data.user || data.username || 'AnimeFan',
                text: data.text || data.message || '',
                timestamp: new Date(data.timestamp || Date.now()).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                isSelf: Boolean(user && (data.user || data.username) === verifiedUsername),
                deliveryState: 'sent',
                room: data.room || activeRoom,
              };
              setMessages((prev) => {
                const exists = prev.some((m) => m.id === incomingId);
                if (exists) {
                  return prev.map((m) => (m.id === incomingId ? { ...m, deliveryState: 'sent' } : m));
                }
                return [...prev, incoming];
              });
            }
          } catch {
            // Ignore malformed socket frames
          }
        };

        ws.onerror = () => {
          if (isMounted) setConnectionState((prev) => (prev === 'Connected' ? 'Reconnecting' : prev));
        };

        ws.onclose = () => {
          if (wsRef.current === ws) wsRef.current = null;
        };
      } catch {
        // Fallback silently to REST polling
      }
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (ws) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [isOpen, embedded, user, verifiedUsername, getToken, activeRoom]);

  useEffect(() => {
    if ((isOpen || embedded) && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen, embedded]);

  const sendPayload = async (tempId: string, rawText: string) => {
    if (!user) return;
    setChatError(null);
    try {
      const token = await getToken();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            id: tempId,
            type: 'message',
            user: verifiedUsername,
            username: verifiedUsername,
            text: rawText,
            token: token || undefined,
            room: activeRoom,
          })
        );
      }
      await cloudflareApi.sendChatMessage({
        id: tempId,
        user_name: verifiedUsername,
        user_avatar: user.avatar || '',
        message: rawText,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, deliveryState: 'sent' } : m))
      );
      setConnectionState('Connected');
    } catch (err: any) {
      const errorText = err?.message || 'Failed to send message. Tap Retry.';
      setChatError(errorText);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, deliveryState: 'failed' } : m))
      );
      if (onShowToast) {
        onShowToast(errorText, 'error');
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    if (!user) {
      onOpenAuth();
      return;
    }

    const tempId = Date.now().toString();
    const formattedText = replyTarget
      ? `@${replyTarget.user}: ${inputText.trim()}`
      : inputText.trim();

    const optimisticMsg: Message = {
      id: tempId,
      user: verifiedUsername,
      avatar: user.avatar,
      text: formattedText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true,
      replyToUser: replyTarget?.user,
      replyToText: replyTarget?.text,
      deliveryState: 'sending',
      room: activeRoom,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');
    setReplyTarget(null);

    await sendPayload(tempId, formattedText);
  };

  const handleRetryMessage = async (msg: Message) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, deliveryState: 'sending' } : m))
    );
    await sendPayload(msg.id, msg.text);
  };

  const handleReportOrMute = (targetUser: string) => {
    const updated = Array.from(new Set([...mutedUsers, targetUser]));
    setMutedUsers(updated);
    try {
      localStorage.setItem('anidub_muted_chat_users', JSON.stringify(updated));
    } catch {
      // ignore
    }
    if (onShowToast) {
      onShowToast(`Reported & muted messages from ${targetUser}`, 'info');
    }
  };

  const visibleMessages = messages.filter((m) => !mutedUsers.includes(m.user));

  const connectionBadge = () => {
    const styles: Record<ConnectionState, string> = {
      Connected: 'bg-emerald-500/10 text-[#34D399] border-emerald-500/30',
      Connecting: 'bg-[#191C29] text-[#A1A5B5] border-[#292B39]',
      Reconnecting: 'bg-amber-500/10 text-[#F9C876] border-amber-500/30',
      Offline: 'bg-red-500/10 text-[#F87171] border-red-500/30',
    };
    return (
      <span
        data-testid="chat-connection-state"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] border text-[11px] font-bold ${styles[connectionState]}`}
      >
        {connectionState === 'Offline' ? (
          <WifiOff className="w-3.5 h-3.5" />
        ) : (
          <Wifi className="w-3.5 h-3.5" />
        )}
        <span>{connectionState}</span>
      </span>
    );
  };

  const chatWindow = (
    <div
      className={
        embedded
          ? 'w-full h-[560px] rounded-[16px] bg-[#12141E] border border-[#292B39] flex flex-col overflow-hidden'
          : 'fixed bottom-20 right-4 z-50 w-[360px] max-w-[calc(100vw-32px)] h-[500px] rounded-[16px] bg-[#12141E] border border-[#292B39] shadow-2xl flex flex-col overflow-hidden'
      }
    >
      {/* Top Status Bar */}
      <div className="px-4 py-3 bg-[#191C29] border-b border-[#292B39] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Users className="w-4 h-4 text-[#B49AF8]" />
          <span className="text-[14px] font-bold text-[#F4F3FA]">
            {activeRoom} Room
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleSpoilerShield}
            aria-label="Toggle Spoiler Shield"
            className={`min-h-[36px] px-2.5 py-1 rounded-[8px] border text-[11px] font-bold transition-colors ${
              spoilerShield
                ? 'bg-[#B49AF8]/15 text-[#CBB6FF] border-[#B49AF8]/35'
                : 'bg-[#12141E] text-[#A1A5B5] border-[#292B39]'
            }`}
          >
            {spoilerShield ? 'Spoiler ON' : 'Spoiler OFF'}
          </button>
          {connectionBadge()}
          {!embedded && (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close live chat"
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[10px] bg-[#12141E] text-[#A1A5B5] hover:text-[#F4F3FA] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {chatError && (
        <div
          role="alert"
          className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 flex items-center justify-between gap-2 text-[12px] text-[#F87171]"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{chatError}</span>
          </div>
          <button
            type="button"
            onClick={() => setChatError(null)}
            aria-label="Dismiss chat error"
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[8px] hover:bg-red-500/15 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {visibleMessages.length > 0 ? (
          visibleMessages.map((msg) => (
            <div
              key={msg.id}
              data-testid="chat-message-bubble"
              className={`rounded-[12px] p-3 border transition-colors ${
                msg.isSelf
                  ? 'bg-[#B49AF8]/15 border-[#B49AF8]/35 ml-6'
                  : 'bg-[#191C29] border-[#292B39] mr-6'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-bold text-[#F4F3FA] truncate">
                    {msg.user}
                  </span>
                  <span className="text-[11px] text-[#A1A5B5]">{msg.timestamp}</span>
                </div>

                {/* 44x44px Touch-Friendly Inline Actions (Reply & Report User / Block User) */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label={`Reply to ${msg.user}`}
                    title={`Reply to ${msg.user}`}
                    onClick={() => setReplyTarget({ user: msg.user, text: msg.text })}
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[10px] hover:bg-[#12141E] text-[#A1A5B5] hover:text-[#CBB6FF] flex items-center justify-center transition-colors"
                  >
                    <Reply className="w-4 h-4" />
                  </button>
                  {!msg.isSelf && (
                    <button
                      type="button"
                      aria-label={`Report User or Block User ${msg.user}`}
                      title={`Report User / Block User ${msg.user}`}
                      onClick={() => handleReportOrMute(msg.user)}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[10px] hover:bg-[#12141E] text-[#A1A5B5] hover:text-[#F87171] flex items-center justify-center transition-colors"
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[14px] text-[#F4F3FA] leading-relaxed break-words">
                {msg.text}
              </p>

              {/* Per-Message Delivery State */}
              {msg.deliveryState === 'sending' && (
                <div className="mt-1.5 text-[11px] text-[#A1A5B5] flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-[#B49AF8]" />
                  <span>Sending…</span>
                </div>
              )}

              {msg.deliveryState === 'failed' && (
                <div className="mt-2 pt-2 border-t border-red-500/20 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#F87171] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Failed to send</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRetryMessage(msg)}
                    className="min-h-[44px] px-3 rounded-[8px] bg-red-500/15 hover:bg-red-500/25 text-[#F87171] border border-red-500/30 text-[12px] font-bold"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#A1A5B5]">
            <MessageSquare className="w-8 h-8 text-[#B49AF8] mb-2 opacity-80" />
            <p className="text-[14px] font-semibold text-[#F4F3FA]">
              No messages in {activeRoom} Room yet
            </p>
            <p className="text-[12px] mt-1">
              Start the conversation about regional anime dubs!
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview Banner */}
      {replyTarget && (
        <div
          data-testid="chat-reply-preview"
          className="px-4 py-2 bg-[#191C29] border-t border-[#292B39] flex items-center justify-between gap-2 text-[12px]"
        >
          <div className="truncate text-[#A1A5B5]">
            Replying to <strong className="text-[#CBB6FF]">@{replyTarget.user}</strong>:{' '}
            {replyTarget.text}
          </div>
          <button
            type="button"
            onClick={() => setReplyTarget(null)}
            aria-label="Cancel reply"
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[8px] text-[#A1A5B5] hover:text-[#F4F3FA] flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Area */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 bg-[#191C29] border-t border-[#292B39] flex items-center gap-2"
      >
        {user ? (
          <>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Message ${activeRoom} room...`}
              aria-label="Chat message input"
              className="flex-1 min-h-[44px] px-3.5 rounded-[12px] bg-[#12141E] border border-[#292B39] text-[14px] text-[#F4F3FA] placeholder-[#A1A5B5] focus:outline-none focus:border-[#B49AF8]"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              aria-label="Send message"
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] bg-[#B49AF8] hover:bg-[#CBB6FF] disabled:opacity-40 text-[#0B0A10] flex items-center justify-center shrink-0 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full min-h-[44px] px-4 rounded-[12px] bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] font-bold text-[13px] transition-colors"
          >
            Sign in to join the conversation
          </button>
        )}
      </form>
    </div>
  );

  if (embedded) return chatWindow;

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open Community Chat"
          className="fixed bottom-20 right-4 z-40 min-h-[44px] px-4 rounded-full bg-[#B49AF8] text-[#0B0A10] font-bold text-[13px] shadow-lg flex items-center gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chat</span>
        </button>
      )}
      {isOpen && chatWindow}
    </>
  );
};
