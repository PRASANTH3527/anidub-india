import React, { useState } from 'react';
import { X, Play, Tv, Sparkles, CloudLightning, MessageSquare, Send } from 'lucide-react';

interface WatchPlayerModalProps {
  anime: any;
  episode: any;
  onClose: () => void;
  onSelectEpisode: (ep: any) => void;
}

export const WatchPlayerModal: React.FC<WatchPlayerModalProps> = ({
  anime,
  episode,
  onClose,
  onSelectEpisode
}) => {
  const [quality, setQuality] = useState('1080p 60FPS');
  const [liveChatMsg, setLiveChatMsg] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { user: 'CloudNode_X', text: 'This scene is absolute cinema 🔥' },
    { user: 'Akira_99', text: 'Cloudflare edge streaming is butter smooth!' },
    { user: 'SoraOtaku', text: 'Best animation season so far' },
  ]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveChatMsg.trim()) return;
    setChatMessages(prev => [...prev, { user: 'You', text: liveChatMsg }]);
    setLiveChatMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-lg flex flex-col overflow-hidden">
      
      {/* Top Header */}
      <div className="h-16 border-b border-slate-800 bg-slate-950 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white font-bold">
            <CloudLightning className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white font-['Space_Grotesk',sans-serif]">{anime.title}</h2>
            <div className="text-[11px] text-orange-400 font-medium">
              Episode {episode.episode_number}: {episode.title}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
            <span>Quality:</span>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="bg-transparent text-orange-400 font-bold focus:outline-none cursor-pointer"
            >
              <option value="4K HDR" className="bg-slate-900">4K HDR (Cloudflare Edge Stream)</option>
              <option value="1080p 60FPS" className="bg-slate-900">1080p 60FPS</option>
              <option value="720p HD" className="bg-slate-900">720p HD</option>
            </select>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Player & Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Video Player */}
        <div className="flex-1 bg-black flex flex-col justify-center relative group">
          <div className="relative w-full aspect-video max-h-[80vh] flex items-center justify-center bg-slate-950">
            <video
              key={episode.id}
              controls
              autoPlay
              src={episode.video_url || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"}
              className="w-full h-full object-contain shadow-2xl"
              poster={episode.thumbnail_url || anime.cover_image}
            />
          </div>

          <div className="p-4 bg-slate-950 border-t border-slate-900 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">{episode.title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{episode.synopsis}</p>
            </div>
            <div className="flex items-center space-x-2 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/30 px-3 py-1.5 rounded-lg">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cloudflare CDN Stream Active</span>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Episodes Playlist & Live Chat */}
        <div className="w-full lg:w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full">
          
          {/* Playlist header */}
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
              <Tv className="w-4 h-4 text-orange-400" />
              <span>Episodes Playlist ({anime.episodes?.length || 0})</span>
            </h3>
          </div>

          {/* Episodes List */}
          <div className="max-h-60 overflow-y-auto p-3 space-y-2 border-b border-slate-800 scrollbar-thin">
            {anime.episodes?.map((ep: any) => {
              const isCurrent = ep.id === episode.id;
              return (
                <div
                  key={ep.id}
                  onClick={() => onSelectEpisode(ep)}
                  className={`flex items-center space-x-3 p-2.5 rounded-xl cursor-pointer transition-all border ${
                    isCurrent
                      ? 'bg-orange-600/20 border-orange-500 text-orange-400'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="w-12 h-9 rounded-lg overflow-hidden bg-slate-950 flex-shrink-0 relative">
                    <img src={ep.thumbnail_url || anime.cover_image} alt={ep.title} className="w-full h-full object-cover" />
                    {isCurrent && (
                      <div className="absolute inset-0 bg-orange-600/50 flex items-center justify-center">
                        <Play className="w-3 h-3 text-white fill-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">Ep {ep.episode_number}: {ep.title}</div>
                    <div className="text-[10px] text-slate-400">{ep.duration}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Sync Chat */}
          <div className="flex-1 flex flex-col p-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center space-x-2">
              <MessageSquare className="w-3.5 h-3.5 text-orange-400" />
              <span>Cloudflare Workers Live Chat</span>
            </h3>

            <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2.5 overflow-y-auto mb-3 scrollbar-thin">
              {chatMessages.map((msg, i) => (
                <div key={i} className="text-xs">
                  <span className="font-bold text-orange-400 mr-2">{msg.user}:</span>
                  <span className="text-slate-300">{msg.text}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Send a live chat message..."
                value={liveChatMsg}
                onChange={(e) => setLiveChatMsg(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                className="p-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};
