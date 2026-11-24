import React, { useEffect, useMemo, useState } from 'react';
import {
  Megaphone,
  ThumbsUp,
  Plus,
  Search,
  Check,
  X,
  Trophy,
  Radio,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { cloudflareApi } from '../services/cloudflareApi';
import {
  DUB_REQUEST_LANGUAGES,
  markDubRequestVotedLocally,
  readVotedDubRequestIds,
  sortAndFilterDubRequests,
  type DubRequestItem,
  type DubRequestLanguage,
} from '../utils/dubRequests';

interface DubRequestsViewProps {
  catalogList: any[];
  onNavigateRadar?: () => void;
}

const LANG_BADGE_CLASSES: Record<DubRequestLanguage, string> = {
  Hindi: 'bg-purple-500/15 text-purple-300 border-purple-500/35',
  Tamil: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
  Telugu: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35',
  Malayalam: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  Kannada: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
};

export const DubRequestsView: React.FC<DubRequestsViewProps> = ({
  catalogList,
  onNavigateRadar,
}) => {
  const [requests, setRequests] = useState<DubRequestItem[]>([]);
  const [votedIds, setVotedIds] = useState<number[]>(() => readVotedDubRequestIds());
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [votingId, setVotingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(
    null
  );

  // Request a Dub modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAnimeId, setNewAnimeId] = useState<number | null>(null);
  const [newLanguage, setNewLanguage] = useState<DubRequestLanguage>('Tamil');
  const [honeypotWebsite, setHoneypotWebsite] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const showNotice = (type: 'success' | 'info' | 'error', text: string) => {
    setNotice({ type, text });
    window.setTimeout(() => {
      setNotice((curr) => (curr?.text === text ? null : curr));
    }, 4000);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cloudflareApi
      .fetchDubRequests()
      .then((res) => {
        if (cancelled) return;
        setRequests(res.data || []);
        const mergedVoted = Array.from(
          new Set([...readVotedDubRequestIds(), ...(res.votedRequestIds || [])])
        );
        setVotedIds(mergedVoted);
      })
      .catch(() => {
        if (!cancelled) setRequests([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const votedSet = useMemo(() => new Set(votedIds), [votedIds]);

  const rankedRequests = useMemo(() => {
    const hydrated = requests.map((item) => ({
      ...item,
      hasVoted: Boolean(item.hasVoted || votedSet.has(item.id)),
    }));
    return sortAndFilterDubRequests(hydrated, {
      language: selectedLanguage,
      search: searchQuery,
    });
  }, [requests, votedSet, selectedLanguage, searchQuery]);

  const totalVotesCast = useMemo(
    () => requests.reduce((sum, r) => sum + (Number(r.vote_count) || 0), 0),
    [requests]
  );

  // Quick title suggestions from loaded catalog for the Request modal
  const titleSuggestions = useMemo(() => {
    const q = newTitle.trim().toLowerCase();
    if (q.length < 2 || !Array.isArray(catalogList)) return [];
    return catalogList
      .filter((a) => a?.title && String(a.title).toLowerCase().includes(q))
      .slice(0, 5);
  }, [newTitle, catalogList]);

  const handleUpvote = async (item: DubRequestItem) => {
    if (votingId !== null || votedSet.has(item.id)) return;
    setVotingId(item.id);

    try {
      const res = await cloudflareApi.voteOrSubmitDubRequest({ requestId: item.id });
      if (res.success && res.request) {
        const nextVoted = markDubRequestVotedLocally(item.id);
        setVotedIds((prev) => Array.from(new Set([...prev, ...nextVoted, item.id])));
        setRequests((prev) =>
          prev.map((row) =>
            row.id === item.id
              ? { ...row, vote_count: res.request.vote_count, hasVoted: true }
              : row
          )
        );
        showNotice('success', `Upvoted ${item.anime_title} (${item.language} Dub)!`);
      } else if (res.alreadyVoted) {
        const nextVoted = markDubRequestVotedLocally(item.id);
        setVotedIds((prev) => Array.from(new Set([...prev, ...nextVoted, item.id])));
        showNotice('info', res.error || 'You already voted for this dub request.');
      } else {
        showNotice('error', res.error || 'Could not record vote right now.');
      }
    } finally {
      setVotingId(null);
    }
  };

  const handleSubmitNewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const trimmedTitle = newTitle.trim();
    if (trimmedTitle.length < 2) {
      setModalError('Please enter an anime title (at least 2 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await cloudflareApi.voteOrSubmitDubRequest({
        animeTitle: trimmedTitle,
        animeId: newAnimeId,
        language: newLanguage,
        website: honeypotWebsite,
      });

      if (res.success && res.request) {
        const reqItem: DubRequestItem = res.request;
        const nextVoted = markDubRequestVotedLocally(reqItem.id);
        setVotedIds((prev) => Array.from(new Set([...prev, ...nextVoted, reqItem.id])));
        setRequests((prev) => {
          const exists = prev.some((r) => r.id === reqItem.id);
          if (exists) {
            return prev.map((r) => (r.id === reqItem.id ? { ...r, ...reqItem, hasVoted: true } : r));
          }
          return [{ ...reqItem, hasVoted: true }, ...prev];
        });
        setIsModalOpen(false);
        setNewTitle('');
        setNewAnimeId(null);
        setHoneypotWebsite('');
        showNotice(
          'success',
          res.mergedExisting
            ? `Added your vote to the existing ${reqItem.anime_title} (${reqItem.language}) request!`
            : `Submitted ${reqItem.anime_title} for ${reqItem.language} Dub demand leaderboard!`
        );
      } else if (res.alreadyVoted) {
        if (res.request?.id) {
          markDubRequestVotedLocally(res.request.id);
          setVotedIds((prev) => Array.from(new Set([...prev, res.request.id])));
        }
        setModalError(res.error || 'You already voted for this anime & language.');
      } else {
        setModalError(res.error || 'Failed to submit dub request.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="dub-requests-view"
      className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 box-border"
    >
      {/* HERO HEADER */}
      <section className="rounded-3xl bg-gradient-to-br from-[#14172a] via-[#101524] to-[#1a1228] border border-white/10 p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-20 -right-16 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[11px] font-black uppercase tracking-wider">
              <Megaphone className="w-3.5 h-3.5" />
              <span>Public Demand Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-white tracking-tight">
              Indian Dub Requests
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              Vote for the anime you want officially dubbed in Tamil, Hindi, Telugu, Malayalam, or Kannada. One verified vote per user/device keeps demand rankings genuine.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setModalError(null);
                setIsModalOpen(true);
              }}
              data-testid="open-request-dub-modal"
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 text-xs font-black inline-flex items-center gap-2 shadow-lg shadow-amber-950/40 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Request a Dub</span>
            </button>

            {onNavigateRadar && (
              <button
                type="button"
                onClick={onNavigateRadar}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-neutral-200 text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Radio className="w-4 h-4 text-purple-400" />
                <span>Dub Radar</span>
              </button>
            )}
          </div>
        </div>

        {/* QUICK METRICS */}
        <div className="relative z-10 mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center gap-4 text-xs text-neutral-300">
          <div className="inline-flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>
              <strong className="text-white tabular-nums">{requests.length}</strong> requested dubs
            </span>
          </div>
          <span className="text-neutral-600">•</span>
          <div className="inline-flex items-center gap-2">
            <ThumbsUp className="w-4 h-4 text-purple-400" />
            <span>
              <strong className="text-white tabular-nums">{totalVotesCast}</strong> community votes
            </span>
          </div>
        </div>
      </section>

      {/* FEEDBACK NOTICE */}
      {notice && (
        <div
          role="status"
          className={`rounded-2xl px-4 py-3 border text-xs font-bold flex items-center justify-between gap-3 ${
            notice.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-200'
              : notice.type === 'info'
                ? 'bg-sky-500/15 border-sky-500/35 text-sky-200'
                : 'bg-rose-500/15 border-rose-500/35 text-rose-200'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"
            aria-label="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* LANGUAGE FILTER & SEARCH */}
      <section className="rounded-2xl bg-[#101524] border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {['All', ...DUB_REQUEST_LANGUAGES].map((lang) => {
            const active = selectedLanguage === lang;
            return (
              <button
                key={lang}
                type="button"
                onClick={() => setSelectedLanguage(lang)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  active
                    ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                    : 'bg-white/[0.03] text-neutral-300 border-white/10 hover:border-white/25 hover:text-white'
                }`}
              >
                {lang === 'All' ? 'All Languages' : lang}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search requested anime..."
            aria-label="Search requested anime"
            className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-400"
          />
        </div>
      </section>

      {/* RANKED LEADERBOARD */}
      {loading ? (
        <div className="rounded-3xl bg-[#101524] border border-white/10 p-12 flex flex-col items-center justify-center gap-3 text-neutral-400">
          <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
          <span className="text-xs font-medium">Loading Dub Request Leaderboard...</span>
        </div>
      ) : rankedRequests.length === 0 ? (
        <div className="rounded-3xl bg-[#101524] border border-white/10 p-10 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-base font-black text-white">No dub requests yet for this filter</h2>
            <p className="text-xs text-neutral-400">
              Be the first fan to request an Indian dub and kick off the community vote!
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setModalError(null);
              setIsModalOpen(true);
            }}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 text-xs font-black inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Request a Dub</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rankedRequests.map((item, idx) => {
            const rank = idx + 1;
            const hasVoted = Boolean(item.hasVoted || votedSet.has(item.id));
            const isVotingThis = votingId === item.id;
            const rankBadgeClass =
              rank === 1
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                : rank === 2
                  ? 'bg-slate-300/15 text-slate-200 border-slate-300/35'
                  : rank === 3
                    ? 'bg-orange-500/20 text-orange-300 border-orange-400/45'
                    : 'bg-white/[0.04] text-neutral-400 border-white/10';

            return (
              <div
                key={item.id}
                className="rounded-2xl bg-[#101524] border border-white/10 hover:border-purple-500/35 px-4 py-3.5 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center font-heading font-black text-xs shrink-0 tabular-nums ${rankBadgeClass}`}
                  >
                    #{rank}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <h2 className="text-sm sm:text-base font-bold text-white truncate">
                      {item.anime_title}
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${
                          LANG_BADGE_CLASSES[item.language] ||
                          'bg-white/10 text-neutral-200 border-white/15'
                        }`}
                      >
                        {item.language} Dub
                      </span>
                      <span className="text-[11px] text-neutral-400 tabular-nums">
                        {item.vote_count} {item.vote_count === 1 ? 'vote' : 'votes'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={hasVoted || isVotingThis}
                  onClick={() => void handleUpvote(item)}
                  aria-label={
                    hasVoted
                      ? `Voted for ${item.anime_title} in ${item.language}`
                      : `Upvote ${item.anime_title} in ${item.language}`
                  }
                  className={`min-h-[44px] px-3.5 sm:px-4 py-2 rounded-xl border text-xs font-black inline-flex items-center gap-2 shrink-0 transition-all tabular-nums ${
                    hasVoted
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 cursor-default'
                      : 'bg-purple-600/20 hover:bg-purple-600/35 border-purple-500/40 text-purple-200 hover:text-white cursor-pointer active:scale-95'
                  }`}
                >
                  {isVotingThis ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : hasVoted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <ThumbsUp className="w-4 h-4" />
                  )}
                  <span>{hasVoted ? 'Voted' : 'Upvote'}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-black/30 text-[11px]">
                    {item.vote_count}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* REQUEST A DUB MODAL */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Request a Dub"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <div className="w-full max-w-md rounded-3xl bg-[#111728] border border-white/15 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-heading font-black text-white">Request an Indian Dub</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Submit an anime & language to add or boost it on the public demand board.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close request modal"
                className="min-w-[40px] min-h-[40px] rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewRequest} className="space-y-4">
              {/* Honeypot field hidden from human users */}
              <div className="hidden" aria-hidden="true">
                <label htmlFor="dub-req-website">Website</label>
                <input
                  id="dub-req-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypotWebsite}
                  onChange={(e) => setHoneypotWebsite(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="dub-request-title-input"
                  className="text-xs font-bold text-neutral-200 block"
                >
                  Anime Title
                </label>
                <input
                  id="dub-request-title-input"
                  type="text"
                  required
                  maxLength={120}
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    setNewAnimeId(null);
                  }}
                  placeholder="e.g. Monster, Vinland Saga, Bleach: TYBW..."
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-purple-400"
                />

                {titleSuggestions.length > 0 && newAnimeId === null && (
                  <div className="rounded-xl bg-[#0b101d] border border-white/10 divide-y divide-white/5 overflow-hidden">
                    {titleSuggestions.map((anime: any) => (
                      <button
                        key={anime.id}
                        type="button"
                        onClick={() => {
                          setNewTitle(String(anime.title));
                          setNewAnimeId(Number(anime.id) || null);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-neutral-200 hover:bg-purple-600/20 flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span className="truncate">{anime.title}</span>
                        <span className="text-[10px] text-neutral-500 shrink-0">In catalog</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-neutral-200 block">Requested Dub Language</span>
                <div className="grid grid-cols-3 gap-2">
                  {DUB_REQUEST_LANGUAGES.map((lang) => {
                    const active = newLanguage === lang;
                    return (
                      <button
                        key={`modal_lang_${lang}`}
                        type="button"
                        onClick={() => setNewLanguage(lang)}
                        className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          active
                            ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                            : 'bg-black/40 text-neutral-300 border-white/10 hover:border-white/25'
                        }`}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </div>

              {modalError && (
                <p className="text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
                  {modalError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 text-xs font-black inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                  <span>Submit &amp; Vote</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
