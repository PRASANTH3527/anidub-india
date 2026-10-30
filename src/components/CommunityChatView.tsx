import React from 'react';
import { 
  MessageSquare, 
  Radio, 
  Sparkles, 
  Compass, 
  Users, 
  ShieldCheck, 
  Volume2, 
  Flame, 
  Database,
  ArrowRight
} from 'lucide-react';
import { LiveChat } from './LiveChat';

interface CommunityChatViewProps {
  onNavigateToCatalog: () => void;
  onSelectAnime?: (anime: any) => void;
}

export const CommunityChatView: React.FC<CommunityChatViewProps> = ({
  onNavigateToCatalog
}) => {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* 1. HEADER BANNER */}
      <div className="bg-[#121829] border border-purple-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start sm:items-center gap-4 relative z-10">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-900/40 shrink-0 ring-2 ring-purple-400/30">
            <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Live Community Chat
              </h1>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Global Room</span>
              </div>
            </div>
            <p className="text-xs text-neutral-300 mt-1.5 max-w-2xl leading-relaxed">
              Connect and chat in real-time with Indian anime fans discussing Hindi, Tamil, Telugu, Malayalam & Kannada dubs. Share instant dub reviews, cast reactions, and simulcast announcements!
            </p>
          </div>
        </div>

        {/* Back to Catalog Action Button */}
        <div className="relative z-10 shrink-0 self-start md:self-center">
          <button
            type="button"
            onClick={onNavigateToCatalog}
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer hover:border-purple-400/40 shadow-md"
          >
            <Compass className="w-4 h-4 text-purple-400" />
            <span>Explore Catalog</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN GRID: CHAT ROOM + COMMUNITY SIDEBAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT / CENTER: FULL LIVE CHAT COMPONENT */}
        <div className="lg:col-span-8 space-y-4">
          <LiveChat className="w-full" />
        </div>

        {/* RIGHT: DUB CHANNELS, TOPICS & RULES SIDEBAR */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Active Dub Topics Box */}
          <div className="bg-[#121829]/90 border border-white/10 rounded-3xl p-5 shadow-xl space-y-4 backdrop-blur-xl">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <Flame className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Trending Dub Topics
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 font-semibold hover:bg-purple-500/20 cursor-default">
                #SoloLevelingHindi
              </span>
              <span className="px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 font-semibold hover:bg-blue-500/20 cursor-default">
                #JujutsuKaisenTamil
              </span>
              <span className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold hover:bg-emerald-500/20 cursor-default">
                #DemonSlayerTelugu
              </span>
              <span className="px-3 py-1 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-300 font-semibold hover:bg-pink-500/20 cursor-default">
                #BleachMalayalam
              </span>
              <span className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold hover:bg-amber-500/20 cursor-default">
                #CrunchyrollIndia
              </span>
              <span className="px-3 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-semibold hover:bg-indigo-500/20 cursor-default">
                #JioCinemaAnime
              </span>
            </div>
          </div>

          <div className="bg-[#121829]/60 border border-white/5 rounded-3xl p-4 text-[11px] text-neutral-400 space-y-2">
            <span className="font-bold text-neutral-300 block">Community Etiquette</span>
            <ul className="list-disc pl-4 space-y-1">
              <li>Respect voice actors and dubbing studios across all regional languages.</li>
              <li>Please mark or warn before discussing major plot spoilers.</li>
              <li>Keep discussions constructive, friendly, and welcoming to new anime fans.</li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
};
