import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Radio, 
  RefreshCw, 
  Sparkles, 
  Send, 
  Dices,
  Flame,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { CLOUDFLARE_API_URL } from '../config/cloudflare';

export interface ChatMessage {
  id: string | number;
  user: string;
  text: string;
  timestamp: string;
  isSelf?: boolean;
}

const QUICK_REACTIONS = ['🔥', '❤️', '⚡', '🍿', '😭', '✨', '💯', '🎌'];

const RANDOM_NAMES = [
  'Tanjiro_Delhi',
  'Goku_Chennai',
  'Luffy_Mumbai',
  'Zoro_Bengaluru',
  'Naruto_Kolkata',
  'Levi_Hyderabad',
  'Gojo_Kerala',
  'Deku_Pune'
];

export interface LiveChatProps {
  className?: string;
}

export const LiveChat: React.FC<LiveChatProps> = ({ className }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('cf_community_chat');
      return saved ? JSON.parse(saved) : [
        {
          id: 'welcome_1',
          user: 'AniDub_Bot',
          text: 'Welcome to the Live Indian Anime Dub Community! Stream officially in Hindi, Tamil, Telugu, Malayalam & Kannada.',
          timestamp: 'Just now',
          isSelf: false
        }
      ];
    } catch {
      return [];
    }
  });

  const [inputMessage, setInputMessage] = useState('');
  const [guestName, setGuestName] = useState(() => {
    return localStorage.getItem('anidub_guest_chat_name') || 'AnimeFan_IN';
  });
  const [autoScroll, setAutoScroll] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const reconnectTimerRef = useRef<any>(null);

  const scrollToBottom = () => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cloudflare WebSocket Connection & Auto-Reconnect Logic
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
            if (data && data.text) {
              const incomingMsg: ChatMessage = {
                id: data.id || `msg_${Date.now()}_${Math.random()}`,
                user: data.user || 'Anonymous Fan',
                text: data.text,
                timestamp: data.timestamp || 'Just now',
                isSelf: data.user === guestName
              };
              setMessages(prev => {
                const updated = [...prev, incomingMsg];
                try {
                  localStorage.setItem('cf_community_chat', JSON.stringify(updated.slice(-100)));
                } catch {}
                return updated;
              });
            }
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        ws.onerror = (err) => {
          console.warn('WebSocket error, falling back to broadcast simulation:', err);
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
      } catch (err) {
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
  }, [reconnectAttempts]);

  // Send Message function via WebSocket (with fallback to local state)
  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const payload = {
      id: `msg_${Date.now()}`,
      user: guestName.trim() || 'AnimeFan_IN',
      text: text.trim(),
      timestamp: 'Just now'
    };

    // Send through WebSocket if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(payload));
      } catch (err) {
        console.error('Failed to send message over WebSocket:', err);
      }
    }

    // Instantly update local state for snappy UI feedback
    const selfMsg: ChatMessage = {
      ...payload,
      isSelf: true
    };

    setMessages(prev => {
      const updated = [...prev, selfMsg];
      try {
        localStorage.setItem('cf_community_chat', JSON.stringify(updated.slice(-100)));
      } catch {}
      return updated;
    });
  };

  const handleSendMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    sendMessage(inputMessage.trim());
    setInputMessage('');
  };

  const handleRandomizeName = () => {
    const random = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    const num = Math.floor(Math.random() * 90 + 10);
    const chosen = `${random}_${num}`;
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
              Live Community Chat
            </h3>
            <span className="bg-purple-950/80 border border-purple-500/30 text-purple-300 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full">
              Cloudflare WebSocket
            </span>
          </div>
          <p className="text-xs text-neutral-300/80">
            Real-time chat with anime fans across India. Connected securely to Cloudflare Edge.
          </p>
        </div>

        {/* Right Connection Indicator */}
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
            onClick={() => setReconnectAttempts(prev => prev + 1)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Reconnect WebSocket"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. SCROLLABLE MESSAGE STREAM */}
      <div className="h-80 sm:h-96 overflow-y-auto pr-2 space-y-4 rounded-2xl bg-black/40 border border-white/10 p-4 scrollbar-thin scrollbar-thumb-purple-600/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-2 text-neutral-400">
            <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">No messages yet</h4>
            <p className="text-xs max-w-xs">Be the first to spark a conversation in the live chat!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3.5 group animate-in fade-in duration-200">
              {/* Gradient Avatar */}
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center text-white text-xs font-black shrink-0 shadow-md">
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
                  <span className="text-[10px] text-neutral-400">
                    {msg.timestamp}
                  </span>
                </div>

                <div className="mt-1.5 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-neutral-200 leading-relaxed max-w-2xl break-words shadow-inner">
                  {msg.text}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. CONTROLS & INPUT FORM */}
      <div className="space-y-3.5">
        {/* Auto-scroll toggle bar */}
        <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input 
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-purple-500 rounded"
            />
            <span>Auto-scroll to latest messages</span>
          </label>
          <span className="text-[11px] text-purple-300/80 font-medium">WebSocket active</span>
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
          {/* Posting As row */}
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
              className="bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-400 w-40 sm:w-48 shadow-inner"
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
          </div>

          {/* Message Input & Glowing Send Button */}
          <div className="flex gap-2.5">
            <input 
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Send a live message to the community..."
              className="flex-1 bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-400 shadow-inner"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 active:scale-95"
            >
              <Send className="w-4 h-4 fill-white" />
              <span>Send</span>
            </button>
          </div>
        </form>
      </div>

    </div>
  );
};
