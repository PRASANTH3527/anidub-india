'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tv, Flame, Languages, CheckCircle2, TrendingUp } from 'lucide-react';
import { SupportedLanguage, translate } from '../utils/i18n';
import { useReducedMotion, useIsMobile } from '../hooks/useMediaQuery';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';

interface AnimatedStatsProps {
  totalAnime: number;
  totalUpvotes?: number;
  languagesCount?: number;
  uiLanguage?: SupportedLanguage;
}

function useCountUp(target: number, duration: number = 1000): number {
  const [count, setCount] = useState(target);
  const isReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const skipAnimation = isReducedMotion || isMobile;
  const prevTargetRef = useRef(target);

  useEffect(() => {
    if (skipAnimation) {
      setCount(target);
      return;
    }

    const startVal = prevTargetRef.current !== target ? count : 0;
    prevTargetRef.current = target;
    const diff = target - startVal;
    if (diff === 0) {
      setCount(target);
      return;
    }

    let startTimestamp: number | null = null;
    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(startVal + diff * easeOut));

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [target, duration, skipAnimation]);

  return count;
}

export const AnimatedStats: React.FC<AnimatedStatsProps> = ({
  totalAnime,
  totalUpvotes = 587,
  languagesCount = 5,
  uiLanguage = 'en',
}) => {
  const lang = uiLanguage || 'en';
  const toast = useToast();

  // Real-time Community Votes State from site_stats (row id: 1)
  const [votes, setVotes] = useState<number>(totalUpvotes || 587);
  const [isVoting, setIsVoting] = useState<boolean>(false);
  const [hasVotedRecently, setHasVotedRecently] = useState<boolean>(false);

  // 1. Fetch initial total_votes from Supabase site_stats table (row id: 1)
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
      // First try updating row id: 1
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
        // If row id: 1 does not exist yet, attempt upsert
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
    <div className="w-full max-w-5xl mx-auto px-4 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        
        {/* 1. Total Anime */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#121829]/95 to-[#0e1322]/95 border border-primary-theme/30 rounded-2xl p-4 sm:p-5 shadow-xl hover:border-primary-theme/50 transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary-theme/10 rounded-full blur-2xl pointer-events-none group-hover:bg-primary-theme/20 transition-all" />
          
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              {translate('statsAnime', lang)}
            </span>
            <div className="w-8 h-8 rounded-xl bg-primary-theme/20 border border-primary-theme/30 flex items-center justify-center text-primary-theme">
              <Tv className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="font-heading font-black text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight">
              {animatedAnimeCount}
            </span>
            <span className="text-primary-theme font-bold text-xs">+</span>
          </div>

          <p className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Verified official dubs</span>
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
          className="relative overflow-hidden bg-gradient-to-br from-[#121829]/95 to-[#0e1322]/95 border border-orange-500/30 rounded-2xl p-4 sm:p-5 shadow-xl hover:border-orange-500/60 hover:shadow-orange-500/10 hover:shadow-2xl transition-all duration-300 group cursor-pointer select-none active:scale-[0.98]"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-600/10 rounded-full blur-2xl pointer-events-none group-hover:bg-orange-600/25 transition-all" />
          
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 group-hover:text-orange-300 transition-colors">
              {translate('statsUpvotes', lang)}
            </span>
            <div className={`w-8 h-8 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 group-hover:scale-110 group-hover:bg-orange-500/30 transition-all ${hasVotedRecently ? 'scale-125 text-orange-300' : ''}`}>
              <Flame className={`w-4 h-4 fill-current ${hasVotedRecently ? 'animate-bounce' : ''}`} />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="font-heading font-black text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight group-hover:text-orange-100 transition-colors">
              {animatedUpvotesCount.toLocaleString()}
            </span>
            <span className={`text-orange-400 font-bold text-xs transition-transform ${hasVotedRecently ? 'scale-150' : 'group-hover:scale-125'}`}>🔥</span>
          </div>

          <div className="mt-1 flex items-center justify-between text-[11px]">
            <p className="text-neutral-400 flex items-center gap-1 group-hover:text-neutral-300 transition-colors">
              <TrendingUp className="w-3 h-3 text-orange-400 shrink-0" />
              <span>Global community likes</span>
            </p>
            <span className="text-[10px] font-bold text-orange-400/80 group-hover:text-orange-300 transition-colors bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
              {isVoting ? 'Voting...' : '+1 Vote'}
            </span>
          </div>
        </div>

        {/* 3. Languages Supported */}
        <div className="col-span-2 md:col-span-1 relative overflow-hidden bg-gradient-to-br from-[#121829]/95 to-[#0e1322]/95 border border-sky-500/30 rounded-2xl p-4 sm:p-5 shadow-xl hover:border-sky-500/50 transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-600/10 rounded-full blur-2xl pointer-events-none group-hover:bg-sky-600/20 transition-all" />
          
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              {translate('statsLanguages', lang)}
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Languages className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="font-heading font-black text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight">
              {animatedLangCount}
            </span>
            <span className="text-sky-400 font-bold text-xs">Regions</span>
          </div>

          <p className="text-[11px] text-neutral-400 mt-1 truncate">
            Tamil • Telugu • Hindi • Mal • Kan
          </p>
        </div>

      </div>
    </div>
  );
};
