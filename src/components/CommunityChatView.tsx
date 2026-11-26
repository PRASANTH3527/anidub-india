import React, { Suspense } from 'react';
import {
  MessageSquare,
  Compass,
  Flame,
} from 'lucide-react';
import { Button } from './ui/Button';
import { ChatPageSkeleton } from './SkeletonGrid';

const LiveChat = React.lazy(() => import('./LiveChat').then(m => ({ default: m.LiveChat })));

interface CommunityChatViewProps {
  onNavigateToCatalog: () => void;
  onSelectAnime?: (anime: any) => void;
}

export const CommunityChatView: React.FC<CommunityChatViewProps> = ({
  onNavigateToCatalog,
}) => {
  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 overflow-x-clip box-border animate-in fade-in duration-200">
      {/* 1. HEADER BANNER */}
      <div className="bg-[#12141E] border border-[#292B39] rounded-[12px] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-3.5 relative z-10 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-[12px] bg-[#191C29] border border-[#292B39] flex items-center justify-center text-[#B49AF8] shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <h1 className="text-lg sm:text-xl font-black text-[#F4F3FA] tracking-tight">
                Live Community Chat
              </h1>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#34D399]/10 border border-[#34D399]/30 text-[#34D399] text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                <span>Global Room</span>
              </div>
            </div>
            <p className="text-xs text-[#A1A5B5] mt-0.5 max-w-2xl leading-relaxed truncate sm:whitespace-normal">
              Live chatter and dub reactions for Hindi, Tamil, Telugu, Malayalam &amp; Kannada anime.
            </p>
          </div>
        </div>

        {/* Back to Catalog Action Button */}
        <div className="relative z-10 shrink-0 self-start md:self-center">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onNavigateToCatalog}
            leftIcon={<Compass className="w-4 h-4 text-[#B49AF8]" />}
            className="text-xs"
          >
            Explore Catalog
          </Button>
        </div>
      </div>

      {/* 2. MAIN GRID: CHAT ROOM + COMMUNITY SIDEBAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT / CENTER: FULL LIVE CHAT COMPONENT */}
        <div className="lg:col-span-8 space-y-4 min-w-0">
          <Suspense fallback={<ChatPageSkeleton />}>
            <LiveChat className="w-full" />
          </Suspense>
        </div>

        {/* RIGHT: DUB CHANNELS, TOPICS & RULES SIDEBAR */}
        <div className="lg:col-span-4 space-y-4 min-w-0">
          {/* Active Dub Topics Box */}
          <div className="bg-[#12141E] border border-[#292B39] rounded-[12px] p-5 space-y-3.5">
            <div className="flex items-center gap-2 pb-2 border-b border-[#292B39]">
              <Flame className="w-4 h-4 text-[#F9C876]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-[#F4F3FA]">
                Trending Dub Topics
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                '#SoloLevelingHindi',
                '#JujutsuKaisenTamil',
                '#DemonSlayerTelugu',
                '#BleachMalayalam',
                '#CrunchyrollIndia',
                '#JioHotstarAnime',
              ].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-[10px] bg-[#191C29] border border-[#292B39] text-[#B49AF8] font-semibold"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-[#12141E] border border-[#292B39] rounded-[12px] p-4 text-xs text-[#A1A5B5] space-y-2 leading-relaxed">
            <span className="font-bold text-[#F4F3FA] block">Community Etiquette</span>
            <ul className="list-disc pl-4 space-y-1">
              <li>Respect voice actors and dubbing studios across all regional languages.</li>
              <li>Use the Spoiler tag before discussing major plot twists.</li>
              <li>Keep discussions constructive, friendly, and welcoming to anime fans.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
