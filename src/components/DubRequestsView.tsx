import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  ThumbsUp, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Flame,
  Globe2,
  Tv
} from 'lucide-react';
import { 
  DUB_REQUEST_LANGUAGES, 
  type DubRequestItem, 
  type DubRequestLanguage,
  sortAndFilterDubRequests,
  readVotedDubRequestIds,
  markDubRequestVotedLocally
} from '../utils/dubRequests';
import { cloudflareApi } from '../services/cloudflareApi';

interface DubRequestsViewProps {
  onNavigate?: (tab: string) => void;
  onOpenCatalog?: () => void;
}

export const DubRequestsView: React.FC<DubRequestsViewProps> = ({ onNavigate, onOpenCatalog }) => {
  const [requests, setRequests] = useState<DubRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [votedIds, setVotedIds] = useState<number[]>([]);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [animeTitleInput, setAnimeTitleInput] = useState('');
  const [languageInput, setLanguageInput] = useState<DubRequestLanguage>('Tamil');
  const [honeypotWebsite, setHoneypotWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await cloudflareApi.fetchDubRequests(selectedLanguage === 'All' ? undefined : selectedLanguage);
      if (res.success && Array.isArray(res.data)) {
        const localVoted = readVotedDubRequestIds();
        setVotedIds(localVoted);
        const marked = res.data.map((item) => ({
          ...item,
          hasVoted: localVoted.includes(item.id) || item.hasVoted,
        }));
        setRequests(marked);
      } else {
        setError(res.error || 'Failed to load dub requests leaderboard.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error loading dub requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [selectedLanguage]);

  const handleVote = async (requestId: number) => {
    if (votedIds.includes(requestId)) return;
    try {
      const res = await cloudflareApi.voteOrSubmitDubRequest({ requestId });
      if (res.success && res.request) {
        const nextVoted = markDubRequestVotedLocally(requestId);
        setVotedIds(nextVoted);
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...res.request!, hasVoted: true } : r))
        );
      } else {
        alert(res.error || 'Failed to record vote.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error recording vote.');
    }
  };

  const handleNewRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);
    setSubmitSuccessMsg(null);

    if (!animeTitleInput.trim()) {
      setSubmitError('Please enter an anime title.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await cloudflareApi.voteOrSubmitDubRequest({
        animeTitle: animeTitleInput.trim(),
        language: languageInput,
        website: honeypotWebsite, // honeypot
      });

      if (res.success && res.request) {
        const createdId = res.request.id;
        const nextVoted = markDubRequestVotedLocally(createdId);
        setVotedIds(nextVoted);
        setSubmitSuccessMsg(res.mergedExisting ? 'Your request was merged into existing demand and upvoted!' : 'Dub request submitted and upvoted successfully!');
        setAnimeTitleInput('');
        setHoneypotWebsite('');
        setTimeout(() => {
          setIsModalOpen(false);
          setSubmitSuccessMsg(null);
          loadRequests();
        }, 1200);
      } else {
        setSubmitError(res.error || 'Failed to submit dub request.');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Network error submitting request.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRequests = sortAndFilterDubRequests(requests, {
    language: selectedLanguage,
    search: searchQuery,
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24 pt-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900/40 via-indigo-950/50 to-slate-900 border border-purple-500/20 p-6 sm:p-8 mb-8 shadow-2xl">
          <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
            <Megaphone className="w-64 h-64 text-purple-400" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-3">
                <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" /> Public Demand Dashboard
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
                Indian Dub Requests Leaderboard
              </h1>
              <p className="text-slate-300 text-sm sm:text-base max-w-2xl">
                Vote for the anime series you want officially dubbed in Tamil, Hindi, Telugu, Malayalam, or Kannada. Help streaming platforms prioritize fan demand!
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-purple-600/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-sm sm:text-base"
            >
              <Plus className="w-5 h-5" /> Request a Dub
            </button>
          </div>
        </div>

        {/* Filters & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg backdrop-blur-md">
          {/* Language Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedLanguage('All')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                selectedLanguage === 'All'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              All Languages
            </button>
            {DUB_REQUEST_LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  selectedLanguage === lang
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {lang} Dub
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search requested anime..."
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all"
            />
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-36 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-950/30 border border-rose-800/50 rounded-2xl p-8 text-center max-w-xl mx-auto">
            <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-rose-200 mb-1">Failed to Load Leaderboard</h3>
            <p className="text-slate-400 text-sm mb-4">{error}</p>
            <button
              onClick={loadRequests}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium transition-all"
            >
              Try Again
            </button>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center max-w-xl mx-auto">
            <Megaphone className="w-12 h-12 text-purple-400/60 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-200 mb-1">No Dub Requests Found</h3>
            <p className="text-slate-400 text-sm mb-6">
              {searchQuery || selectedLanguage !== 'All'
                ? 'No requests match your current filters.'
                : 'Be the first fan to request an anime dub for the Indian community!'}
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-all"
            >
              <Plus className="w-4 h-4" /> Submit First Request
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRequests.map((item, index) => {
              const rank = index + 1;
              const isTopThree = rank <= 3;
              return (
                <div
                  key={item.id}
                  className={`relative group bg-slate-900/70 border rounded-2xl p-5 transition-all hover:border-purple-500/50 hover:bg-slate-900 shadow-lg flex flex-col justify-between ${
                    isTopThree ? 'border-purple-500/30 bg-gradient-to-b from-purple-950/20 to-slate-900/80' : 'border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            rank === 1
                              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                              : rank === 2
                              ? 'bg-slate-300 text-slate-950 shadow-md'
                              : rank === 3
                              ? 'bg-amber-700 text-white shadow-md'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          #{rank}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
                          {item.language} Dub
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-purple-400 text-xs font-medium">
                        <Flame className="w-3.5 h-3.5 text-orange-400" />
                        <span>{item.vote_count} votes</span>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors mb-2 line-clamp-2">
                      {item.anime_title}
                    </h3>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Community Demand Rank #{rank}
                    </span>
                    <button
                      onClick={() => handleVote(item.id)}
                      disabled={item.hasVoted}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                        item.hasVoted
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-default'
                          : 'bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 text-purple-200 hover:text-white shadow-sm'
                      }`}
                    >
                      {item.hasVoted ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Voted
                        </>
                      ) : (
                        <>
                          <ThumbsUp className="w-3.5 h-3.5" /> Upvote
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal for Requesting a Dub */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Request an Anime Dub</h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white text-xl font-bold p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  &times;
                </button>
              </div>

              <p className="text-slate-400 text-xs sm:text-sm mb-6">
                Tell the community and streaming platforms which anime series you want to see dubbed in Indian regional languages.
              </p>

              {submitError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
                  {submitError}
                </div>
              )}

              {submitSuccessMsg && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{submitSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleNewRequestSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Anime Title <span className="text-purple-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={animeTitleInput}
                    onChange={(e) => setAnimeTitleInput(e.target.value)}
                    placeholder="e.g. Vinland Saga, Monster, Haikyu!!"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Target Indian Language <span className="text-purple-400">*</span>
                  </label>
                  <select
                    value={languageInput}
                    onChange={(e) => setLanguageInput(e.target.value as DubRequestLanguage)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500 transition-all"
                  >
                    {DUB_REQUEST_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang} Dub
                      </option>
                    ))}
                  </select>
                </div>

                {/* Honeypot field (hidden from real users) */}
                <div className="hidden" aria-hidden="true">
                  <label>Website</label>
                  <input
                    type="text"
                    value={honeypotWebsite}
                    onChange={(e) => setHoneypotWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit & Upvote'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
