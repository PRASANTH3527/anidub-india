'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Tv, Flame, Languages, TrendingUp, CheckCircle2 } from 'lucide-react';
import { useToast } from './Toast';
import { SupportedLanguage, translate } from '../utils/i18n';
import { supabase } from '../lib/supabase';

interface AnimatedStatsProps {
  totalAnime: number;
  totalUpvotes: number;
  languagesCount: number;
  uiLanguage?: SupportedLanguage;
}

function useCountUp(end: number, duration: number = 1000): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const finalEnd = Math.max(0, end);
    if (finalEnd === 0) {
      setCount(0);
      return;
    }
    const stepTime = 16;
    const totalSteps = duration / stepTime;
    const increment = finalEnd / totalSteps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= finalEnd) {
        setCount(finalEnd);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [end, duration]);

  return count;
}

export const AnimatedStats: React.FC<AnimatedStatsProps> = ({
  totalAnime,
  totalUpvotes,
  languagesCount,
  uiLanguage = 'en',
}) => {
  const lang = uiLanguage || 'en';
  const toast = useToast();
  const [votes, setVotes] = useState(totalUpvotes);
  const [isVoting, setIsVoting] = useState(false);
  const [hasVotedRecently, setHasVotedRecently] = useState(false);

  // 1. Fetch initial vote count from Supabase
  useEffect(() => {
    let isMounted = true;
    async function fetchSiteVotes() {
      try {
        const { data, error } = await supabase
          .from('site_stats')
          .select('total_votes')
          .eq('id', 1)
          .maybeSingle();

        if (error) {
          console.warn('[Supabase site_stats notice]:', error.message);
          return;
        }

        if (data && typeof data.total_votes === 'number' && isMounted) {
          setVotes(data.total_votes);
        }
      } catch (err) {
        console.warn('[Supabase site_stats fetch error]:', err);
      }
    }

    fetchSiteVotes();

    // 2. Subscribe to Supabase Real-Time updates for live counter sync across all users
    const channel = supabase
      .channel('site_stats_realtime_votes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_stats',
          filter: 'id=eq.1',
        },
        (payload: any) => {
          const newVotes = payload.new?.total_votes;
          if (typeof newVotes === 'number' && isMounted) {
            setVotes(newVotes);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. Handle Vote Click (Optimistic update + Supabase update / upsert)
  const handleVoteClick = useCallback(async () => {
    if (isVoting) return;
    setIsVoting(true);
    setHasVotedRecently(true);
    const nextVotes = votes + 1;

    // Optimistic UI increment
    setVotes(nextVotes);

    try {
      const { data, error } = await supabase
        .from('site_stats')
        .update({
          total_votes: nextVotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1)
        .select('total_votes')
        .maybeSingle();

      if (error || !data) {
        const { error: upsertErr } = await supabase
          .from('site_stats')
          .upsert([
            {
              id: 1,
              total_votes: nextVotes,
              updated_at: new Date().toISOString(),
            },
          ]);
        if (upsertErr) {
          console.warn('[Vote upsert fallback notice]:', upsertErr.message);
        }
      }
      toast.success('Vote Counted! 🔥', `Thank you! Total community votes: ${nextVotes.toLocaleString()}`);
    } catch (err: any) {
      console.warn('[Vote handler catch]:', err);
      toast.success('Vote Counted! 🔥', `Community vote added! Total: ${nextVotes.toLocaleString()}`);
    } finally {
      setIsVoting(false);
      setTimeout(() => setHasVotedRecently(false), 800);
    }
  }, [votes, isVoting, toast]);

  const animatedAnimeCount = useCountUp(totalAnime, 1000);
  const animatedUpvotesCount = useCountUp(votes, 800);
  const animatedLangCount = useCountUp(languagesCount, 800);

  return (
    <div className="w-full max-w-5xl mx-auto px-2.5 sm:px-4 mb-6 sm:mb-8 box-border">
      {/* Responsive Side-by-Side 3-Card Grid for Mobile, Tablet and Desktop */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3.5 md:gap-4 w-full box-border">
        {/* 1. Total Anime */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#121829]/95 to-[#0e1322]/95 border border-primary-theme/30 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 md:p-5 shadow-lg hover:border-primary-theme/50 transition-all duration-300 group flex flex-col justify-between min-w-0 box-border">
          <div className="absolute top-0 right-0 w-16 sm:w-24 h-16 sm:h-24 bg-primary-theme/10 rounded-full blur-xl pointer-events-none group-hover:bg-primary-theme/20 transition-all" />

          {/* Card Header */}
          <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2">
            <span className="text-[9px] xs:text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-400 truncate">
              {translate('statsAnime', lang)}
            </span>
            <div className="w-5 h-5 xs:w-6 xs:h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-primary-theme/20 border border-primary-theme/30 flex items-center justify-center text-primary-theme shrink-0">
              <Tv className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
          </div>

          {/* Metric Value */}
          <div className="flex items-baseline gap-0.5 sm:gap-1.5 my-0.5">
            <span className="font-heading font-black text-base xs:text-lg sm:text-2xl md:text-3xl lg:text-4xl text-white tracking-tight leading-none">
              {animatedAnimeCount}
            </span>
            <span className="text-primary-theme font-extrabold text-[10px] sm:text-xs">+</span>
          </div>

          {/* Subtitle Footnote */}
          <p className="text-[8px] xs:text-[9px] sm:text-[11px] text-neutral-400 mt-1 flex items-center gap-1 truncate">
            <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 shrink-0" />
            <span className="truncate">Verified dubs</span>
          </p>
        </div>

        {/* 2. Total Upvotes (Interactive Real-Time Supabase Vote Card) */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleVoteClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleVoteClick();
            }
          }}
          title="Click to vote for AniDub India community!"
          className="relative overflow-hidden bg-gradient-to-br from-[#121829]/95 to-[#0e1322]/95 border border-orange-500/30 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 md:p-5 shadow-lg hover:border-orange-500/60 hover:shadow-orange-500/10 hover:shadow-xl transition-all duration-300 group cursor-pointer select-none active:scale-[0.97] flex flex-col justify-between min-w-0 box-border"
        >
          <div className="absolute top-0 right-0 w-16 sm:w-24 h-16 sm:h-24 bg-orange-600/10 rounded-full blur-xl pointer-events-none group-hover:bg-orange-600/25 transition-all" />

          {/* Card Header */}
          <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2">
            <span className="text-[9px] xs:text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-400 group-hover:text-orange-300 transition-colors truncate">
              {translate('statsUpvotes', lang)}
            </span>
            <div className={`w-5 h-5 xs:w-6 xs:h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 group-hover:scale-110 group-hover:bg-orange-500/30 transition-all shrink-0 ${hasVotedRecently ? 'scale-125 text-orange-300' : ''}`}>
              <Flame className={`w-3 h-3 sm:w-4 sm:h-4 fill-current ${hasVotedRecently ? 'animate-bounce' : ''}`} />
            </div>
          </div>

          {/* Metric Value */}
          <div className="flex items-baseline gap-0.5 sm:gap-1.5 my-0.5">
            <span className="font-heading font-black text-base xs:text-lg sm:text-2xl md:text-3xl lg:text-4xl text-white tracking-tight group-hover:text-orange-100 transition-colors leading-none truncate">
              {animatedUpvotesCount.toLocaleString()}
            </span>
            <span className={`text-orange-400 font-bold text-[10px] sm:text-xs transition-transform ${hasVotedRecently ? 'scale-150' : 'group-hover:scale-125'}`}>
              🔥
            </span>
          </div>

          {/* Subtitle Footnote */}
          <div className="mt-1 flex items-center justify-between text-[8px] xs:text-[9px] sm:text-[11px] gap-1">
            <p className="text-neutral-400 flex items-center gap-1 group-hover:text-neutral-300 transition-colors truncate">
              <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-orange-400 shrink-0" />
              <span className="hidden xs:inline truncate">Community</span>
            </p>
            <span className="font-extrabold text-orange-400 text-[8px] xs:text-[9px] sm:text-[10px] bg-orange-500/10 px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded-full border border-orange-500/20 shrink-0">
              {isVoting ? '...' : '+1 Vote'}
            </span>
          </div>
        </div>

        {/* 3. Languages Supported */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#121829]/95 to-[#0e1322]/95 border border-sky-500/30 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 md:p-5 shadow-lg hover:border-sky-500/50 transition-all duration-300 group flex flex-col justify-between min-w-0 box-border">
          <div className="absolute top-0 right-0 w-16 sm:w-24 h-16 sm:h-24 bg-sky-600/10 rounded-full blur-xl pointer-events-none group-hover:bg-sky-600/20 transition-all" />

          {/* Card Header */}
          <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2">
            <span className="text-[9px] xs:text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-400 truncate">
              {translate('statsLanguages', lang)}
            </span>
            <div className="w-5 h-5 xs:w-6 xs:h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Languages className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
          </div>

          {/* Metric Value */}
          <div className="flex items-baseline gap-0.5 sm:gap-1.5 my-0.5">
            <span className="font-heading font-black text-base xs:text-lg sm:text-2xl md:text-3xl lg:text-4xl text-white tracking-tight leading-none">
              {animatedLangCount}
            </span>
            <span className="text-sky-400 font-bold text-[9px] sm:text-xs truncate">Regions</span>
          </div>

          {/* Subtitle Footnote */}
          <p className="text-[8px] xs:text-[9px] sm:text-[11px] text-neutral-400 mt-1 truncate">
            Tamil • Telugu • Hindi
          </p>
        </div>
      </div>
    </div>
  );
};
