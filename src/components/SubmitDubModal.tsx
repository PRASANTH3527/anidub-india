import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  Send, 
  Search, 
  Loader2, 
  CheckCircle2, 
  ShieldAlert, 
  Film, 
  Tv, 
  ExternalLink,
  Upload,
  Plus,
  Trash2,
  Star
} from 'lucide-react';
import { searchJikanAnime, formatJikanToAnime } from '../services/jikanApi';
import { JikanAnimeResult, AnimeRecord } from '../types/database';
import { DubLanguage, StreamingPlatform, AnimeType, ReleaseDay } from '../types/anime';
import { dbService } from '../services/databaseService';
import { authService } from '../services/authService';
import { useToast } from './Toast';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Helper to remove any undefined fields before saving to Firestore to prevent crashes
function cleanFirestoreData(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanFirestoreData);
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        res[key] = cleanFirestoreData(val);
      }
    }
    return res;
  }
  return obj;
}

interface SubmitDubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editAnime?: AnimeRecord | null;
}

const ALL_LANGS: DubLanguage[] = ['Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada'];
const ALL_DAYS: ReleaseDay[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const AVAILABLE_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Isekai',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Shonen',
  'Seinen',
  'Shoujo',
  'Josei',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
  'Mecha',
  'Psychological',
  'Music',
  'Military',
  'Historical',
  'Martial Arts',
  'Ecchi',
  'Gourmet',
  'Workplace',
];

export const SubmitDubModal: React.FC<SubmitDubModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editAnime,
}) => {
  const currentUser = authService.getCurrentUser();
  const toast = useToast();

  // Form Fields
  const [title, setTitle] = useState('');
  const [romajiTitle, setRomajiTitle] = useState('');
  const [poster, setPoster] = useState(''); // This will now store Base64
  const [synopsis, setSynopsis] = useState('');
  const [releaseYear, setReleaseYear] = useState<number | ''>(new Date().getFullYear());
  const [rating, setRating] = useState<number | ''>('');
  const [episodes, setEpisodes] = useState<number>(12);
  const [type, setType] = useState<AnimeType>('TV Series');
  const [studio, setStudio] = useState('');
  const [genres, setGenres] = useState<string[]>(['Action', 'Fantasy']);
  
  // Advanced Progress Tracking (Dynamic Seasons / Mixed Entries)
  const [seasonDetails, setSeasonDetails] = useState<{ 
    type: 'Season' | 'OVA' | 'Movie' | 'Special' | 'ONA'; 
    label: string; 
    episodeCount: number | ''; 
    languages: DubLanguage[];
  }[]>([
    { type: 'Season', label: '1', episodeCount: 12, languages: ['Tamil'] }
  ]);
  const [currentSeason, setCurrentSeason] = useState<number | ''>('');
  const [currentlyAiringEpisode, setCurrentlyAiringEpisode] = useState<number | ''>('');

  // Multi-Platform Links
  const [streamingPartners, setStreamingPartners] = useState<{ name: StreamingPlatform; url: string }[]>([
    { name: 'Crunchyroll', url: '' }
  ]);

  const [airingStatus, setAiringStatus] = useState<'Ongoing' | 'Completed'>('Ongoing');
  const [releaseDay, setReleaseDay] = useState<ReleaseDay>('Saturday');

  // Real-time Duplicate Check State
  const [duplicateAnime, setDuplicateAnime] = useState<AnimeRecord | null>(null);
  const [localEditAnime, setLocalEditAnime] = useState<AnimeRecord | null>(null);

  // Jikan Search State
  const [jikanResults, setJikanResults] = useState<JikanAnimeResult[]>([]);
  const [isSearchingJikan, setIsSearchingJikan] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Derived state & Admin security check
  const isAdmin = authService.isAdmin();
  const isEditMode = isAdmin && (!!editAnime || !!localEditAnime);
  const activeAnime = isEditMode ? (editAnime || localEditAnime) : (editAnime || localEditAnime);

  // Debounced Jikan API search
  useEffect(() => {
    if (!title || title.trim().length < 2 || autoFilled) {
      setJikanResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingJikan(true);
      try {
        const results = await searchJikanAnime(title);
        setJikanResults(results);
        setShowDropdown(results.length > 0);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearchingJikan(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [title, autoFilled]);

  // Pre-fill if editing
  useEffect(() => {
    if (activeAnime && isOpen) {
      setTitle(activeAnime.title);
      setRomajiTitle(activeAnime.romajiTitle || '');
      setPoster(activeAnime.poster || '');
      setSynopsis(activeAnime.synopsis || '');
      setReleaseYear(activeAnime.releaseYear || new Date().getFullYear());
      setType(activeAnime.type || 'TV Series');
      setStudio(activeAnime.studio || '');
      setGenres(activeAnime.genres || ['Action']);
      setAiringStatus(activeAnime.status === 'Ongoing' ? 'Ongoing' : 'Completed');
      if (activeAnime.releaseDay) setReleaseDay(activeAnime.releaseDay as ReleaseDay);
      
      if (activeAnime.seasonDetails && activeAnime.seasonDetails.length > 0) {
        setSeasonDetails(activeAnime.seasonDetails.map(s => ({
          type: s.type || 'Season',
          label: s.label || '1',
          episodeCount: s.episodeCount || 0,
          languages: s.languages || (activeAnime.dubs || ['Tamil'])
        })));
      } else if (activeAnime.totalSeasons || activeAnime.episodesPerSeason) {
        // Fallback for older records
        setSeasonDetails([{ 
          type: 'Season', 
          label: '1', 
          episodeCount: activeAnime.episodesPerSeason || 12,
          languages: activeAnime.dubs || ['Tamil']
        }]);
      }

      if (activeAnime.currentSeason !== undefined && activeAnime.currentSeason !== null) {
        setCurrentSeason(activeAnime.currentSeason);
      } else {
        setCurrentSeason('');
      }

      if (activeAnime.currentlyAiringEpisode !== undefined && activeAnime.currentlyAiringEpisode !== null) {
        setCurrentlyAiringEpisode(activeAnime.currentlyAiringEpisode);
      } else {
        setCurrentlyAiringEpisode('');
      }

      if (activeAnime.rating !== undefined && activeAnime.rating !== null) {
        setRating(activeAnime.rating);
      } else {
        setRating('');
      }

      if (activeAnime.platforms && activeAnime.platforms.length > 0) {
        setStreamingPartners(activeAnime.platforms.map(p => ({
          name: p.name as StreamingPlatform,
          url: p.url
        })));
      }
      setAutoFilled(true); // Treat as auto-filled so Jikan search doesn't trigger immediately
    } else if (isOpen && !activeAnime) {
      // Clear for new submission
      setTitle('');
      setRomajiTitle('');
      setPoster('');
      setSynopsis('');
      setReleaseYear(new Date().getFullYear());
      setEpisodes(12);
      setType('TV Series');
      setStudio('');
      setGenres(['Action', 'Fantasy']);
      setSeasonDetails([{ type: 'Season', label: '1', episodeCount: 12, languages: ['Tamil'] }]);
      setCurrentSeason('');
      setCurrentlyAiringEpisode('');
      setRating('');
      setStreamingPartners([{ name: 'Crunchyroll', url: '' }]);
      setAiringStatus('Ongoing');
      setReleaseDay('Saturday');
      setAutoFilled(false);
    }
    
    if (!isOpen) {
      setLocalEditAnime(null);
    }
    
    setDuplicateAnime(null);
  }, [activeAnime, isOpen]);

  // Real-time Duplicate Check Logic
  useEffect(() => {
    if (isEditMode || !title || title.trim().length < 3 || autoFilled) {
      setDuplicateAnime(null);
      return;
    }

    const debounceTimer = setTimeout(() => {
      const allApproved = dbService.getApprovedAnime();
      const allPending = dbService.getPendingSubmissions();
      const allRecords = [...allApproved, ...allPending];
      
      const match = allRecords.find(a => 
        a.title.toLowerCase().trim() === title.toLowerCase().trim() ||
        (a.romajiTitle && a.romajiTitle.toLowerCase().trim() === title.toLowerCase().trim())
      );

      if (match) {
        setDuplicateAnime(match);
      } else {
        setDuplicateAnime(null);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [title, isEditMode, autoFilled]);

  const handleEditDuplicate = () => {
    if (!authService.isAdmin()) {
      toast.error('Unauthorized', 'Access Denied: Only verified administrators can edit existing anime titles.');
      return;
    }
    if (duplicateAnime) {
      setLocalEditAnime(duplicateAnime);
      setDuplicateAnime(null);
      toast.info('Switched to Edit Mode', `Now editing existing entry for "${duplicateAnime.title}"`);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPoster(base64String);
    };
    reader.readAsDataURL(file);
  };

  const addStreamingPartner = () => {
    setStreamingPartners([...streamingPartners, { name: 'Crunchyroll', url: '' }]);
  };

  const removeStreamingPartner = (index: number) => {
    if (streamingPartners.length > 1) {
      setStreamingPartners(streamingPartners.filter((_, i) => i !== index));
    }
  };

  const updateStreamingPartner = (index: number, field: 'name' | 'url', value: string) => {
    const updated = [...streamingPartners];
    updated[index] = { ...updated[index], [field]: value };
    setStreamingPartners(updated);
  };

  // Dynamic Season / Entry Logic
  const addEntry = () => {
    // If last entry was a Season, try to guess the next number
    const lastEntry = seasonDetails[seasonDetails.length - 1];
    let nextLabel = '1';
    if (lastEntry && lastEntry.type === 'Season' && !isNaN(parseInt(lastEntry.label))) {
      nextLabel = (parseInt(lastEntry.label) + 1).toString();
    } else {
      nextLabel = (seasonDetails.length + 1).toString();
    }
    setSeasonDetails([...seasonDetails, { 
      type: 'Season', 
      label: nextLabel, 
      episodeCount: '', 
      languages: lastEntry?.languages || ['Tamil'] 
    }]);
  };

  const removeEntry = (index: number) => {
    if (seasonDetails.length > 1) {
      setSeasonDetails(seasonDetails.filter((_, i) => i !== index));
    }
  };

  const updateEntryField = (index: number, field: 'type' | 'label' | 'episodeCount' | 'languages', value: any) => {
    const updated = [...seasonDetails];
    if (field === 'episodeCount') {
      updated[index] = { ...updated[index], episodeCount: value === '' ? '' : parseInt(value) || 0 };
    } else if (field === 'languages') {
      updated[index] = { ...updated[index], languages: value };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setSeasonDetails(updated);
  };

  const toggleLanguageForEntry = (entryIdx: number, lang: DubLanguage) => {
    const currentLangs = seasonDetails[entryIdx].languages || [];
    let updatedLangs: DubLanguage[];
    if (currentLangs.includes(lang)) {
      updatedLangs = currentLangs.filter(l => l !== lang);
    } else {
      updatedLangs = [...currentLangs, lang];
    }
    updateEntryField(entryIdx, 'languages', updatedLangs);
  };

  // Click outside listener for Jikan dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // Handle auto-filling details from Jikan API
  const handleSelectJikan = (item: JikanAnimeResult) => {
    const formatted = formatJikanToAnime(item);
    setTitle(formatted.title);
    setRomajiTitle(formatted.romajiTitle);
    setPoster(formatted.poster);
    setSynopsis(formatted.synopsis);
    setReleaseYear(formatted.releaseYear);
    setEpisodes(formatted.episodes);
    setType(formatted.type);
    setStudio(formatted.studio);
    setGenres(formatted.genres);
    setRating(formatted.rating || '');
    if (item.airing !== undefined) {
      setAiringStatus(item.airing ? 'Ongoing' : 'Completed');
    }
    if (item.broadcast?.day) {
      const bDay = item.broadcast.day.replace(/s$/i, '').trim();
      const matched = ALL_DAYS.find((d) => d.toLowerCase() === bDay.toLowerCase());
      if (matched) {
        setReleaseDay(matched);
      }
    }
    setAutoFilled(true);
    setShowDropdown(false);
  };

  const toggleGenre = (genre: string) => {
    if (genres.includes(genre)) {
      setGenres(genres.filter((g) => g !== genre));
    } else {
      setGenres([...genres, genre]);
    }
  };

  // STRICT MODERATION SUBMIT: ALWAYS ENFORCES status: "pending"
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only Anime Title is strictly required
    if (!title.trim()) return;

    // DERIVE GLOBAL LANGUAGES: Merge all unique languages selected across all seasons
    const rawLanguages = Array.from(new Set(
      seasonDetails.flatMap(s => s.languages || [])
    )) as DubLanguage[];
    const derivedGlobalDubs = rawLanguages.length > 0 ? rawLanguages : (['Tamil'] as DubLanguage[]);

    setIsSubmitting(true);

    const defaultCover =
      poster.trim() ||
      'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

    const platforms = streamingPartners
      .filter(p => p.url?.trim() || p.name)
      .map(p => ({
        name: p.name,
        url: p.url.trim() || 'https://www.crunchyroll.com',
      }));

    const finalPlatforms = platforms.length > 0 ? platforms : [{ name: 'Crunchyroll' as StreamingPlatform, url: 'https://www.crunchyroll.com' }];

    const totalEpisodes = seasonDetails.reduce((acc, s) => acc + (Number(s.episodeCount) || 0), 0);
    
    const dubDetails = derivedGlobalDubs.map((lang) => ({
      language: lang,
      available: true,
      platform: finalPlatforms.map(p => p.name),
      notes: `Verified ${lang} dub available on ${finalPlatforms.map(p => p.name).join(', ')}`,
    }));

    const payload = {
      title: title.trim(),
      romajiTitle: romajiTitle.trim() || title.trim(),
      poster: defaultCover,
      imageUrl: defaultCover,
      synopsis: synopsis.trim() || `Regional Indian dubbed release for ${title.trim()} available on AniDub India.`,
      releaseYear: releaseYear ? Number(releaseYear) : new Date().getFullYear(),
      originalReleaseDate: `${releaseYear || new Date().getFullYear()}`,
      rating: (rating !== '' && rating !== undefined) ? Number(rating) : undefined,
      episodes: totalEpisodes || 12,
      seasons: seasonDetails.filter(s => s.type === 'Season').length || 1,
      totalSeasons: seasonDetails.filter(s => s.type === 'Season').length || 1,
      seasonDetails: seasonDetails.map(s => ({
        type: s.type || 'Season',
        label: s.label || '1',
        episodeCount: Number(s.episodeCount) || 0,
        languages: s.languages && s.languages.length > 0 ? s.languages : derivedGlobalDubs
      })),
      currentSeason: airingStatus === 'Ongoing' && currentSeason !== '' ? Number(currentSeason) : undefined,
      currentlyAiringEpisode: airingStatus === 'Ongoing' && currentlyAiringEpisode !== '' ? Number(currentlyAiringEpisode) : undefined,
      type: type || 'TV Series',
      studio: studio.trim() || 'Animation Studio',
      status: airingStatus || 'Ongoing',
      airingStatus: airingStatus || 'Ongoing',
      releaseDay: airingStatus === 'Ongoing' ? releaseDay : undefined,
      airingDay: airingStatus === 'Ongoing' ? releaseDay : undefined,
      genres: genres.length > 0 ? genres : ['Action'],
      dubs: derivedGlobalDubs,
      dubDetails,
      platforms: finalPlatforms,
    };

    if (activeAnime && (isEditMode || editAnime || localEditAnime)) {
      // CRITICAL SECURITY CHECK: Verify authenticated as Admin
      if (!authService.isAdmin()) {
        console.warn('[Security Violation] Non-admin attempted direct edit on anime:', activeAnime.id);

        // Security requirement: Block direct live update and save as pending edit submission for admin review
        const proposalId = 'sub-edit-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
        const editProposalData = cleanFirestoreData({
          ...payload,
          id: proposalId,
          targetAnimeId: activeAnime.id,
          originalTitle: activeAnime.title,
          isEditProposal: true,
          status: 'pending',
          submissionStatus: 'pending',
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          submittedBy: {
            userId: currentUser?.uid || 'guest-user',
            userName: currentUser?.displayName || 'Community Contributor',
            userEmail: currentUser?.email || 'contributor@anidub.in',
          },
        });

        try {
          await setDoc(doc(db, 'submissions', proposalId), editProposalData);
        } catch (err) {
          console.error('[Firestore Edit Proposal Error]', err);
        }

        // Notify Telegram of pending edit proposal
        try {
          const telegramAlertMsg = `🔔 Proposed Edit Submitted: ${title.trim()} (Pending Admin Review)`;
          await fetch('/api/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: telegramAlertMsg,
              text: telegramAlertMsg,
              title: title.trim(),
            }),
          });
        } catch {}

        setIsSubmitting(false);
        toast.error(
          'Unauthorized Direct Edit',
          'Only verified Administrators can edit live anime directly. Your changes have been securely submitted as a pending review for Admin approval.'
        );
        onClose();
        return;
      }

      // 1. Authenticated Admin Direct write to live Firebase Firestore database
      try {
        const sanitizedEditPayload = cleanFirestoreData({
          ...payload,
          updatedAt: new Date().toISOString(),
        });

        await setDoc(doc(db, 'animes', activeAnime.id), sanitizedEditPayload, { merge: true });
        try {
          await setDoc(doc(db, 'anime', activeAnime.id), sanitizedEditPayload, { merge: true });
        } catch {}
        try {
          await setDoc(doc(db, 'submissions', activeAnime.id), sanitizedEditPayload, { merge: true });
        } catch {}
      } catch (fsEditErr) {
        console.error('[Firestore Direct Edit Error]', fsEditErr);
      }

      // 2. Also update local cache via databaseService
      const success = dbService.updateAnime(activeAnime.id, payload);
      
      if (success) {
        // Dispatch Telegram admin notification
        try {
          const telegramMessage = `🔔 Anime Updated: ${title.trim()}`;
          await fetch('/api/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: telegramMessage,
              text: telegramMessage,
              title: title.trim(),
              anime: {
                id: activeAnime.id,
                title: title.trim(),
                poster: poster || defaultCover,
                synopsis: synopsis.trim(),
                genres: genres.join(', '),
                languages: derivedGlobalDubs,
                episodes: airingStatus === 'Ongoing' ? (currentlyAiringEpisode || 'Ongoing') : (seasonDetails[0]?.episodeCount || 'Completed'),
                score: rating || 'N/A',
              },
            }),
          });
        } catch (err) {
          console.warn('Telegram notification error:', err);
        }

        setIsSubmitting(false);
        toast.success('Anime Updated!', `"${title.trim()}" has been successfully updated.`);
        onClose();
        onSuccess?.();
      } else {
        setIsSubmitting(false);
        toast.error('Update Failed', 'Could not update the record.');
      }
      return;
    }

    // Creating new record ID
    const newId = 'sub-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);

    const newRecord: AnimeRecord = {
      ...payload,
      id: newId,
      status: 'pending',
      submissionStatus: 'pending',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      themes: ['Super Power', 'Indian Dub'],
      characters: [
        {
          characterName: `Protagonist of ${title.trim()}`,
          role: 'Main',
          characterImage: defaultCover,
          japaneseVA: 'Original Cast',
          indianVA: {
            language: derivedGlobalDubs[0],
            actor: 'Regional Voice Cast',
          },
        },
      ],
      submittedBy: {
        userId: currentUser?.uid || 'guest-user',
        userName: currentUser?.displayName || 'Community Member',
        userEmail: currentUser?.email || 'contributor@anidub.in',
      },
      likes: 0,
      upvotes: 0,
    };

    // 1. Save new anime data DIRECTLY to live Firebase Firestore database collections ('animes', 'anime', and 'submissions')
    try {
      const sanitizedDocData = cleanFirestoreData({
        ...newRecord,
        createdAt: new Date().toISOString(),
        serverCreatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'animes', newId), sanitizedDocData);

      try {
        await setDoc(doc(db, 'anime', newId), sanitizedDocData);
      } catch {}

      await setDoc(doc(db, 'submissions', newId), sanitizedDocData);

      // Log activity event in Firestore
      await setDoc(doc(db, 'activities', `act-${newId}`), {
        user: newRecord.submittedBy?.userName || 'Community User',
        action: 'submitted',
        animeTitle: newRecord.title,
        timestamp: new Date(),
        language: newRecord.dubs?.[0] || 'Tamil',
        status: 'pending',
      });
    } catch (firestoreError) {
      console.error('[Firestore Direct Save Error]', firestoreError);
    }

    // 2. Also register in local databaseService cache
    dbService.submitDubInfo({
      ...payload,
      themes: ['Super Power', 'Indian Dub'],
      characters: newRecord.characters,
      submittedBy: newRecord.submittedBy,
    });

    // 3. Inside onSubmit, add a fetch call to the Telegram API route to send '🔔 New Anime Submitted: [Title]'
    try {
      const telegramAlertMsg = `🔔 New Anime Submitted: ${title.trim()}`;
      await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: telegramAlertMsg,
          text: telegramAlertMsg,
          title: title.trim(),
          anime: {
            id: newId,
            title: title.trim(),
            poster: poster || defaultCover,
            synopsis: synopsis.trim(),
            genres: genres.join(', '),
            languages: derivedGlobalDubs,
            episodes: airingStatus === 'Ongoing' ? (currentlyAiringEpisode || 'Ongoing') : (seasonDetails[0]?.episodeCount || 'Completed'),
            score: rating || 'N/A',
          },
        }),
      });
    } catch (telegramError) {
      console.warn('Telegram notification error:', telegramError);
    }

    setIsSubmitting(false);
    setIsSuccess(true);
    toast.success('Anime Submitted Successfully!', `"${title.trim()}" is now pending stealth admin approval.`);

    setTimeout(() => {
      setIsSuccess(false);
      setTitle('');
      setPoster('');
      setSynopsis('');
      setStreamingPartners([{ name: 'Crunchyroll', url: '' }]);
      setType('TV Series');
      setGenres(['Action', 'Fantasy']);
      setAiringStatus('Ongoing');
      setReleaseDay('Saturday');
      setSeasonDetails([{ type: 'Season', label: '1', episodeCount: 12, languages: ['Tamil'] }]);
      setCurrentSeason('');
      setCurrentlyAiringEpisode('');
      setRating('');
      setAutoFilled(false);
      onClose();
      onSuccess?.();
    }, 2400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-xl bg-[#111726]/95 border border-primary-theme/30 rounded-3xl shadow-2xl overflow-hidden z-10 my-auto text-neutral-100 backdrop-blur-xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-gradient-to-r from-[var(--primary-badge)]/40 via-transparent to-transparent shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl badge-primary-theme flex items-center justify-center">
              <Film className="w-4 h-4 text-accent-theme" />
            </div>
            <div>
              <h3 className="font-heading font-black text-lg text-white leading-tight">
                {isEditMode ? 'Edit Anime Info' : 'Submit Dub Info'}
              </h3>
              <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Strict Moderation: Requires Admin Approval</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto pb-32">
          <div className="p-5 sm:p-6 space-y-4">
            {isSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-amber-950/70 border border-amber-500/50 flex items-center justify-center mx-auto text-amber-400 animate-bounce">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="font-heading font-black text-xl text-white">
                Saved with Status: "Pending"!
              </h4>
              <p className="text-xs text-neutral-300 max-w-md mx-auto leading-relaxed">
                Your submission is currently locked under <strong className="text-amber-400">Strict Moderation</strong>. 
                It has been sent to the Admin Dashboard and will remain hidden from the website until approved.
              </p>
            </div>
          ) : (
            <form id="anime-edit-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              {/* Title & Jikan Auto-fill Search */}
              <div className="relative" ref={dropdownRef}>
                <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                  <span>Anime Title (Type to Auto-Fill via MyAnimeList) <span className="text-purple-400">*</span></span>
                  {isSearchingJikan && (
                    <span className="text-[10px] text-accent-theme flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Searching MAL...
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setAutoFilled(false);
                    }}
                    placeholder="e.g. Solo Leveling, Demon Slayer, Jujutsu Kaisen..."
                    className="w-full bg-[#171e2e] border border-neutral-700/80 focus:border-primary-theme rounded-xl py-2.5 pl-3.5 pr-8 text-xs text-white placeholder-neutral-500 outline-none transition-all"
                  />
                  <Search className="w-4 h-4 text-neutral-500 absolute right-3 top-3 pointer-events-none" />
                </div>

                {/* Duplicate Warning Alert */}
                {duplicateAnime && (
                  <div className="mt-2.5 bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-500/30">
                        <ShieldAlert className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-amber-500 text-[11px] uppercase tracking-wider">Duplicate Entry Found</p>
                        <p className="text-xs text-neutral-200 font-medium">
                          <span className="font-bold">"{duplicateAnime.title}"</span> already exists with <span className="text-amber-400 font-bold">{duplicateAnime.dubs.join(', ')}</span> dubs.
                        </p>
                        {!isAdmin && (
                          <p className="text-[11px] text-amber-300/80 mt-1">
                            This title is already registered. To submit new dub languages or suggest corrections, submit a new review request or contact an administrator.
                          </p>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={handleEditDuplicate}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black uppercase tracking-tight transition-all active:scale-95 whitespace-nowrap shadow-lg shadow-amber-500/20 cursor-pointer"
                      >
                        Edit Existing Entry
                      </button>
                    )}
                  </div>
                )}

                {/* Auto-fill Dropdown Results from Jikan */}
                {showDropdown && jikanResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#141b29] border border-primary-theme/40 rounded-2xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-neutral-800">
                    <div className="p-2 text-[10px] font-bold text-accent-theme bg-[var(--primary-badge)]/40 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" />
                      <span>Select anime to 1-click auto-fill poster, synopsis, studio & year:</span>
                    </div>
                    {jikanResults.map((item) => (
                      <div
                        key={item.mal_id}
                        onClick={() => handleSelectJikan(item)}
                        className="p-2.5 flex items-center gap-3 hover:bg-[var(--primary-badge)]/30 cursor-pointer transition-colors"
                      >
                        <img
                          src={item.images.jpg.image_url}
                          alt={item.title}
                          className="w-9 h-12 object-cover rounded-lg shrink-0 border border-neutral-700"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-white text-xs truncate">{item.title}</p>
                          <p className="text-[10px] text-neutral-400">
                            {item.year || item.type || 'Anime'} • {item.episodes ? `${item.episodes} eps` : 'Ongoing'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Poster Image File Upload */}
              <div>
                <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                  <span>Anime Poster (Upload File)</span>
                  {autoFilled && <span className="text-[10px] text-emerald-400 font-semibold">✓ Auto-filled from MAL</span>}
                </label>
                <div className="flex gap-3 items-center">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 h-20 border-2 border-dashed border-neutral-700 hover:border-primary-theme rounded-2xl bg-[#171e2e] flex flex-col items-center justify-center cursor-pointer transition-all group"
                  >
                    <Upload className="w-5 h-5 text-neutral-500 group-hover:text-accent-theme mb-1" />
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider group-hover:text-neutral-200">
                      {poster ? 'Change Photo' : 'Select Photo'}
                    </span>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden" 
                    />
                  </div>
                  {poster && (
                    <div className="relative shrink-0">
                      <img
                        src={poster}
                        alt="Preview"
                        className="w-14 h-20 object-cover rounded-xl border border-primary-theme/50 shadow-xl"
                      />
                      <button 
                        type="button"
                        onClick={() => setPoster('')}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center text-white border border-black shadow-lg hover:bg-purple-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[9px] text-neutral-500 mt-1 uppercase font-bold tracking-tighter">
                  Supported: JPG, PNG, WEBP (Max 2MB).
                </p>
              </div>

              {/* Dynamic Multi-Platform Links */}
              <div className="space-y-2">
                <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                  <span>Streaming Partners (Multi-Link)</span>
                  <button 
                    type="button" 
                    onClick={addStreamingPartner}
                    className="text-[10px] text-accent-theme font-bold hover:text-primary-theme flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Add Platform
                  </button>
                </label>
                
                <div className="space-y-2.5">
                  {streamingPartners.map((partner, idx) => (
                    <div key={idx} className="flex gap-2 items-start animate-in slide-in-from-left-2 duration-200">
                      <div className="w-1/3">
                        <select
                          value={partner.name}
                          onChange={(e) => updateStreamingPartner(idx, 'name', e.target.value)}
                          className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-2.5 py-2 text-[11px] text-white focus:outline-none focus:border-primary-theme cursor-pointer"
                        >
                          <option value="Crunchyroll">Crunchyroll</option>
                          <option value="Netflix">Netflix</option>
                          <option value="JioCinema">JioCinema</option>
                          <option value="YouTube (Muse India)">Muse India</option>
                          <option value="YouTube (Ani-One)">Ani-One</option>
                          <option value="Disney+ Hotstar">Hotstar</option>
                          <option value="Prime Video">Prime</option>
                        </select>
                      </div>
                      <div className="flex-1 relative">
                        <input
                          type="url"
                          value={partner.url}
                          onChange={(e) => updateStreamingPartner(idx, 'url', e.target.value)}
                          placeholder="Link (e.g. https://...)"
                          className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-[11px] text-white placeholder-neutral-600 focus:outline-none focus:border-primary-theme"
                        />
                      </div>
                      {streamingPartners.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStreamingPartner(idx)}
                          className="p-2.5 rounded-xl bg-neutral-800/50 text-neutral-500 hover:text-purple-400 hover:bg-purple-950/20 transition-all border border-neutral-700/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Type, Status & Release Day Dropdowns */}
              <div className={`grid grid-cols-1 ${airingStatus === 'Ongoing' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                <div>
                  <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                    <span>Type</span>
                    <span className="text-[10px] text-accent-theme font-semibold">Format</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AnimeType)}
                    className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary-theme cursor-pointer text-xs"
                  >
                    <option value="TV Series">TV Series</option>
                    <option value="Movie">Movie</option>
                    <option value="OVA">OVA</option>
                    <option value="ONA">ONA</option>
                    <option value="Special">Special</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                    <span>Status</span>
                    <span className="text-[10px] text-accent-theme font-semibold">Airing State</span>
                  </label>
                  <select
                    value={airingStatus}
                    onChange={(e) => setAiringStatus(e.target.value as 'Ongoing' | 'Completed')}
                    className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary-theme cursor-pointer text-xs"
                  >
                    <option value="Ongoing">Ongoing (Simulcast)</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                {/* Release Day */}
                {airingStatus === 'Ongoing' && (
                  <div className="animate-fadeIn">
                    <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                      <span>Release Day</span>
                      <span className="text-[10px] text-emerald-400 font-semibold">Schedule Tab</span>
                    </label>
                    <select
                      value={releaseDay}
                      onChange={(e) => setReleaseDay(e.target.value as ReleaseDay)}
                      className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary-theme cursor-pointer text-xs"
                    >
                      {ALL_DAYS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Dynamic Seasons & Mixed Entries Tracking */}
              <div className="space-y-3">
                <label className="block font-bold text-neutral-300 mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5 text-accent-theme" />
                    <span>Mixed Entries (Seasons, OVAs, Movies)</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={addEntry}
                    className="text-[10px] text-accent-theme font-bold hover:text-primary-theme flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Add Entry
                  </button>
                </label>

                <div className="space-y-2.5">
                  {seasonDetails.map((entry, idx) => (
                    <div key={idx} className="bg-[#182032] border border-neutral-700/60 rounded-2xl p-2.5 animate-in zoom-in-95 duration-200 space-y-2">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-4">
                          <select
                            value={entry.type}
                            onChange={(e) => updateEntryField(idx, 'type', e.target.value)}
                            className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-primary-theme rounded-xl px-2 py-1.5 text-[10px] sm:text-[11px] text-white outline-none cursor-pointer"
                          >
                            <option value="Season">Season</option>
                            <option value="Movie">Movie</option>
                            <option value="OVA">OVA</option>
                            <option value="ONA">ONA</option>
                            <option value="Special">Special</option>
                          </select>
                        </div>
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={entry.label}
                            onChange={(e) => updateEntryField(idx, 'label', e.target.value)}
                            placeholder="Label (e.g. 1)"
                            className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-purple-500 rounded-xl px-2 py-1.5 text-[10px] sm:text-[11px] text-white placeholder-neutral-600 outline-none"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            value={entry.episodeCount}
                            onChange={(e) => updateEntryField(idx, 'episodeCount', e.target.value)}
                            placeholder="Eps"
                            className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-purple-500 rounded-xl px-2 py-1.5 text-[10px] sm:text-[11px] text-white placeholder-neutral-600 outline-none"
                          />
                        </div>
                        <div className="col-span-2 flex justify-center items-center">
                          {seasonDetails.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeEntry(idx)}
                              className="p-1.5 rounded-xl text-neutral-500 hover:text-purple-400 hover:bg-purple-950/20 transition-all border border-transparent hover:border-purple-500/30"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Per-Entry Language Toggles */}
                      <div className="flex flex-wrap items-center gap-1.5 px-1 pb-0.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase mr-1">Available In:</span>
                        {ALL_LANGS.map(lang => {
                          const isSelected = entry.languages?.includes(lang);
                          return (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => toggleLanguageForEntry(idx, lang)}
                              className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all border ${
                                isSelected 
                                  ? 'bg-purple-600/20 border-purple-500 text-purple-300' 
                                  : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'
                              }`}
                            >
                              {lang.substring(0, 2)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ongoing Status Section (Conditional) */}
              {airingStatus === 'Ongoing' && (
                <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Ongoing Airing Status</span>
                    </label>
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-amber-600 uppercase mb-1 px-1">Currently Airing Season</label>
                      <input
                        type="number"
                        min={1}
                        max={seasonDetails.length}
                        value={currentSeason}
                        onChange={(e) => setCurrentSeason(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                        className="w-full bg-[#0a0e17] border border-amber-900/50 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-amber-200 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-amber-600 uppercase mb-1 px-1">Live Episode Number</label>
                      <input
                        type="number"
                        min={1}
                        value={currentlyAiringEpisode}
                        onChange={(e) => setCurrentlyAiringEpisode(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                        className="w-full bg-[#0a0e17] border border-amber-900/50 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-amber-200 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <p className="text-[9px] text-amber-600/80 font-medium leading-tight">
                    * This info will be used to show the "Airing Now" badge and progress on the Home feed.
                  </p>
                </div>
              )}

              {/* Explanatory note for Ongoing releases */}
              {airingStatus === 'Ongoing' && (
                <p className="text-[10px] text-neutral-400 -mt-1">
                  Ongoing titles will be featured on the <strong className="text-white">Airing Now</strong> weekly calendar under <strong className="text-emerald-400">{releaseDay}</strong>.
                </p>
              )}

              {/* Explicit Genre Selector (Action, Comedy, Shonen, etc.) */}
              <div>
                <label className="block font-bold text-neutral-300 mb-1.5 flex items-center justify-between">
                  <span>Genres (Action, Comedy, Shonen, etc.)</span>
                  <span className="text-[10px] text-purple-400 font-semibold">{genres.length} selected</span>
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-[#141b29] border border-neutral-700/80 max-h-36 overflow-y-auto no-scrollbar">
                  {AVAILABLE_GENRES.map((g) => {
                    const isSelected = genres.includes(g);
                    return (
                      <button
                        type="button"
                        key={g}
                        onClick={() => toggleGenre(g)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'bg-purple-600 text-white shadow shadow-purple-600/30 ring-1 ring-purple-400/60'
                            : 'bg-[#1b2234] text-neutral-400 hover:text-neutral-200 border border-neutral-700/60'
                        }`}
                      >
                        {isSelected && <span>✓</span>}
                        <span>{g}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">
                  Click tags to toggle genres. These link directly to the Library Genre filter so users can find this show easily.
                </p>
              </div>

              {/* Optional Studio, Year & Rating info (auto-filled if selected) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-neutral-400 mb-1">Animation Studio</label>
                  <input
                    type="text"
                    value={studio}
                    onChange={(e) => setStudio(e.target.value)}
                    placeholder="e.g. Ufotable"
                    className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-1.5 text-white placeholder-neutral-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-400 mb-1">Release Year</label>
                  <input
                    type="number"
                    value={releaseYear}
                    onChange={(e) => setReleaseYear(e.target.value === '' ? '' : parseInt(e.target.value) || 2024)}
                    placeholder="e.g. 2024"
                    className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-1.5 text-white placeholder-neutral-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-400 mb-1 text-[10px] uppercase tracking-wider">Crunchyroll Rating</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={rating}
                      onChange={(e) => setRating(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="e.g. 4.8"
                      className="w-full bg-[#171e2e] border border-neutral-700/80 rounded-xl px-3 py-1.5 text-white placeholder-neutral-500 text-xs focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Strict Approval Notice */}
              <div className="bg-[#141b29] border border-amber-800/40 rounded-2xl p-3 text-[11px] text-neutral-300 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Strict Moderation Gate</span>
                </div>
                <p className="text-neutral-400 leading-relaxed">
                  This submission will be saved with <strong className="text-amber-300">status: "pending"</strong>. 
                  It will <strong>NEVER</strong> appear on the public website (Home, Search, or Airing Now) until approved by the admin.
                </p>
              </div>

              {/* Submit CTA (Moved to Sticky Footer) */}
              <div className="h-2" />
            </form>
          )}
        </div>

        {/* Sticky Floating Submit Footer (Glassmorphism & Glowing) */}
        {!isSuccess && (
          <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#111726] via-[#111726]/95 to-transparent backdrop-blur-lg border-t border-white/5 z-50">
            <button
              type="submit"
              form="anime-edit-form"
              onClick={(e) => {
                e.stopPropagation();
                const form = document.getElementById('anime-edit-form') as HTMLFormElement;
                if (form) {
                  form.requestSubmit();
                }
              }}
              disabled={isSubmitting || !title.trim()}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-600 via-amber-600 to-purple-600 hover:from-orange-500 hover:via-amber-500 hover:to-purple-500 text-white font-black text-sm flex items-center justify-center gap-3 cursor-pointer shadow-[0_0_30px_rgba(249,115,22,0.3)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed group"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isEditMode ? (
                <div className="relative flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  <span>Update Anime Details</span>
                </div>
              ) : (
                <div className="relative flex items-center gap-3">
                  <div className="absolute -inset-1 bg-white rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity" />
                  <Send className="w-5 h-5 relative" />
                  <span>Submit Dub for Admin Approval</span>
                </div>
              )}
            </button>
          </div>
        )}
      </div>

      </div>
    </div>
  );
};
