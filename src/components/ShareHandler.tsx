'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Share2,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  ArrowLeft,
  Sparkles,
  WifiOff,
  Wifi,
  Search,
  PlusCircle,
  Tv,
  Film,
  Compass,
  AlertCircle
} from 'lucide-react';
import { dbService } from '../services/databaseService';
import { AnimeRecord } from '../types/database';
import DynamicAmbientGlow from './DynamicAmbientGlow';

interface ParsedShareData {
  rawTitle: string;
  rawText: string;
  rawUrl: string;
  detectedTitle: string;
  detectedUrl: string;
  notes: string;
}

export default function ShareHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [parsedData, setParsedData] = useState<ParsedShareData>({
    rawTitle: '',
    rawText: '',
    rawUrl: '',
    detectedTitle: '',
    detectedUrl: '',
    notes: '',
  });

  const [allAnime, setAllAnime] = useState<AnimeRecord[]>([]);
  const [matchedAnime, setMatchedAnime] = useState<AnimeRecord | null>(null);
  const [candidateMatches, setCandidateMatches] = useState<AnimeRecord[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [customAddedTitle, setCustomAddedTitle] = useState<string>('');

  // 1. Monitor network status for PWA offline sync feedback
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOffline(!navigator.onLine);
    };

    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // 2. Load anime records from local database
  useEffect(() => {
    const list = dbService.getApprovedAnime();
    setAllAnime(list);
  }, []);

  // 3. Extract and parse parameters from OS Web Share Target
  useEffect(() => {
    // Read search params or fallback to location.search
    let qTitle = searchParams.get('title') || '';
    let qText = searchParams.get('text') || '';
    let qUrl = searchParams.get('url') || '';

    if (!qTitle && !qText && !qUrl && typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      qTitle = sp.get('title') || '';
      qText = sp.get('text') || '';
      qUrl = sp.get('url') || '';
    }

    // Extract any embedded URLs from text or url param
    let extractedUrl = qUrl.trim();
    let textWithoutUrl = qText;

    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urlMatch = qText.match(urlRegex);
    if (!extractedUrl && urlMatch && urlMatch[0]) {
      extractedUrl = urlMatch[0];
      textWithoutUrl = qText.replace(urlMatch[0], '').trim();
    }

    // Clean up detected title
    let detected = (qTitle || textWithoutUrl || '').trim();
    let notes = '';

    // If the title looks like "Check out [Anime] on Crunchyroll":
    if (detected.toLowerCase().includes('check out') || detected.toLowerCase().includes('watch ')) {
      notes = detected;
      detected = detected
        .replace(/check out/i, '')
        .replace(/watch/i, '')
        .replace(/on (crunchyroll|netflix|jiocinema|youtube)/gi, '')
        .trim();
    }

    // If title is empty but URL contains anime slug:
    if (!detected && extractedUrl) {
      try {
        const parsedObj = new URL(extractedUrl);
        const pathSegments = parsedObj.pathname.split('/').filter(Boolean);
        const lastSegment = pathSegments[pathSegments.length - 1] || '';
        if (lastSegment) {
          detected = decodeURIComponent(lastSegment).replace(/[-_+]/g, ' ');
        }
      } catch {}
    }

    setParsedData({
      rawTitle: qTitle,
      rawText: qText,
      rawUrl: qUrl,
      detectedTitle: detected,
      detectedUrl: extractedUrl,
      notes: notes || qText,
    });
  }, [searchParams]);

  // 4. Match against local AniDub catalogue
  useEffect(() => {
    if (!parsedData.detectedTitle && !parsedData.detectedUrl) return;
    if (allAnime.length === 0) return;

    const searchTarget = parsedData.detectedTitle.toLowerCase();
    const urlTarget = parsedData.detectedUrl.toLowerCase();

    // Check if URL directly references anidub #anime/id or /anime/id
    let directIdMatch: AnimeRecord | undefined;
    if (urlTarget) {
      directIdMatch = allAnime.find(
        (a) => urlTarget.includes(`#anime/${a.id}`) || urlTarget.includes(`/anime/${a.id}`) || a.id.toLowerCase() === searchTarget
      );
    }

    if (directIdMatch) {
      setMatchedAnime(directIdMatch);
      checkIfAlreadyInWatchlist(directIdMatch.id);
      return;
    }

    // Match by exact title
    const exact = allAnime.find((a) => a.title.toLowerCase() === searchTarget);
    if (exact) {
      setMatchedAnime(exact);
      checkIfAlreadyInWatchlist(exact.id);
      return;
    }

    // Fuzzy / Partial Token match
    const searchTokens = searchTarget.split(/\s+/).filter((t) => t.length > 2);
    const candidates = allAnime.filter((a) => {
      const aTitle = a.title.toLowerCase();
      const aRomaji = (a.romajiTitle || '').toLowerCase();
      if (searchTarget.length > 2 && (aTitle.includes(searchTarget) || searchTarget.includes(aTitle))) {
        return true;
      }
      if (searchTokens.length > 0 && searchTokens.some((tok) => aTitle.includes(tok) || aRomaji.includes(tok))) {
        return true;
      }
      return false;
    });

    if (candidates.length > 0) {
      setMatchedAnime(candidates[0]);
      setCandidateMatches(candidates.slice(1, 4));
      checkIfAlreadyInWatchlist(candidates[0].id);
    } else {
      setMatchedAnime(null);
      setCandidateMatches([]);
    }
  }, [parsedData, allAnime]);

  const checkIfAlreadyInWatchlist = (animeId: string) => {
    try {
      const raw = localStorage.getItem('anidub_local_watchlist');
      const ids: string[] = raw ? JSON.parse(raw) : [];
      setIsSaved(ids.includes(animeId));
    } catch {
      setIsSaved(false);
    }
  };

  // 5. Add to Offline Watchlist action (with PWA background sync)
  const handleAddToWatchlist = (anime: AnimeRecord) => {
    const isNowOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    try {
      const raw = localStorage.getItem('anidub_local_watchlist');
      const prevIds: string[] = raw ? JSON.parse(raw) : [];
      if (!prevIds.includes(anime.id)) {
        const nextIds = [...prevIds, anime.id];
        localStorage.setItem('anidub_local_watchlist', JSON.stringify(nextIds));
      }
      setIsSaved(true);

      // Trigger DatabaseService toggle (which fires POST /api/watchlist intercepted by sw.js)
      dbService.toggleWatchlist('guest', anime.id);

      if (isNowOffline) {
        setStatusNotification('Saved Offline — Will sync with cloud when internet connects.');
      } else {
        setStatusNotification(`"${anime.title}" added to your offline watchlist!`);
      }
    } catch (e) {
      console.error('Failed to add to watchlist:', e);
      setStatusNotification('Watchlist updated locally.');
    }
  };

  // 6. Save as Custom Offline Watchlist Item when not in directory
  const handleSaveCustomAnime = () => {
    const title = parsedData.detectedTitle || 'Shared Anime Link';
    const isNowOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const platformName = parsedData.detectedUrl.includes('crunchyroll')
      ? 'Crunchyroll'
      : parsedData.detectedUrl.includes('netflix')
      ? 'Netflix'
      : parsedData.detectedUrl.includes('jio')
      ? 'JioCinema'
      : 'Crunchyroll';

    // Create an offline record so the user never loses their shared link
    const customRecord: AnimeRecord = {
      id: 'custom-' + Date.now().toString(36),
      title: title,
      poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&h=800&fit=crop&q=80',
      synopsis: parsedData.notes || `Shared link: ${parsedData.detectedUrl}`,
      type: 'TV Series',
      releaseYear: new Date().getFullYear(),
      genres: ['Action', 'Adventure'],
      themes: ['Web Share Target'],
      studio: 'Web Share Import',
      characters: [],
      dubDetails: [
        {
          language: 'Hindi',
          available: true,
          platform: [platformName],
        },
      ],
      dubs: ['Hindi', 'Tamil', 'Telugu'],
      status: 'approved',
      submissionStatus: 'approved',
      likes: 1,
      upvotes: 1,
      platforms: [
        {
          name: platformName,
          url: parsedData.detectedUrl || 'https://www.crunchyroll.com',
        },
      ],
      submittedAt: new Date().toISOString(),
    };

    try {
      // Add to local catalogue so it renders in Watchlist tab
      const existing = dbService.getAllAnimeRecords();
      dbService.saveAnimeRecords([customRecord, ...existing]);

      // Add to user's watchlist
      const raw = localStorage.getItem('anidub_local_watchlist');
      const prevIds: string[] = raw ? JSON.parse(raw) : [];
      if (!prevIds.includes(customRecord.id)) {
        localStorage.setItem('anidub_local_watchlist', JSON.stringify([...prevIds, customRecord.id]));
      }

      dbService.toggleWatchlist('guest', customRecord.id);

      setMatchedAnime(customRecord);
      setIsSaved(true);
      setCustomAddedTitle(title);

      if (isNowOffline) {
        setStatusNotification(`Saved "${title}" offline — Will sync once connected.`);
      } else {
        setStatusNotification(`"${title}" saved to your personal offline watchlist!`);
      }
    } catch (e) {
      console.error('Failed to create custom entry:', e);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-neutral-100 py-8 px-4 sm:px-6 flex flex-col items-center">
      {/* Top Bar Navigation */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-8">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#131926] hover:bg-[#1a2336] text-neutral-300 hover:text-white border border-neutral-800 text-sm font-semibold transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-purple-400" />
          <span>Back to Directory</span>
        </button>

        {/* Network Status Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            isOffline
              ? 'bg-amber-950/40 border-amber-600/50 text-amber-300'
              : 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300'
          }`}
        >
          {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
          <span>{isOffline ? 'Offline Mode (Sync Ready)' : 'Online'}</span>
        </div>
      </div>

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-2xl space-y-6"
      >
        {/* Header Header Banner */}
        <div className="p-6 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                PWA Web Share Target
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
                Catch Shared Anime
              </h1>
            </div>
          </div>
          <p className="text-neutral-400 text-xs sm:text-sm mt-2 leading-relaxed">
            Data received from your mobile OS Share Menu. Instantly check Indian regional dub availability and store it in your offline watchlist.
          </p>

          {/* Raw Shared Data Inspector Card */}
          <div className="mt-4 p-3.5 rounded-2xl bg-[#0e1420] border border-neutral-800/80 text-xs space-y-1.5 font-mono text-neutral-300">
            {parsedData.detectedTitle && (
              <div className="flex items-start gap-2">
                <span className="text-neutral-500 shrink-0 select-none">Title:</span>
                <span className="text-purple-300 font-semibold truncate">{parsedData.detectedTitle}</span>
              </div>
            )}
            {parsedData.detectedUrl && (
              <div className="flex items-start gap-2">
                <span className="text-neutral-500 shrink-0 select-none">URL:</span>
                <a
                  href={parsedData.detectedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline truncate flex items-center gap-1"
                >
                  <span className="truncate">{parsedData.detectedUrl}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}
            {!parsedData.detectedTitle && !parsedData.detectedUrl && (
              <div className="text-neutral-500 italic py-1">
                Listening for shared content from mobile apps or browser...
              </div>
            )}
          </div>
        </div>

        {/* Status Notification Toast */}
        <AnimatePresence>
          {statusNotification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-2xl bg-purple-950/60 border border-purple-500/40 text-purple-200 text-sm flex items-center gap-3 shadow-lg"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="flex-1 font-medium">{statusNotification}</div>
              <button
                onClick={() => setStatusNotification(null)}
                className="text-xs text-neutral-400 hover:text-white px-2 py-1"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CASE 1: MATCH FOUND IN DATABASE */}
        {matchedAnime ? (
          <div className="p-6 rounded-3xl bg-[#131926] border border-neutral-800 shadow-2xl relative overflow-hidden">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-4 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Matched in AniDub Directory</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Dynamic Ambient Glow behind matched poster */}
              <DynamicAmbientGlow
                imageUrl={matchedAnime.poster || matchedAnime.banner || ''}
                className="shrink-0 mx-auto sm:mx-0"
              >
                <div className="relative w-36 sm:w-44 aspect-[3/4.2] rounded-2xl overflow-hidden shadow-2xl border-2 border-neutral-700 bg-neutral-900">
                  <img
                    src={matchedAnime.poster || matchedAnime.banner}
                    alt={matchedAnime.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    {(matchedAnime.dubs || []).map((dub, idx) => (
                      <span
                        key={`${dub}-${idx}`}
                        className="bg-black/80 text-amber-300 font-extrabold text-[9px] px-1.5 py-0.5 rounded border border-white/10"
                      >
                        {dub.slice(0, 3)}
                      </span>
                    ))}
                  </div>
                </div>
              </DynamicAmbientGlow>

              {/* Matched Anime Details */}
              <div className="flex-1 space-y-3 text-center sm:text-left">
                <h2 className="text-xl sm:text-2xl font-black text-white">{matchedAnime.title}</h2>
                {matchedAnime.romajiTitle && (
                  <p className="text-xs text-neutral-400 italic -mt-2">{matchedAnime.romajiTitle}</p>
                )}

                {/* Available Dub Languages Badges */}
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">
                    Available Indian Regional Dubs:
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                    {(matchedAnime.dubs || []).map((dub, idx) => (
                      <span
                        key={`${dub}-badge-${idx}`}
                        className="bg-purple-900/60 border border-purple-600/40 text-purple-200 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      >
                        {dub} Dub
                      </span>
                    ))}
                  </div>
                </div>

                {/* Synopsis snippet */}
                <p className="text-xs text-neutral-300 line-clamp-3 leading-relaxed">
                  {matchedAnime.synopsis || 'Regional dub details verified by AniDub India.'}
                </p>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleAddToWatchlist(matchedAnime)}
                    className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer shadow-lg active:scale-95 ${
                      isSaved
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/30'
                        : 'bg-purple-600 text-white hover:bg-purple-500 shadow-purple-900/30'
                    }`}
                  >
                    {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                    <span>{isSaved ? 'In Offline Watchlist' : 'Add to Offline Watchlist'}</span>
                  </button>

                  <button
                    onClick={() => router.push(`/#anime/${matchedAnime.id}`)}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <span>View Full Details</span>
                    <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Candidate Alternatives if available */}
            {candidateMatches.length > 0 && (
              <div className="mt-6 pt-5 border-t border-neutral-800">
                <div className="text-xs font-bold text-neutral-400 mb-3">Other Potential Matches:</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {candidateMatches.map((cand) => (
                    <button
                      key={cand.id}
                      onClick={() => {
                        setMatchedAnime(cand);
                        checkIfAlreadyInWatchlist(cand.id);
                      }}
                      className="p-2 rounded-xl bg-[#0e1420] hover:bg-[#1a2336] border border-neutral-800 text-left transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <img
                        src={cand.poster || cand.banner}
                        alt=""
                        className="w-9 h-12 object-cover rounded-lg shrink-0"
                      />
                      <div className="truncate">
                        <div className="text-xs font-bold text-white truncate">{cand.title}</div>
                        <div className="text-[10px] text-purple-400 truncate">
                          {(cand.dubs || []).join(', ')}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* CASE 2: NO EXACT DIRECTORY MATCH — ALLOW CUSTOM OFFLINE WATCHLIST SAVE */
          <div className="p-6 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Not yet in curated directory</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  We couldn't find an existing entry for &ldquo;{parsedData.detectedTitle || 'this item'}&rdquo;, but you can save it straight to your personal offline watchlist!
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0e1420] border border-neutral-800/80 space-y-3">
              <div className="text-xs font-medium text-neutral-300">
                Title to save:
              </div>
              <input
                type="text"
                value={parsedData.detectedTitle}
                onChange={(e) =>
                  setParsedData((prev) => ({ ...prev, detectedTitle: e.target.value }))
                }
                placeholder="Enter anime title..."
                className="w-full px-3.5 py-2 rounded-xl bg-[#131926] border border-neutral-700 text-white text-sm focus:outline-none focus:border-purple-500"
              />

              <div className="text-xs font-medium text-neutral-300 pt-1">
                Streaming / Reference URL:
              </div>
              <input
                type="text"
                value={parsedData.detectedUrl}
                onChange={(e) =>
                  setParsedData((prev) => ({ ...prev, detectedUrl: e.target.value }))
                }
                placeholder="https://..."
                className="w-full px-3.5 py-2 rounded-xl bg-[#131926] border border-neutral-700 text-white text-sm focus:outline-none focus:border-purple-500 font-mono text-xs"
              />

              <button
                onClick={handleSaveCustomAnime}
                disabled={!parsedData.detectedTitle && !parsedData.detectedUrl}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-sm transition-all cursor-pointer shadow-lg shadow-purple-900/30"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Save to Offline Watchlist</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Nav Bottom Links */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs font-semibold text-neutral-400">
          <button
            onClick={() => router.push('/#watchlist')}
            className="hover:text-purple-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Open Offline Watchlist</span>
          </button>
          <span>•</span>
          <button
            onClick={() => router.push('/')}
            className="hover:text-purple-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Browse Full Directory</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
