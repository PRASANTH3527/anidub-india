import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Radio, 
  RefreshCw, 
  Sparkles, 
  Send, 
  Smile, 
  Dices,
  Flame,
  Check
} from 'lucide-react';

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
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [inputMessage, setInputMessage] = useState('');
  const [guestName, setGuestName] = useState(() => {
    return localStorage.getItem('anidub_guest_chat_name') || 'AnimeFan_IN';
  });
  const [autoScroll, setAutoScroll] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      user: guestName.trim() || 'Anonymous Fan',
      text: inputMessage.trim(),
      timestamp: 'Just now',
      isSelf: true
    };

    setMessages(prev => {
      const updated = [...prev, newMsg];
      try {
        localStorage.setItem('cf_community_chat', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
    setInputMessage('');
  };

  const handleRandomizeName = () => {
    const random = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    const num = Math.floor(Math.random() * 90 + 10);
    const chosen = `${random}_${num}`;
    setGuestName(chosen);
    localStorage.setItem('anidub_guest_chat_name', chosen);
  };

  const handleRefreshChat = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const handleReactionClick = (emoji: string) => {
    setInputMessage(prev => prev ? `${prev} ${emoji}` : emoji);
  };

  // Helper for 2-letter avatar initials & gradient
  const getInitials = (name: string) => {
    const clean = name.replace(/[^a-zA-Z]/g, '');
    return (clean.slice(0, 2) || 'AF').toUpperCase();
  };

  return (
    <div className={`bg-[#1A1C29]/60 backdrop-blur-md border border-gray-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 font-sans ${className || ''}`}>
      
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <h3 className="text-base sm:text-lg font-bold text-gray-200">
              Live Community Discussion
            </h3>
            <span className="bg-purple-950/70 border border-purple-500/30 text-purple-300 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
              Guest Mode
            </span>
          </div>
          <p className="text-xs text-neutral-400">
            Chat live with regional Indian anime dub fans across Tamil, Telugu, Hindi, Malayalam, and Kannada communities.
          </p>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-[11px] font-semibold text-emerald-400">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Connected</span>
          </div>

          <button
            onClick={handleRefreshChat}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh chat feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. CHAT MESSAGE STREAM */}
      <div className="h-80 sm:h-96 overflow-y-auto pr-1 space-y-3.5 rounded-2xl bg-[#0c1017]/90 border border-neutral-800/80 p-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-2 text-neutral-500">
            <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">No messages yet</h4>
            <p className="text-xs max-w-xs">Be the first to say hello to the Indian dubbed anime community!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3 group">
              {/* 2-letter gradient avatar circle */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-500 flex items-center justify-center text-white text-[11px] font-black shrink-0 shadow-sm">
                {getInitials(msg.user)}
              </div>

              {/* Message Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white leading-none">
                    {msg.user}
                  </span>
                  {msg.isSelf && (
                    <span className="bg-purple-950 text-purple-300 border border-purple-500/30 text-[9px] font-black px-1.5 py-0.2 rounded">
                      You
                    </span>
                  )}
                  <span className="text-[10px] text-neutral-500">
                    {msg.timestamp}
                  </span>
                </div>

                <div className="mt-1 p-3 rounded-2xl bg-[#141c2c] border border-neutral-800/80 text-xs text-neutral-200 leading-relaxed max-w-2xl break-words">
                  {msg.text}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. CONTROLS & INPUT FORM */}
      <div className="space-y-3">
        {/* Auto-scroll toggle bar */}
        <div className="flex items-center justify-between text-[11px] text-neutral-500 px-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input 
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-purple-600 rounded"
            />
            <span>Auto-scroll to latest messages</span>
          </label>
          <span className="hidden sm:inline">Supports markdown & emojis</span>
        </div>

        {/* Quick Reactions Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[11px] text-neutral-400 font-semibold shrink-0 mr-1">
            Quick React:
          </span>
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleReactionClick(emoji)}
              className="px-2.5 py-1 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs transition-colors cursor-pointer shrink-0"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSendMessage} className="space-y-2">
          {/* Posting As row */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-400 font-semibold whitespace-nowrap">
              Posting as:
            </span>
            <input 
              type="text"
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                localStorage.setItem('anidub_guest_chat_name', e.target.value);
              }}
              className="bg-[#182032] border border-neutral-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary-theme w-36 sm:w-44"
              placeholder="Guest nickname"
            />
            <button
              type="button"
              onClick={handleRandomizeName}
              className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
              title="Generate random anime fan nickname"
            >
              <Dices className="w-3.5 h-3.5 text-amber-400" />
              <span>Randomize</span>
            </button>
          </div>

          {/* Message Input & Send Button */}
          <div className="flex gap-2">
            <input 
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message about regional Indian dubs..."
              className="flex-1 bg-[#182032] border border-neutral-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-primary-theme"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </div>
        </form>
      </div>

    </div>
  );
};
