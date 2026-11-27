import React, { useState, useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { 
  X, 
  Search, 
  CheckCircle2, 
  ShieldAlert, 
  Tv, 
  Film,
  Sparkles,
  Upload,
  Plus,
  Trash2,
  Loader2,
  Send,
  AlertCircle
} from 'lucide-react';
import { AnimeRecord, DubLanguage, dbService } from '../services/databaseService';
import { cloudflareApi } from '../services/cloudflareApi';
import { useToast } from './Toast';
import { useUser } from '../lib/clerk';
import { isAuthorizedClerkAdmin } from '../utils/auth';
import { validateImageUpload } from '../utils/imgbb';
import { validateExternalImageUrl, validateOfficialSourceUrl } from '../utils/submissionValidation';
import {
  CANONICAL_STREAMING_PLATFORMS,
  matchCanonicalPlatformName,
  normalizePlatformString,
  normalizePartnerLanguages,
  parseCsvPlatformsField,
  buildStreamingPartnersPayload,
  normalizeBroadcastDay,
  normalizeBroadcastTime,
  deriveSeasonEpisodeCountSummary,
  deriveOfficialSourceUrlFromPartners,
} from '../utils/dataNormalization';
import { useTranslation } from 'react-i18next';

interface DubInfoModalProps {
  isOpen: boolean;
  mode?: 'submit' | 'edit';
  initialData?: any;
  onClose: () => void;
  onSubmit: (updatedAnime?: any) => void;
}

const ALL_LANGS: DubLanguage[] = ['Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada'];
const PLATFORM_LANGS = ['Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'English'] as const;
const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const AVAILABLE_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Isekai', 
  'Mystery', 'Romance', 'Sci-Fi', 'Shonen', 'Seinen', 'Shoujo', 'Josei', 
  'Slice of Life', 'Sports', 'Supernatural', 'Thriller', 'Mecha', 'Psychological',
  'Music', 'Military', 'Historical', 'Martial Arts', 'Ecchi', 'Gourmet', 'Workplace',
  'School', 'Mythology', 'Parody'
];

const normalizeAnimeType = (val: any): string => {
  if (!val || typeof val !== 'string') return 'TV Series';
  const trimmed = val.trim();
  const lower = trimmed.toLowerCase();
  if (lower.includes('movie')) return 'Movie';
  if (lower.includes('ova/special')) return 'OVA/Special';
  if (lower.includes('ova') || lower.includes('special')) return 'OVA/Special';
  if (lower.includes('ona')) return 'ONA';
  if (lower.includes('tv') || lower.length > 0) return 'TV Series';
  return 'TV Series';
};

export const DubInfoModal: React.FC<DubInfoModalProps> = ({
  isOpen,
  mode = 'submit',
  initialData,
  onClose,
  onSubmit,
}) => {
  const { isSignedIn, user: clerkUser } = useUser();
  const { t } = useTranslation(['forms', 'common']);

  const initDataAny = initialData as any;

  // Form Fields & formData state for strict select binding
  const initialResolvedType = normalizeAnimeType(
    initDataAny?.type || initDataAny?.Type || (initialData as any)?.type || (initialData as any)?.Type || 'TV Series'
  );
  const [formData, setFormData] = useState<any>(() => ({
    ...(initialData || {}),
    type: initialResolvedType
  }));
  const [title, setTitle] = useState(initialData?.title || '');
  const [synopsis, setSynopsis] = useState<string>(
    initialData?.synopsis || initDataAny?.synopsis || initDataAny?.description || ''
  );
  const [romajiTitle, setRomajiTitle] = useState(initialData?.japanese_title || '');
  const [poster, setPoster] = useState(initialData?.poster_url || initDataAny?.cover_image || '');
  const [releaseYear, setReleaseYear] = useState<number | ''>(
    initialData?.release_year || initDataAny?.year || new Date().getFullYear()
  );
  const [rating, setRating] = useState<number | ''>(initialData?.rating !== undefined ? initialData.rating : '');
  const [type, setType] = useState<string>(initialResolvedType);
  const [studio, setStudio] = useState(initialData?.studio || '');
  const [genres, setGenres] = useState<string[]>(
    initialData?.genres 
      ? (typeof initialData.genres === 'string' ? initialData.genres.split(',').map((g: string) => g.trim()) : initialData.genres)
      : ['Action', 'Fantasy']
  );
  
  // Helper to safely parse and reconstruct mixed entries / seasons from initialData
  const parseMixedEntries = (data: any) => {
    if (!data) return [
      {
        id: Date.now() + 1,
        entryType: 'Season',
        seasonNumber: '1',
        episodes: '12',
        languages: [] as DubLanguage[]
      }
    ];

    const entries = data.mixed_entries || data.mixedEntries;
    let list: any[] = [];
    if (typeof entries === 'string' && entries.trim()) {
      try {
        const parsed = JSON.parse(entries);
        if (Array.isArray(parsed)) list = parsed;
      } catch (e) {
        console.warn('Failed to parse mixed_entries JSON:', e);
      }
    } else if (Array.isArray(entries)) {
      list = entries;
    }

    if (list.length > 0) {
      return list.map((e: any, idx: number) => ({
        id: e.id || `entry-${Date.now()}-${idx}`,
        entryType: e.entryType || e.type || 'Season',
        seasonNumber: e.seasonNumber || e.label || e.name || e.number || String(idx + 1),
        episodes: String(e.episodes !== undefined && e.episodes !== null ? e.episodes : (e.episodeCount !== undefined ? e.episodeCount : 12)),
        languages: (Array.isArray(e.languages) 
          ? e.languages.filter(Boolean)
          : (typeof e.languages === 'string' ? e.languages.split(',').map((s: string) => s.trim()).filter(Boolean) : [])) as DubLanguage[]
      }));
    }

    const defaultLangs = (Array.isArray(data.languages) 
      ? data.languages.filter(Boolean)
      : (typeof data.languages === 'string' && data.languages.trim() ? data.languages.split(',').map((s: string) => s.trim()).filter(Boolean) : [])) as DubLanguage[];
    const rawEp = data.episodes_per_season || data.Episodes || data.episodes || data.episodes_count;

    if (rawEp) {
      const epStr = String(rawEp);
      const episodesArray = epStr.split('|').map((ep: string) => ep.trim()).filter(Boolean);
      if (episodesArray.length > 0) {
        return episodesArray.map((epCount: string, idx: number) => ({
          id: Date.now() + Math.random() + idx,
          entryType: 'Season',
          seasonNumber: String(idx + 1),
          episodes: String(epCount),
          languages: defaultLangs
        }));
      }
    }

    return [
      {
        id: Date.now() + 2,
        entryType: 'Season',
        seasonNumber: data.release_season || data.season || '1',
        episodes: rawEp || data.episodes_count ? String(rawEp || data.episodes_count) : '',
        languages: defaultLangs
      }
    ];
  };

  // Advanced Progress Tracking (Mixed Entries)
  const [mixedEntries, setMixedEntries] = useState<{
    id: number | string;
    entryType: string;
    seasonNumber: string;
    episodes: string;
    languages: DubLanguage[];
  }[]>(() => parseMixedEntries(initialData));

  const seasonDetails = mixedEntries.map(entry => ({
    type: (entry.entryType as any) || 'Season',
    label: entry.seasonNumber || '1',
    episodeCount: entry.episodes === '' ? '' : Number(entry.episodes) || 0,
    languages: entry.languages || []
  }));

  const [currentSeason, setCurrentSeason] = useState<string>(initialData?.release_season || initDataAny?.season || '');
  const [currentlyAiringEpisode, setCurrentlyAiringEpisode] = useState<number | ''>(initialData?.episodes_count || '');

  // Helper to safely parse and reconstruct streaming partners from initialData
  const parseStreamingPartners = (data: any): { name: string; url: string; languages: string[] }[] => {
    if (!data) return [{ name: 'Crunchyroll', url: '', languages: [] }];
    const raw =
      data.streaming_partners ||
      data.streamingPartners ||
      data.platforms_data ||
      data.platformsData ||
      data.watch_providers;
    let list: any[] = [];
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = parsed;
      } catch (e) {
        console.warn('Failed to parse streaming partners JSON:', e);
      }
    } else if (Array.isArray(raw)) {
      list = raw;
    }

    const fallbackLangs = normalizePartnerLanguages(data.languages);
    const initialLangs = fallbackLangs;

    if (list.length > 0) {
      return list.map((item: any) => ({
        name: matchCanonicalPlatformName(item.name || item.platform) || 'Crunchyroll',
        url: String(item.url || item.watch_url || item.link || '').trim(),
        languages:
          item.languages !== undefined
            ? normalizePartnerLanguages(item.languages)
            : initialLangs,
      }));
    }

    const rawPlatformStr = String(data.platforms || data.platform || '').trim();
    const defaultUrl = String(data.watch_url || data.watchUrl || '').trim();
    const { partners: parsedFromPlatform } = parseCsvPlatformsField(
      rawPlatformStr,
      initialLangs,
      defaultUrl
    );
    if (parsedFromPlatform.length > 0) {
      return parsedFromPlatform.map((partner) => ({
        name: partner.name,
        url: partner.url,
        languages: partner.languages.length > 0 ? partner.languages : initialLangs,
      }));
    }

    return [{ name: 'Crunchyroll', url: defaultUrl, languages: initialLangs }];
  };

  // Multi-Platform Links
  const [streamingPartners, setStreamingPartners] = useState<{ 
    name: string; 
    url: string;
    languages: string[];
  }[]>(() => parseStreamingPartners(initialData));

  const resolveEditableStatus = (animeObj: any, resolvedType?: string): string => {
    const raw = String(animeObj?.status || animeObj?.airing_status || '').trim().toLowerCase();
    if (raw.includes('complete') || raw === 'finished' || raw === 'ended') return 'Completed';
    if (raw.includes('upcoming')) return 'Upcoming';
    if (raw.includes('ongoing') || raw.includes('simulcast')) return 'Ongoing';
    if (raw.includes('airing')) return 'Airing';
    const typeLower = String(resolvedType || animeObj?.type || animeObj?.Type || '').trim().toLowerCase();
    return typeLower.includes('movie') ? 'Completed' : 'Airing';
  };

  const [statusState, setStatusState] = useState<string>(() => resolveEditableStatus(initialData));
  const [releaseDay, setReleaseDay] = useState<string>(() => {
    const st = resolveEditableStatus(initialData);
    return st === 'Airing' || st === 'Ongoing' ? normalizeBroadcastDay(initialData) || '' : '';
  });
  const [broadcastTime, setBroadcastTime] = useState<string>(() => {
    const st = resolveEditableStatus(initialData);
    return st === 'Airing' || st === 'Ongoing' ? normalizeBroadcastTime(initialData) || '' : '';
  });

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setSynopsis(initialData.synopsis || initDataAny?.synopsis || initDataAny?.description || '');
      setRomajiTitle(initialData.japanese_title || '');
      setPoster(initialData.poster_url || initDataAny?.cover_image || '');
      setReleaseYear(initialData.release_year || initDataAny?.year || new Date().getFullYear());
      setRating(initialData.rating !== undefined ? initialData.rating : '');
      
      const rawType = initDataAny?.type || initDataAny?.Type || (initialData as any)?.type || (initialData as any)?.Type || 'TV Series';
      let cleanType = 'TV Series';
      if (rawType && typeof rawType === 'string') {
        const trimmed = rawType.trim();
        const lower = trimmed.toLowerCase();
        if (lower === 'movie' || lower === 'film' || lower.includes('movie')) cleanType = 'Movie';
        else if (lower === 'ova/special') cleanType = 'OVA/Special';
        else if (lower === 'ova') cleanType = 'OVA';
        else if (lower === 'ona') cleanType = 'ONA';
        else if (lower === 'special' || lower === 'specials') cleanType = 'Special';
        else if (lower.includes('ova') || lower.includes('special')) cleanType = 'OVA/Special';
        else if (lower === 'tv' || lower === 'tv series' || lower === 'series' || lower.includes('tv') || lower.length > 0) cleanType = 'TV Series';
        else cleanType = trimmed;
      }
      setType(cleanType);

      // State Initialization: Read actual database status directly without overriding valid Completed/Upcoming values
      const anime = initialData as any;
      const initialStatus = resolveEditableStatus(initDataAny, cleanType);
      const isAiringInitial = initialStatus === 'Airing' || initialStatus === 'Ongoing';
      setStatusState(initialStatus);
      setReleaseDay(isAiringInitial ? normalizeBroadcastDay(initDataAny) || '' : '');
      setBroadcastTime(isAiringInitial ? normalizeBroadcastTime(initDataAny) || '' : '');

      setFormData({ 
        ...anime, 
        type: cleanType,
        status: initialStatus,
        airing_status: initialStatus
      });

      // Re-populate mixed entries / seasons from initialData
      const parsedMixed = parseMixedEntries(initialData);
      setMixedEntries(parsedMixed);
      if (isAiringInitial) {
        setCurrentSeason(
          String(initDataAny?.current_season || initDataAny?.season || parsedMixed.length || '')
        );
        const last = parsedMixed[parsedMixed.length - 1];
        const liveEp = initDataAny?.live_episode ?? (last && last.episodes ? Number(last.episodes) : '');
        setCurrentlyAiringEpisode(liveEp !== '' && liveEp !== null && liveEp !== undefined ? Number(liveEp) || '' : '');
      } else {
        setCurrentSeason('');
        setCurrentlyAiringEpisode('');
      }

      // Re-populate streaming partners from initialData
      setStreamingPartners(parseStreamingPartners(initialData));
    } else {
      setTitle('');
      setSynopsis('');
      setRomajiTitle('');
      setPoster('');
      setReleaseYear(new Date().getFullYear());
      setRating('');
      setType('TV Series');
      setStatusState('Airing');
      setReleaseDay('');
      setBroadcastTime('');
      setStudio('');
      setGenres(['Action', 'Fantasy']);
      setMixedEntries([
        {
          id: Date.now() + 1,
          entryType: 'Season',
          seasonNumber: '1',
          episodes: '12',
          languages: [] as DubLanguage[]
        }
      ]);
      setStreamingPartners([{ name: 'Crunchyroll', url: '', languages: [] }]);
      setFormData({ type: 'TV Series', status: 'Airing' });
    }
  }, [initialData]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageUpload(file.size, file.type, file.name);
    if (!validation.valid) {
      toast.error('Invalid Image', validation.error || 'Please choose a valid JPG, PNG, or WebP image.');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        try {
          const data = await cloudflareApi.uploadImage(dataUrl, file.name, file.type);
          if (data && data.success) {
            const publicUrl = data.display_url || data.url;
            setPoster(publicUrl);
            setFormData((prev: any) => ({
              ...prev,
              poster: publicUrl,
              cover_image: publicUrl,
              posterUrl: publicUrl,
              image: publicUrl
            }));
          } else {
            toast.error('Upload Failed', 'Server did not return a valid image URL.');
          }
        } catch (err: any) {
          console.error('Cloudflare Proxy upload error:', err);
          toast.error('Upload Failed', err?.message || 'Could not upload image.');
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Image processing error:', err);
      toast.error('Upload Failed', err?.message || 'Could not read image file.');
      setIsUploading(false);
    }
  };

  const addStreamingPartner = () => {
    const globalSelectedLangs = Array.from(
      new Set(seasonDetails.flatMap((s) => s.languages || []))
    );
    setStreamingPartners(prev => {
      const updated = prev.map((partner, idx) => {
        // When transitioning from 1 -> 2 platforms, sync the first platform's initial languages
        // from the global Available Languages selection so it matches what was previously configured.
        if (prev.length === 1 && idx === 0 && globalSelectedLangs.length > 0) {
          return { ...partner, languages: globalSelectedLangs };
        }
        return partner;
      });
      return [...updated, { name: 'Crunchyroll', url: '', languages: [] }];
    });
  };

  const removeStreamingPartner = (index: number) => {
    if (streamingPartners.length > 1) {
      setStreamingPartners(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateStreamingPartner = (index: number, field: 'name' | 'url' | 'languages', value: any) => {
    setStreamingPartners(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const toggleLangForPartner = (partnerIndex: number, lang: string) => {
    setStreamingPartners(prev =>
      prev.map((partner, idx) => {
        if (idx !== partnerIndex) return partner;
        const currentLangs = Array.isArray(partner.languages) ? partner.languages : [];
        const nextLangs = currentLangs.includes(lang)
          ? currentLangs.filter((l) => l !== lang)
          : [...currentLangs, lang];
        return { ...partner, languages: nextLangs };
      })
    );
  };

  const addEntry = () => {
    setMixedEntries(prev => {
      const lastEntry = prev[prev.length - 1];
      let nextNum = '1';
      if (lastEntry && !isNaN(parseInt(lastEntry.seasonNumber))) {
        nextNum = (parseInt(lastEntry.seasonNumber) + 1).toString();
      }
      return [...prev, {
        id: Date.now() + Math.random(),
        entryType: 'Season',
        seasonNumber: nextNum,
        episodes: '12',
        languages: lastEntry?.languages || []
      }];
    });
  };

  const removeEntry = (index: number) => {
    setMixedEntries(prev => {
      if (prev.length > 1) {
        return prev.filter((_, i) => i !== index);
      }
      return prev;
    });
  };

  const updateEntryField = (index: number, field: string, value: any) => {
    setMixedEntries(prev => {
      const updated = [...prev];
      if (!updated[index]) return prev;
      if (field === 'episodeCount' || field === 'episodes') {
        updated[index] = { ...updated[index], episodes: String(value) };
      } else if (field === 'label' || field === 'number' || field === 'seasonNumber') {
        updated[index] = { ...updated[index], seasonNumber: String(value) };
      } else if (field === 'type' || field === 'entryType') {
        updated[index] = { ...updated[index], entryType: value };
      } else if (field === 'languages') {
        updated[index] = { ...updated[index], languages: value };
      }
      return updated;
    });
  };

  const toggleLangForEntry = (entryIdx: number, lang: DubLanguage) => {
    const currentLangs = seasonDetails[entryIdx].languages || [];
    let updatedLangs: DubLanguage[];
    if (currentLangs.includes(lang)) {
      updatedLangs = currentLangs.filter(l => l !== lang);
    } else {
      updatedLangs = [...currentLangs, lang];
    }
    updateEntryField(entryIdx, 'languages', updatedLangs);
  };

  const toggleGenre = (genre: string) => {
    if (genres.includes(genre)) {
      setGenres(genres.filter((g) => g !== genre));
    } else {
      setGenres([...genres, genre]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) {
      setFormError('Anime title is required.');
      return;
    }

    setIsSubmitting(true);

    // Duplicate Validation: verify if an anime with the same Title already exists
    if (mode === 'submit') {
      try {
        const { data: existing } = await cloudflareApi.fetchCatalog({ search: title.trim() });
        const cleanTitle = title.toLowerCase().replace(/\s+/g, ' ').trim();
        const isDuplicate = existing.some((item: any) => 
          (item.title || '').toLowerCase().replace(/\s+/g, ' ').trim() === cleanTitle
        );
        
        if (isDuplicate) {
          const dupMsg = 'This anime already exists in our database!';
          setFormError(dupMsg);
          toast.error('Anime Already Exists', dupMsg);
          setIsSubmitting(false);
          return;
        }
      } catch (err) {
        console.warn('Duplicate check failed, proceeding with safety fallbacks:', err);
      }
    }

    const seasonLanguages = Array.from(
      new Set(seasonDetails.flatMap((s) => s.languages || []))
    );
    const { serializedPartners, derivedGlobalDubs } = buildStreamingPartnersPayload(
      streamingPartners,
      seasonLanguages
    );

    const rawPoster = (poster || formData.posterUrl || formData.poster || formData.image || formData.cover_image || '').trim();
    if (rawPoster) {
      const posterCheck = validateExternalImageUrl(rawPoster, { required: false, fieldName: 'Poster Image URL' });
      if (!posterCheck.ok) {
        const posterErr = posterCheck.error || 'Poster must be a valid HTTPS image URL.';
        setFormError(posterErr);
        toast.error('Invalid Poster URL', posterErr);
        setIsSubmitting(false);
        return;
      }
    }

    const derivedOfficialSourceUrl = deriveOfficialSourceUrlFromPartners(serializedPartners);
    const sourceUrlCheck = validateOfficialSourceUrl(derivedOfficialSourceUrl, 'Streaming Partner URL');
    if (!sourceUrlCheck.ok) {
      const urlErr = sourceUrlCheck.error || 'Primary streaming link must be a valid HTTP or HTTPS URL.';
      setFormError(urlErr);
      toast.error('Invalid Streaming Partner URL', urlErr);
      setIsSubmitting(false);
      return;
    }

    const normalizedSeasonEpCount = deriveSeasonEpisodeCountSummary(mixedEntries);

    const defaultCover = rawPoster || '/logo.png';

    try {

      const totalEpisodes = seasonDetails.reduce((acc, s) => acc + (Number(s.episodeCount) || 0), 0);
      
      const parsedRating = (rating !== '' && rating !== undefined) ? Number(rating) : 7.8;
      const parsedYear = releaseYear ? Number(releaseYear) : 2025;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const isAdminSessionVerified = Boolean(
        isSignedIn && clerkUser && isAuthorizedClerkAdmin(clerkUser)
      );
      const resolvedSubmissionStatus = mode === 'edit'
        ? (initialData?.submissionStatus || initialData?.approval_status || 'approved')
        : (isAdminSessionVerified ? 'approved' : 'pending');

      const formattedMixedEntries = mixedEntries.map(entry => ({
        id: entry.id,
        type: entry.entryType || 'Season',
        entryType: entry.entryType || 'Season',
        name: entry.seasonNumber 
          ? (/^(season|ova|movie|ona|special)/i.test(entry.seasonNumber.trim()) ? entry.seasonNumber.trim() : `${entry.entryType || 'Season'} ${entry.seasonNumber.trim()}`)
          : `${entry.entryType || 'Season'} 1`,
        seasonNumber: entry.seasonNumber || '1',
        label: entry.seasonNumber || '1',
        episodes: Number(entry.episodes) || 0,
        episodeCount: Number(entry.episodes) || 0,
        languages: entry.languages || derivedGlobalDubs
      }));
      const episodesPerSeasonStr = mixedEntries.map(e => e.episodes || 0).join('|');

      const isAiringStatus = statusState === 'Airing' || statusState === 'Ongoing';
      const resolvedBroadcastDay = isAiringStatus ? releaseDay.trim() || null : null;
      const resolvedBroadcastTime = isAiringStatus ? broadcastTime.trim() || null : null;
      const resolvedCurrentSeason = isAiringStatus ? currentSeason.trim() || null : null;
      const resolvedLiveEpisode =
        isAiringStatus && currentlyAiringEpisode !== '' && Number.isFinite(Number(currentlyAiringEpisode))
          ? Number(currentlyAiringEpisode)
          : null;

      const payload = {
        title: title.trim(),
        slug,
        synopsis: synopsis.trim(),
        cover_image: defaultCover,
        banner_image: defaultCover,
        rating: parsedRating,
        episodes_count: totalEpisodes > 0 ? totalEpisodes : null,
        status: statusState,
        airing_status: statusState,
        submissionStatus: resolvedSubmissionStatus,
        languages: derivedGlobalDubs.join(', '),
        platform: normalizePlatformString(serializedPartners.map((p) => p.name).filter(Boolean)),
        watch_url: (serializedPartners.find(p => p.url?.trim())?.url || serializedPartners[0]?.url || '').trim(),
        streaming_partners: serializedPartners,
        platforms_data: serializedPartners,
        watch_providers: serializedPartners,
        mixed_entries: formattedMixedEntries,
        mixedEntries: formattedMixedEntries,
        episodes_per_season: episodesPerSeasonStr,
        type: formData.type || type || 'TV Series',
        season: resolvedCurrentSeason,
        current_season: resolvedCurrentSeason,
        live_episode: resolvedLiveEpisode,
        year: parsedYear,
        genres: Array.isArray(genres) ? genres.join(',') : genres,
        popularity: 0,
        upvotes: 0,
        studio: studio || 'Unknown Studio',
        broadcast_day: resolvedBroadcastDay,
        broadcast_time: resolvedBroadcastTime,
        releaseDay: resolvedBroadcastDay || '',
        airTime: resolvedBroadcastTime || '',
        season_episode_count: normalizedSeasonEpCount,
        official_source_url: sourceUrlCheck.url || '',
      };

      let savedResult: any = null;
      if (mode === 'edit' && initialData?.id) {
        savedResult = await cloudflareApi.updateAnime(initialData.id, payload);
      } else if (isAdminSessionVerified) {
        savedResult = await cloudflareApi.createAnime(payload);
      } else {
        savedResult = await cloudflareApi.submitCommunityAnime(payload);
      }

      if (savedResult && savedResult.success === false) {
        throw new Error(savedResult.error || 'Server rejected the anime update.');
      }

      const fullUpdatedItem = {
        ...payload,
        id: initialData?.id || savedResult?.animeId || savedResult?.id,
        streaming_partners: payload.streaming_partners,
        platforms_data: payload.platforms_data,
        watch_providers: payload.watch_providers,
        mixed_entries: formattedMixedEntries,
        mixedEntries: formattedMixedEntries,
        episodes_per_season: episodesPerSeasonStr,
        watch_url: payload.watch_url,
        platform: payload.platform,
        synopsis: synopsis.trim(),
        status: statusState,
        airing_status: statusState,
        broadcast_day: resolvedBroadcastDay,
        broadcast_time: resolvedBroadcastTime,
        season: resolvedCurrentSeason,
        current_season: resolvedCurrentSeason,
        live_episode: resolvedLiveEpisode,
        season_episode_count: normalizedSeasonEpCount,
        official_source_url: sourceUrlCheck.url || '',
        cover_image: defaultCover,
        image: defaultCover,
        poster: defaultCover,
        posterUrl: defaultCover,
        poster_url: defaultCover,
        _savedToServer: true,
      };

      // Trigger parent state update immediately
      onSubmit(fullUpdatedItem);

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('[Submission error]:', err);
      const errMsg = err?.message || 'Could not save to Cloudflare D1. Please check your connection and try again.';
      setFormError(errMsg);
      toast.error(
        mode === 'edit' ? 'Failed to Save Changes' : 'Submission Failed',
        errMsg
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const platformOptions: string[] = [...CANONICAL_STREAMING_PLATFORMS];

  const shouldReduceMotion = useReducedMotion();
  const [activeGuidedStep, setActiveGuidedStep] = useState<1 | 2 | 3>(1);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState<boolean>(false);

  const hasUnsavedChanges = Boolean(
    !isSuccess &&
      mode === 'submit' &&
      (title.trim().length > 0 || synopsis.trim().length > 0)
  );

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto font-sans">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        onClick={handleRequestClose}
        className="fixed inset-0 bg-[var(--bg-canvas)]/85"
      />

      <motion.div 
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        className="relative w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden z-10 my-auto text-[var(--text-primary)] max-h-[90vh] flex flex-col font-sans"
      >
        
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-elevated)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-black text-base sm:text-lg text-[var(--text-primary)] leading-tight">
                {mode === 'edit' ? 'Edit Anime Info' : t('forms:submitDub.title', 'Submit Dub Info')}
              </h3>
              {mode !== 'edit' && (
                <p className="text-[11px] text-[#F9C876] font-semibold flex items-center gap-1 mt-0.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Strict Moderation: Requires Admin Approval</span>
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleRequestClose}
            aria-label="Close modal"
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center transition-colors duration-150 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Step Guided Flow Progress Header */}
        {!isSuccess && (
          <div
            data-testid="dub-submit-guided-steps"
            className="px-4 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] grid grid-cols-3 gap-1.5 shrink-0"
          >
            {[
              { step: 1 as const, label: '1. Identify anime' },
              { step: 2 as const, label: '2. Dub info & OTT' },
              { step: 3 as const, label: '3. Verify & submit' },
            ].map((item) => {
              const isActive = activeGuidedStep === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setActiveGuidedStep(item.step)}
                  className={`min-h-[44px] px-2.5 py-1.5 rounded-[10px] text-[11px] sm:text-[12px] font-bold border transition-colors ${
                    isActive
                      ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-hover)] border-[var(--accent-primary)]/50'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Unsaved Changes Confirmation Banner */}
        {showUnsavedConfirm && (
          <div
            role="alert"
            data-testid="unsaved-changes-confirm"
            className="px-4 py-3 bg-[var(--bg-elevated)] border-b border-[#F9C876]/40 flex flex-wrap items-center justify-between gap-3 shrink-0"
          >
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Discard unsaved dub submission changes?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowUnsavedConfirm(false)}
                className="min-h-[44px] px-3 rounded-[10px] bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-xs font-semibold"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedConfirm(false);
                  onClose();
                }}
                className="min-h-[44px] px-3 rounded-[10px] bg-red-500/20 text-[#F87171] border border-red-500/30 text-xs font-bold"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* SCROLLING BODY */}
        <div className="flex-1 overflow-y-auto pb-28">
          <div className="p-5 sm:p-6 space-y-4">
            {isSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-[#34D399]/15 border border-[#34D399]/35 flex items-center justify-center mx-auto text-[#34D399]">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="font-heading font-black text-xl text-[var(--text-primary)]">
                  {mode === 'edit' ? 'Changes Saved Successfully!' : 'Saved with Status: "Pending"!'}
                </h4>
                <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
                  {mode === 'edit'
                    ? 'Your edits have been successfully saved and updated directly in the live catalog.'
                    : 'Your submission is currently locked under Strict Moderation. It has been sent to the Admin Dashboard and will remain hidden from the website until approved.'}
                </p>
              </div>
            ) : (
              <form id="dub-info-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
                {formError && (
                  <div
                    role="alert"
                    className="p-3 rounded-[12px] bg-[#F87171]/10 border border-[#F87171]/35 text-[#F87171] text-xs flex items-start justify-between gap-2"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#F87171]" />
                      <span>{formError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormError(null)}
                      aria-label="Dismiss form error"
                      className="text-[#F87171] hover:text-[var(--text-primary)] p-0.5 cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Title Field */}
                <div>
                  <label className="block font-bold text-[var(--text-primary)] mb-1.5 flex items-center justify-between">
                    <span>{t('forms:submitDub.animeTitleLabel', 'Anime Title')} <span className="text-[var(--accent-primary)]">*</span></span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      placeholder="e.g. Solo Leveling, Demon Slayer, Jujutsu Kaisen..."
                      className="w-full min-h-[44px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] rounded-[12px] py-2.5 pl-3.5 pr-9 text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors duration-180"
                    />
                    <Search className="w-4 h-4 text-[var(--text-secondary)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Synopsis Field */}
                <div>
                  <label className="block font-bold text-[var(--text-primary)] mb-1.5 flex items-center justify-between">
                    <span>Synopsis</span>
                    <span className="text-[10px] text-[var(--text-secondary)] font-normal">Plot summary &amp; overview</span>
                  </label>
                  <textarea
                    rows={4}
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                    placeholder="Type or paste a descriptive summary of the anime..."
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] rounded-[12px] py-2.5 px-3.5 text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors duration-180 resize-y leading-relaxed font-sans"
                  />
                </div>

                {/* Poster Upload Area */}
                <div>
                  <label className="block font-bold text-[var(--text-primary)] mb-1 flex items-center justify-between">
                    <span>Anime Poster (Upload File or Enter URL)</span>
                  </label>
                  <div className="space-y-2">
                    <div className="flex gap-3 items-center">
                      <div 
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                        className="flex-1 h-16 border border-dashed border-[var(--border-subtle)] hover:border-[var(--accent-primary)] rounded-xl bg-[var(--bg-elevated)] flex flex-col items-center justify-center cursor-pointer transition-colors duration-150 group"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 text-[var(--accent-primary)] animate-spin mb-0.5" />
                            <span className="text-[10px] text-[var(--text-primary)] font-bold uppercase tracking-wider">
                              Uploading...
                            </span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] mb-0.5" />
                            <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider group-hover:text-[var(--text-primary)]">
                              {poster ? 'Change Uploaded Photo' : 'Upload Image File'}
                            </span>
                          </>
                        )}
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          onChange={handleImageUpload}
                          accept="image/*"
                          className="hidden" 
                        />
                      </div>
                      {(poster || formData.poster) && (
                        <div className="relative shrink-0">
                          <img
                            src={poster || formData.poster || undefined}
                            alt="Preview"
                            className="w-12 h-16 object-cover rounded-xl border border-[var(--accent-primary)]/50"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              setPoster('');
                              setFormData((prev: any) => ({
                                ...prev,
                                poster: '',
                                cover_image: '',
                                posterUrl: '',
                                image: ''
                              }));
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[var(--accent-primary)] rounded-full flex items-center justify-center text-[var(--accent-on-primary)] border border-[var(--bg-canvas)] hover:bg-[var(--accent-hover)] transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={poster || formData.poster || ''}
                      onChange={(e) => {
                        setPoster(e.target.value);
                        setFormData((prev: any) => ({
                          ...prev,
                          poster: e.target.value,
                          cover_image: e.target.value,
                          posterUrl: e.target.value,
                          image: e.target.value
                        }));
                      }}
                      placeholder="Or paste poster image URL (https://...)"
                      className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] rounded-xl py-2 px-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors duration-150"
                    />
                  </div>
                </div>

                {/* Streaming Partners */}
                <div className="space-y-2">
                  <label className="block font-bold text-[var(--text-primary)] mb-1 flex items-center justify-between">
                    <span>Streaming Partners &amp; Per-Platform Dubs</span>
                    <button 
                      type="button" 
                      onClick={addStreamingPartner}
                      className="text-[11px] text-[var(--accent-primary)] font-bold hover:text-[var(--accent-hover)] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Add Platform
                    </button>
                  </label>
                  
                  <div className="space-y-3">
                    {streamingPartners.map((partner, idx) => {
                      const selectOptions =
                        partner.name && !platformOptions.includes(partner.name)
                          ? [partner.name, ...platformOptions]
                          : platformOptions;
                      const activePlatformLabel = partner.name?.trim() || selectOptions[0] || 'Platform';

                      return (
                        <div key={`stream_partner_${idx}`} className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-2.5">
                          <div className="flex gap-2 items-start">
                            <div className="w-1/3">
                              <select
                                value={partner.name}
                                onChange={(e) => updateStreamingPartner(idx, 'name', e.target.value)}
                                className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl px-2.5 py-2 text-[11px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                              >
                                {selectOptions.map((platOption) => (
                                  <option key={platOption} value={platOption}>{platOption}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex-1 relative">
                              <input
                                type="url"
                                value={partner.url}
                                onChange={(e) => updateStreamingPartner(idx, 'url', e.target.value)}
                                placeholder="Link (e.g. https://www.crunchyroll.com/...)"
                                className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                              />
                            </div>
                            {streamingPartners.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeStreamingPartner(idx)}
                                className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[#F87171] hover:border-[#F87171]/40 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Per-Platform Language Selection Checkboxes */}
                          {streamingPartners.length > 1 && (
                            <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                  Languages on {activePlatformLabel}
                                </span>
                                <span className="text-[10px] text-[var(--accent-primary)] font-semibold truncate max-w-[55%]">
                                  {partner.languages && partner.languages.length > 0
                                    ? partner.languages.join(', ')
                                    : 'Select dubs'}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {PLATFORM_LANGS.map((lang) => {
                                  const isChecked = Array.isArray(partner.languages) && partner.languages.includes(lang);
                                  return (
                                    <label
                                      key={`partner_${idx}_lang_${lang}`}
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors duration-150 cursor-pointer select-none ${
                                        isChecked
                                          ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] font-bold border border-[var(--accent-primary)]'
                                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleLangForPartner(idx, lang)}
                                        className="sr-only"
                                      />
                                      <span
                                        aria-hidden="true"
                                        className={`w-3 h-3 rounded flex items-center justify-center text-[9px] font-black border ${
                                          isChecked
                                            ? 'bg-[var(--bg-canvas)] text-[var(--accent-primary)] border-[var(--bg-canvas)]'
                                            : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-transparent'
                                        }`}
                                      >
                                        ✓
                                      </span>
                                      <span>{lang}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Broadcast Metadata Grid (Type, Status, Broadcast Day, Broadcast Time) */}
                {(() => {
                  const showScheduleFields = statusState === 'Airing' || statusState === 'Ongoing';
                  return (
                    <div className={`grid grid-cols-1 ${showScheduleFields ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'} gap-3`}>
                      <div>
                        <label className="block font-bold text-[var(--text-primary)] mb-1">Type</label>
                        <select 
                          value={formData.type || type || 'TV Series'} 
                          onChange={(e) => {
                            const newType = e.target.value;
                            setFormData((prev: any) => ({ ...prev, type: newType }));
                            setType(newType);
                            if (newType === 'Movie') {
                              setStatusState('Completed');
                              setReleaseDay('');
                              setBroadcastTime('');
                              setCurrentSeason('');
                              setCurrentlyAiringEpisode('');
                              setFormData((prev: any) => ({ ...prev, status: 'Completed', airing_status: 'Completed' }));
                            }
                          }}
                          className="w-full min-h-[44px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[12px] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer text-xs transition-colors duration-180"
                        >
                          <option value="TV Series">TV Series</option>
                          <option value="Movie">Movie</option>
                          <option value="OVA/Special">OVA/Special</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-[var(--text-primary)] mb-1">Status</label>
                        <select
                          aria-label="Anime Status"
                          value={statusState}
                          onChange={(e) => {
                            const newStatus = e.target.value;
                            setStatusState(newStatus);
                            if (newStatus !== 'Airing' && newStatus !== 'Ongoing') {
                              setReleaseDay('');
                              setBroadcastTime('');
                              setCurrentSeason('');
                              setCurrentlyAiringEpisode('');
                            }
                            setFormData((prev: any) => ({ ...prev, status: newStatus, airing_status: newStatus }));
                          }}
                          className="w-full min-h-[44px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[12px] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer text-xs transition-colors duration-180"
                        >
                          <option value="Airing">Airing</option>
                          <option value="Completed">Completed</option>
                          <option value="Ongoing">Ongoing (Simulcast)</option>
                          <option value="Upcoming">Upcoming</option>
                        </select>
                      </div>

                      {showScheduleFields && (
                        <div>
                          <label className="block font-bold text-[var(--text-primary)] mb-1">Broadcast Day</label>
                          <select
                            value={releaseDay}
                            onChange={(e) => setReleaseDay(e.target.value)}
                            aria-label="Broadcast Day"
                            className="w-full min-h-[44px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[12px] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer text-xs transition-colors duration-180"
                          >
                            <option value="">TBA / Unscheduled</option>
                            {ALL_DAYS.map((day) => (
                              <option key={day} value={day}>{day}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {showScheduleFields && (
                        <div>
                          <label className="block font-bold text-[var(--text-primary)] mb-1">Broadcast Time (IST)</label>
                          <input
                            type="text"
                            value={broadcastTime}
                            onChange={(e) => setBroadcastTime(e.target.value)}
                            placeholder="e.g. 08:30 PM IST"
                            aria-label="Broadcast Time"
                            maxLength={40}
                            className="w-full min-h-[44px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[12px] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)] transition-colors duration-180"
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Currently Airing Box */}
                {(statusState === 'Airing' || statusState === 'Ongoing') && (
                  <div className="bg-[var(--bg-elevated)] border border-[#F9C876]/35 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#F9C876] text-xs font-bold uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-[#F9C876]" />
                        <span>Currently Airing Details</span>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-[#F9C876]" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">Current Season</label>
                        <input
                          type="text"
                          value={currentSeason}
                          onChange={(e) => setCurrentSeason(e.target.value)}
                          placeholder="e.g. Season 2"
                          className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[#F9C876] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">Live Episode</label>
                        <input
                          type="number"
                          value={currentlyAiringEpisode}
                          onChange={(e) => setCurrentlyAiringEpisode(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                          placeholder="e.g. 5"
                          className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[#F9C876] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Mixed Entries Section */}
                <div className="space-y-3">
                  <label className="block font-bold text-[var(--text-primary)] mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Tv className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Mixed Entries (Seasons, OVAs, Movies)</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={addEntry}
                      className="text-[11px] text-[var(--accent-primary)] font-bold hover:text-[var(--accent-hover)] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Add Entry
                    </button>
                  </label>

                  <div className="space-y-2.5">
                    {seasonDetails.map((entry, idx) => (
                      <div key={`season_entry_${idx}`} className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-2.5">
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-4">
                            <select
                              value={entry.type}
                              onChange={(e) => updateEntryField(idx, 'type', e.target.value)}
                              className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl px-2 py-1.5 text-[11px] text-[var(--text-primary)] outline-none cursor-pointer"
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
                              placeholder="Label"
                              className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl px-2 py-1.5 text-[11px] text-[var(--text-primary)] outline-none"
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              value={entry.episodeCount}
                              onChange={(e) => updateEntryField(idx, 'episodeCount', e.target.value)}
                              placeholder="Eps"
                              className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl px-2 py-1.5 text-[11px] text-[var(--text-primary)] outline-none"
                            />
                          </div>
                          <div className="col-span-2 flex justify-center items-center">
                            {seasonDetails.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeEntry(idx)}
                                className="p-1.5 rounded-xl text-[var(--text-secondary)] hover:text-[#F87171] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Language Pill Toggles */}
                        <div>
                          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Available Languages:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_LANGS.map(sl => {
                              const isSel = entry.languages.includes(sl);
                              return (
                                <button
                                  key={sl}
                                  type="button"
                                  onClick={() => toggleLangForEntry(idx, sl)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors duration-150 cursor-pointer ${
                                    isSel
                                      ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] font-bold border border-[var(--accent-primary)]'
                                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                                  }`}
                                >
                                  {sl}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Genres */}
                <div>
                  <label className="block font-bold text-[var(--text-primary)] mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>Genres</span>
                      <span className="text-[10px] text-[var(--text-secondary)] font-normal">(Select all that apply)</span>
                    </span>
                    <span className="text-[10px] text-[var(--accent-primary)] font-bold">{genres.length} selected</span>
                  </label>
                  <div className="flex flex-wrap gap-2 p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] max-h-48 overflow-y-auto no-scrollbar">
                    {AVAILABLE_GENRES.map((g) => {
                      const isSelected = genres.includes(g);
                      return (
                        <button
                          type="button"
                          key={g}
                          onClick={() => toggleGenre(g)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border border-[var(--accent-primary)]'
                              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                          }`}
                        >
                          {isSelected && <span className="text-[var(--accent-on-primary)] text-xs font-black">✓</span>}
                          <span>{g}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Studio, Year, Rating */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-[var(--text-secondary)] mb-1">Studio</label>
                    <input
                      type="text"
                      value={studio}
                      onChange={(e) => setStudio(e.target.value)}
                      placeholder="e.g. Ufotable"
                      className="w-full min-h-[44px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] rounded-[12px] px-3 py-2 text-[var(--text-primary)] text-xs outline-none transition-colors duration-180"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[var(--text-secondary)] mb-1">Year</label>
                    <input
                      type="number"
                      value={releaseYear}
                      onChange={(e) => setReleaseYear(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                      placeholder="2025"
                      className="w-full min-h-[44px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] rounded-[12px] px-3 py-2 text-[var(--text-primary)] text-xs outline-none transition-colors duration-180"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[var(--text-secondary)] mb-1">Rating</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={rating}
                      onChange={(e) => setRating(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="8.5"
                      className="w-full min-h-[44px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] rounded-[12px] px-3 py-2 text-[var(--text-primary)] text-xs outline-none transition-colors duration-180"
                    />
                  </div>
                </div>

                {/* Strict Moderation Gate Card */}
                <div className="rounded-xl p-4 bg-[var(--bg-elevated)] border border-[#F9C876]/35 space-y-1.5">
                  <div className="flex items-center gap-2 text-[#F9C876] text-xs font-bold">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Strict Moderation Gate</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    This submission will be saved with <span className="text-[#F9C876] font-bold">approval status: "pending"</span>. It will <span className="text-[#F87171] font-bold">NEVER</span> appear on the public website until approved by the admin.
                  </p>
                </div>

              </form>
            )}
          </div>
        </div>

        {/* STICKY FOOTER BUTTON */}
        {!isSuccess && (
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] z-50">
            <button
              type="submit"
              form="dub-info-form"
              disabled={isSubmitting || !title.trim()}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-on-primary)] font-black text-sm flex items-center justify-center gap-2.5 cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2 text-[var(--accent-on-primary)]">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{mode === 'edit' ? 'Saving changes...' : t('forms:submitDub.submitting', 'Submitting...')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <Send className="w-4 h-4" />
                  <span>{mode === 'edit' ? 'Save Anime Changes' : t('forms:submitDub.submitCta', 'Submit Dub for Admin Approval')}</span>
                </div>
              )}
            </button>
          </div>
        )}

      </motion.div>
    </div>
  );
};
