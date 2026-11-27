import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Save,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Search,
  Loader2,
  Plus,
  Trash2,
  Eye,
  Film,
  Image as ImageIcon,
  Globe,
  Layers,
  Languages,
  ShieldCheck,
  X,
} from 'lucide-react';
import { cloudflareApi } from '../../services/cloudflareApi';
import {
  computeMetadataFieldDiffs,
  type ExternalMetadataCandidate,
  type MetadataFieldDiff,
  type AnimeEditorTabId,
} from '../../utils/adminOpsPro';
import { OFFICIAL_INDIAN_LANGUAGES } from './types';

export interface AdminAnimeEditorViewProps {
  initialAnime?: any | null;
  initialTab?: AnimeEditorTabId;
  onCancel: () => void;
  onSaved: (savedAnime: any, isNew: boolean) => void;
  onOpenTranslationsForAnime?: (animeId: string | number) => void;
  onOpenFranchiseBuilder?: (franchiseKey?: string) => void;
  onOpenCastManager?: (animeId: string | number) => void;
}

interface PartnerDraft {
  name: string;
  url: string;
  languages: string[];
  episodeCount: string;
}

interface SeasonEntryDraft {
  type: string;
  name: string;
  episodes: string;
}

const EDITOR_TABS: Array<{ id: AnimeEditorTabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'identity', label: 'Identity', icon: Film },
  { id: 'artwork', label: 'Artwork', icon: ImageIcon },
  { id: 'metadata', label: 'Metadata', icon: Layers },
  { id: 'dubs', label: 'Regional Dubs & OTT', icon: Globe },
  { id: 'seasons', label: 'Seasons & Episodes', icon: Layers },
  { id: 'translations', label: 'Translations', icon: Languages },
  { id: 'publish', label: 'Review & Publish', icon: ShieldCheck },
];

const GENRE_PRESETS = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mecha',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

const OTT_PRESETS = [
  'Crunchyroll',
  'Netflix',
  'JioHotstar',
  'Prime Video',
  'Muse India (YouTube)',
  'Ani-One India (YouTube)',
  'Sony YAY!',
  'Hungama TV',
];

export const AdminAnimeEditorView: React.FC<AdminAnimeEditorViewProps> = ({
  initialAnime,
  initialTab = 'identity',
  onCancel,
  onSaved,
  onOpenTranslationsForAnime,
  onOpenFranchiseBuilder,
  onOpenCastManager,
}) => {
  const isEditing = Boolean(initialAnime && (initialAnime.id || initialAnime._id));
  const [activeTab, setActiveTab] = useState<AnimeEditorTabId>(initialTab);
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Core Form State — NEVER auto-populate Tamil/Hindi/Telugu defaults on new entries!
  const [title, setTitle] = useState('');
  const [alternativeTitles, setAlternativeTitles] = useState('');
  const [slug, setSlug] = useState('');
  const [externalId, setExternalId] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [bannerImage, setBannerImage] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [animeType, setAnimeType] = useState('TV Series');
  const [airingStatus, setAiringStatus] = useState<'Airing' | 'Completed' | 'Upcoming'>('Airing');
  const [releaseYear, setReleaseYear] = useState<string>(String(new Date().getFullYear()));
  const [seasonName, setSeasonName] = useState('');
  const [studio, setStudio] = useState('');
  const [rating, setRating] = useState<string>('8.5');
  const [genres, setGenres] = useState<string[]>([]);
  const [episodesCount, setEpisodesCount] = useState<string>('');
  const [seasonEpisodeCount, setSeasonEpisodeCount] = useState<string>('');
  const [broadcastDay, setBroadcastDay] = useState<string>('');
  const [broadcastTime, setBroadcastTime] = useState<string>('');
  const [franchiseId, setFranchiseId] = useState<string>('');
  const [relationType, setRelationType] = useState<string>('');
  const [sequenceNumber, setSequenceNumber] = useState<string>('');

  // Regional Dubs & OTT State (Starts EMPTY [] / Unverified by default)
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [dubVerificationStatus, setDubVerificationStatus] = useState<
    'unverified' | 'complete' | 'partial' | 'announced'
  >('unverified');
  const [primaryPlatform, setPrimaryPlatform] = useState<string>('');
  const [watchUrl, setWatchUrl] = useState<string>('');
  const [officialSourceUrl, setOfficialSourceUrl] = useState<string>('');
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string>('');
  const [partners, setPartners] = useState<PartnerDraft[]>([]);
  const [seasonEntries, setSeasonEntries] = useState<SeasonEntryDraft[]>([]);

  // 1-Click Auto-Fill Metadata Drawer State
  const [isAutoFillOpen, setIsAutoFillOpen] = useState(false);
  const [autoFillProvider, setAutoFillProvider] = useState<'anilist' | 'jikan'>('anilist');
  const [autoFillQuery, setAutoFillQuery] = useState('');
  const [isSearchingMeta, setIsSearchingMeta] = useState(false);
  const [metaSearchError, setMetaSearchError] = useState<string | null>(null);
  const [metaCandidates, setMetaCandidates] = useState<ExternalMetadataCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ExternalMetadataCandidate | null>(null);
  const [fieldDiffs, setFieldDiffs] = useState<MetadataFieldDiff[]>([]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Hydrate initialAnime when editing
  useEffect(() => {
    if (!initialAnime) {
      setTitle('');
      setAlternativeTitles('');
      setSlug('');
      setExternalId('');
      setCoverImage('');
      setBannerImage('');
      setSynopsis('');
      setAnimeType('TV Series');
      setAiringStatus('Airing');
      setReleaseYear(String(new Date().getFullYear()));
      setSeasonName('');
      setStudio('');
      setRating('8.5');
      setGenres([]);
      setEpisodesCount('');
      setSeasonEpisodeCount('');
      setBroadcastDay('');
      setBroadcastTime('');
      setFranchiseId('');
      setRelationType('');
      setSequenceNumber('');
      setSelectedLanguages([]);
      setDubVerificationStatus('unverified');
      setPrimaryPlatform('');
      setWatchUrl('');
      setOfficialSourceUrl('');
      setLastVerifiedAt('');
      setPartners([]);
      setSeasonEntries([]);
      setIsDirty(false);
      return;
    }

    setTitle(String(initialAnime.title || '').trim());
    setAlternativeTitles(String(initialAnime.hindiTitle || initialAnime.alternative_titles || '').trim());
    setSlug(String(initialAnime.slug || '').trim());
    setExternalId(String(initialAnime.external_id || initialAnime.imdbID || '').trim());
    setCoverImage(
      String(
        initialAnime.cover_image ||
          initialAnime.posterUrl ||
          initialAnime.image ||
          initialAnime.poster ||
          ''
      ).trim()
    );
    setBannerImage(String(initialAnime.banner_image || '').trim());
    setSynopsis(String(initialAnime.synopsis || initialAnime.description || '').trim());
    setAnimeType(String(initialAnime.type || initialAnime.Type || 'TV Series').trim() || 'TV Series');

    const rawStatus = String(initialAnime.airing_status || initialAnime.status || '').toLowerCase();
    if (rawStatus.includes('upcoming')) setAiringStatus('Upcoming');
    else if (rawStatus.includes('complete') || rawStatus.includes('finished')) setAiringStatus('Completed');
    else setAiringStatus('Airing');

    setReleaseYear(
      initialAnime.year || initialAnime.releaseYear ? String(initialAnime.year || initialAnime.releaseYear) : ''
    );
    setSeasonName(String(initialAnime.season || initialAnime.current_season || '').trim());
    setStudio(String(initialAnime.studio || '').trim());
    setRating(initialAnime.rating !== undefined && initialAnime.rating !== null ? String(initialAnime.rating) : '8.5');

    const rawGenres = initialAnime.genres || initialAnime.genre || '';
    const parsedGenres = Array.isArray(rawGenres)
      ? rawGenres
      : String(rawGenres)
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean);
    setGenres(parsedGenres);

    const rawEp = initialAnime.episodes_count ?? initialAnime.episodes ?? initialAnime.episode_count;
    setEpisodesCount(rawEp !== undefined && rawEp !== null && Number(rawEp) > 0 ? String(rawEp) : '');
    setSeasonEpisodeCount(String(initialAnime.season_episode_count || '').trim());
    setBroadcastDay(String(initialAnime.broadcast_day || initialAnime.releaseDay || '').trim());
    setBroadcastTime(String(initialAnime.broadcast_time || initialAnime.airTime || '').trim());
    setFranchiseId(String(initialAnime.franchise_id || '').trim());
    setRelationType(String(initialAnime.relation_type || '').trim());
    setSequenceNumber(
      initialAnime.sequence_number !== undefined && initialAnime.sequence_number !== null
        ? String(initialAnime.sequence_number)
        : ''
    );

    const rawLangs = initialAnime.languages;
    const parsedLangs = Array.isArray(rawLangs)
      ? rawLangs.map((l) => String(l).trim()).filter(Boolean)
      : typeof rawLangs === 'string' && rawLangs.trim()
        ? rawLangs
            .split(',')
            .map((l) => l.trim())
            .filter(Boolean)
        : [];
    setSelectedLanguages(parsedLangs);

    const hasOfficialProof = Boolean(initialAnime.official_source_url || initialAnime.last_verified_at);
    if (parsedLangs.length === 0) {
      setDubVerificationStatus('unverified');
    } else if (hasOfficialProof && Number(rawEp) > 0) {
      setDubVerificationStatus('complete');
    } else if (hasOfficialProof) {
      setDubVerificationStatus('partial');
    } else {
      setDubVerificationStatus('unverified');
    }

    setPrimaryPlatform(String(initialAnime.platform || '').trim());
    setWatchUrl(String(initialAnime.watch_url || initialAnime.streamUrl || '').trim());
    setOfficialSourceUrl(String(initialAnime.official_source_url || '').trim());
    setLastVerifiedAt(String(initialAnime.last_verified_at || '').slice(0, 10));

    const rawPartners =
      initialAnime.streaming_partners || initialAnime.platforms_data || initialAnime.streamingPartners || [];
    let parsedPartners: PartnerDraft[] = [];
    if (Array.isArray(rawPartners)) {
      parsedPartners = rawPartners
        .filter((p) => p && typeof p === 'object')
        .map((p: any) => ({
          name: String(p.name || p.platform || '').trim(),
          url: String(p.url || '').trim(),
          languages: Array.isArray(p.languages) ? p.languages : [],
          episodeCount: p.episodeCount !== undefined && p.episodeCount !== null ? String(p.episodeCount) : '',
        }));
    } else if (typeof rawPartners === 'string' && rawPartners.trim().startsWith('[')) {
      try {
        const arr = JSON.parse(rawPartners);
        if (Array.isArray(arr)) {
          parsedPartners = arr.map((p: any) => ({
            name: String(p.name || p.platform || '').trim(),
            url: String(p.url || '').trim(),
            languages: Array.isArray(p.languages) ? p.languages : [],
            episodeCount: p.episodeCount !== undefined && p.episodeCount !== null ? String(p.episodeCount) : '',
          }));
        }
      } catch {
        parsedPartners = [];
      }
    }
    setPartners(parsedPartners);

    const rawMixed = initialAnime.mixed_entries || initialAnime.mixedEntries || [];
    let parsedSeasons: SeasonEntryDraft[] = [];
    if (Array.isArray(rawMixed)) {
      parsedSeasons = rawMixed.map((m: any) => ({
        type: String(m.type || 'Season').trim(),
        name: String(m.name || '').trim(),
        episodes: m.episodes !== undefined && m.episodes !== null ? String(m.episodes) : '',
      }));
    } else if (typeof rawMixed === 'string' && rawMixed.trim().startsWith('[')) {
      try {
        const arr = JSON.parse(rawMixed);
        if (Array.isArray(arr)) {
          parsedSeasons = arr.map((m: any) => ({
            type: String(m.type || 'Season').trim(),
            name: String(m.name || '').trim(),
            episodes: m.episodes !== undefined && m.episodes !== null ? String(m.episodes) : '',
          }));
        }
      } catch {
        parsedSeasons = [];
      }
    }
    setSeasonEntries(parsedSeasons);
    setIsDirty(false);
  }, [initialAnime]);

  // Warn before closing browser tab if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Field-level validation & missing field indicators per tab
  const tabValidation = useMemo(() => {
    const identityMissing: string[] = [];
    if (!title.trim()) identityMissing.push('Official Title is required');

    const artworkMissing: string[] = [];
    if (!coverImage.trim()) artworkMissing.push('Poster Artwork URL is missing');
    if (!bannerImage.trim()) artworkMissing.push('Wide Hero Banner URL is missing');

    const metadataMissing: string[] = [];
    if (!synopsis.trim() || synopsis.trim().length < 25) {
      metadataMissing.push('English Synopsis (< 25 chars)');
    }
    if (genres.length === 0) metadataMissing.push('At least 1 Genre');
    if (!releaseYear.trim()) metadataMissing.push('Release Year');

    const dubsMissing: string[] = [];
    if (selectedLanguages.length > 0 && !primaryPlatform.trim() && partners.length === 0) {
      dubsMissing.push('Dub languages claimed without an OTT platform');
    }
    if (dubVerificationStatus === 'complete' && (!episodesCount.trim() || Number(episodesCount) <= 0)) {
      dubsMissing.push('Complete Dub requires a positive episode count');
    }

    const seasonsMissing: string[] = [];
    if (!episodesCount.trim() && seasonEntries.length === 0) {
      seasonsMissing.push('Original Episode Count not specified');
    }

    return {
      identity: identityMissing,
      artwork: artworkMissing,
      metadata: metadataMissing,
      dubs: dubsMissing,
      seasons: seasonsMissing,
      translations: [] as string[],
      publish: [...identityMissing, ...dubsMissing],
    };
  }, [
    title,
    coverImage,
    bannerImage,
    synopsis,
    genres,
    releaseYear,
    selectedLanguages,
    primaryPlatform,
    partners,
    dubVerificationStatus,
    episodesCount,
    seasonEntries,
  ]);

  const handleToggleLanguage = (lang: string) => {
    setIsDirty(true);
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((item) => item !== lang) : [...prev, lang]
    );
  };

  const handleToggleGenre = (genre: string) => {
    setIsDirty(true);
    setGenres((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]));
  };

  // Auto-Fill Metadata Search
  const handleRunMetadataSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = (autoFillQuery || title).trim();
    if (q.length < 2) {
      setMetaSearchError('Enter at least 2 characters to search external metadata.');
      return;
    }
    setIsSearchingMeta(true);
    setMetaSearchError(null);
    setSelectedCandidate(null);
    setFieldDiffs([]);
    try {
      const res = await cloudflareApi.searchExternalMetadata(q, autoFillProvider);
      setMetaCandidates(res.candidates || []);
      if ((res.candidates || []).length === 0) {
        setMetaSearchError(`No matching titles found on ${autoFillProvider === 'anilist' ? 'AniList' : 'Jikan (MAL)'}.`);
      }
    } catch (err: any) {
      setMetaSearchError(err?.message || 'External metadata search failed.');
    } finally {
      setIsSearchingMeta(false);
    }
  };

  const handleSelectCandidate = (candidate: ExternalMetadataCandidate) => {
    setSelectedCandidate(candidate);
    const currentSnapshot = {
      title,
      alternative_titles: alternativeTitles,
      cover_image: coverImage,
      banner_image: bannerImage,
      year: releaseYear ? Number(releaseYear) : null,
      type: animeType,
      studio,
      genres: genres.join(', '),
      episodes_count: episodesCount ? Number(episodesCount) : null,
      synopsis,
      external_id: externalId,
    };
    const diffs = computeMetadataFieldDiffs(currentSnapshot, candidate);
    setFieldDiffs(diffs);
  };

  const handleToggleDiffField = (field: MetadataFieldDiff['field']) => {
    setFieldDiffs((prev) =>
      prev.map((d) => (d.field === field ? { ...d, defaultSelected: !d.defaultSelected } : d))
    );
  };

  const handleApplySelectedDiffs = () => {
    for (const diff of fieldDiffs) {
      if (!diff.defaultSelected) continue;
      switch (diff.field) {
        case 'title':
          setTitle(diff.fetchedValue);
          if (!slug.trim()) {
            setSlug(
              diff.fetchedValue
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
            );
          }
          break;
        case 'alternative_titles':
          setAlternativeTitles(diff.fetchedValue);
          break;
        case 'cover_image':
          setCoverImage(diff.fetchedValue);
          break;
        case 'banner_image':
          setBannerImage(diff.fetchedValue);
          break;
        case 'year':
          setReleaseYear(diff.fetchedValue);
          break;
        case 'type':
          setAnimeType(diff.fetchedValue);
          break;
        case 'studio':
          setStudio(diff.fetchedValue);
          break;
        case 'genres':
          setGenres(
            diff.fetchedValue
              .split(',')
              .map((g) => g.trim())
              .filter(Boolean)
          );
          break;
        case 'episodes_count':
          setEpisodesCount(diff.fetchedValue);
          break;
        case 'synopsis':
          setSynopsis(diff.fetchedValue);
          break;
        case 'external_id':
          setExternalId(diff.fetchedValue);
          break;
      }
    }
    setIsDirty(true);
    setIsAutoFillOpen(false);
    setSelectedCandidate(null);
  };

  const handleSave = async (publishLive: boolean) => {
    setSubmitError(null);
    if (!title.trim()) {
      setSubmitError('Official Anime Title is required before saving.');
      setActiveTab('identity');
      return;
    }
    if (
      dubVerificationStatus === 'complete' &&
      (!episodesCount.trim() || Number(episodesCount) <= 0)
    ) {
      setSubmitError('Cannot mark Dub Verification Status as "Complete" without a valid episode count.');
      setActiveTab('dubs');
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedPartners = partners
        .filter((p) => p.name.trim())
        .map((p) => ({
          name: p.name.trim(),
          platform: p.name.trim(),
          url: p.url.trim(),
          languages: p.languages,
          episodeCount: p.episodeCount.trim() ? Number(p.episodeCount) : null,
        }));

      const normalizedMixed = seasonEntries
        .filter((s) => s.name.trim() || s.episodes.trim())
        .map((s, idx) => ({
          type: s.type || 'Season',
          name: s.name.trim() || `Season ${idx + 1}`,
          episodes: s.episodes.trim() ? Number(s.episodes) : null,
        }));

      const payload: Record<string, any> = {
        title: title.trim(),
        hindiTitle: alternativeTitles.trim() || undefined,
        slug:
          slug.trim() ||
          title
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
        cover_image: coverImage.trim() || '/logo.png',
        banner_image: bannerImage.trim() || coverImage.trim() || '/logo.png',
        synopsis: synopsis.trim(),
        type: animeType,
        status: airingStatus,
        airing_status: airingStatus,
        year: releaseYear.trim() ? Number(releaseYear) : new Date().getFullYear(),
        season: seasonName.trim() || null,
        studio: studio.trim() || 'Unknown Studio',
        rating: rating.trim() ? Number(rating) : 8.5,
        genres: genres.length > 0 ? genres.join(', ') : 'Action',
        episodes_count: episodesCount.trim() !== '' ? Number(episodesCount) : null,
        season_episode_count: seasonEpisodeCount.trim() || undefined,
        broadcast_day: airingStatus === 'Airing' ? broadcastDay.trim() || null : null,
        broadcast_time: airingStatus === 'Airing' ? broadcastTime.trim() || null : null,
        franchise_id: franchiseId.trim() || undefined,
        relation_type: relationType.trim() || undefined,
        sequence_number: sequenceNumber.trim() ? Number(sequenceNumber) : null,
        // Never auto-default Tamil/Hindi/Telugu: use only explicitly selected languages
        languages: selectedLanguages.join(', '),
        platform:
          primaryPlatform.trim() ||
          normalizedPartners.map((p) => p.name).join(' | ') ||
          '',
        watch_url: watchUrl.trim() || normalizedPartners.find((p) => p.url)?.url || '',
        official_source_url: officialSourceUrl.trim() || '',
        last_verified_at:
          lastVerifiedAt.trim() ||
          (dubVerificationStatus === 'complete' || dubVerificationStatus === 'partial'
            ? new Date().toISOString().slice(0, 10)
            : null),
        streaming_partners: normalizedPartners,
        platforms_data: normalizedPartners,
        mixed_entries: normalizedMixed,
        is_published: publishLive ? 1 : 0,
        submissionStatus: publishLive ? 'approved' : 'pending',
        approval_status: publishLive ? 'approved' : 'pending',
      };

      if (isEditing) {
        const targetId = initialAnime.id || initialAnime._id;
        const res = await cloudflareApi.updateAnime(targetId, payload);
        setIsDirty(false);
        onSaved({ ...initialAnime, ...payload, id: targetId, ...(res?.data || {}) }, false);
      } else {
        const res = await cloudflareApi.createAnime(payload as any);
        setIsDirty(false);
        onSaved({ ...payload, id: res.animeId || (res as any).id }, true);
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to save anime entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestCancel = () => {
    if (isDirty) {
      setShowExitConfirm(true);
    } else {
      onCancel();
    }
  };

  return (
    <div data-testid="admin-modular-anime-editor" className="space-y-5 text-[var(--text-primary)] pb-12">
      {/* Top Sticky Action Header */}
      <div className="sticky top-16 z-20 rounded-2xl bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-subtle)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleRequestCancel}
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center justify-center gap-1.5 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Catalog</span>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold text-[var(--text-primary)] truncate">
                {isEditing ? `Edit Anime: ${title || `#${initialAnime?.id}`}` : 'New Catalog Entry'}
              </h2>
              {isDirty && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)] truncate">
              Modular Content Operations Editor · Publication status &amp; Indian dub verification are tracked independently.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="open-autofill-metadata-btn"
            onClick={() => {
              setAutoFillQuery(title);
              setIsAutoFillOpen(true);
            }}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--accent-soft)] hover:opacity-90 border border-[var(--accent-primary)]/40 text-xs font-bold text-[var(--accent-primary)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Auto-Fill Metadata</span>
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSave(false)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            data-testid="editor-publish-btn"
            disabled={isSubmitting}
            onClick={() => handleSave(true)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:opacity-95 text-[var(--accent-on-primary,#fff)] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>{isEditing ? 'Save & Publish' : 'Publish Live'}</span>
          </button>
        </div>
      </div>

      {submitError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-bold text-red-500 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* 7 Modular Section Tabs with Missing-Field Indicators */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {EDITOR_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const missingCount = tabValidation[tab.id]?.length || 0;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`editor-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all inline-flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
              {missingCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    isActive
                      ? 'bg-black/25 text-white'
                      : 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                  }`}
                >
                  {missingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Two-Column Desktop / Full-Screen Mobile Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Active Section Form */}
        <div className="lg:col-span-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6 space-y-5">
          {activeTab === 'identity' && (
            <div className="space-y-4">
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                  1. Core Title &amp; Publication Identity
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Official anime titles remain in English/Romaji across all UI languages.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Official Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g., Solo Leveling Season 2: Arise from the Shadow"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-sm text-[var(--text-primary)]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Alternative / Native / Search Titles
                  </label>
                  <input
                    type="text"
                    value={alternativeTitles}
                    onChange={(e) => {
                      setAlternativeTitles(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g., Ore dake Level Up na Ken, 나 혼자만 레벨업"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-sm text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Deep-Link URL Slug
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="auto-generated-from-title"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-sm font-mono text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    External Reference ID (AniList / MAL)
                  </label>
                  <input
                    type="text"
                    value={externalId}
                    onChange={(e) => {
                      setExternalId(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g., anilist:151807 or mal:52299"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-sm font-mono text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Format / Type
                  </label>
                  <select
                    value={animeType}
                    onChange={(e) => {
                      setAnimeType(e.target.value);
                      setIsDirty(true);
                    }}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  >
                    <option value="TV Series">TV Series</option>
                    <option value="Movie">Movie</option>
                    <option value="OVA">OVA</option>
                    <option value="ONA">ONA</option>
                    <option value="Special">Special</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Original Broadcast Status (Separate from Dub Status)
                  </label>
                  <select
                    value={airingStatus}
                    onChange={(e) => {
                      setAiringStatus(e.target.value as any);
                      setIsDirty(true);
                    }}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  >
                    <option value="Airing">Airing (Simulcast / Ongoing)</option>
                    <option value="Completed">Completed</option>
                    <option value="Upcoming">Upcoming</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'artwork' && (
            <div className="space-y-4">
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                  2. Official Poster &amp; Wide Hero Banner
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  High-resolution official key visuals. Original artwork colors are never altered by themes.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Vertical Poster URL (2:3 Ratio)
                  </label>
                  <input
                    type="url"
                    value={coverImage}
                    onChange={(e) => {
                      setCoverImage(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/..."
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-sm text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Wide Hero Banner URL (16:9 Ratio)
                  </label>
                  <input
                    type="url"
                    value={bannerImage}
                    onChange={(e) => {
                      setBannerImage(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="https://s4.anilist.co/file/anilistcdn/media/anime/banner/..."
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'metadata' && (
            <div className="space-y-4">
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                  3. Synopsis, Studio, Release Year &amp; Franchise Universe
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Canonical English metadata used for discovery filters and Anime Universe watch orders.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[var(--text-primary)]">
                    English Synopsis
                  </label>
                  <span className="text-[11px] text-[var(--text-secondary)]">{synopsis.length} chars</span>
                </div>
                <textarea
                  rows={5}
                  value={synopsis}
                  onChange={(e) => {
                    setSynopsis(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Write or import the official English synopsis..."
                  className="w-full p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-sm text-[var(--text-primary)] leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Release Year
                  </label>
                  <input
                    type="number"
                    min={1960}
                    max={2035}
                    value={releaseYear}
                    onChange={(e) => {
                      setReleaseYear(e.target.value);
                      setIsDirty(true);
                    }}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Animation Studio
                  </label>
                  <input
                    type="text"
                    value={studio}
                    onChange={(e) => {
                      setStudio(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g., A-1 Pictures, MAPPA, Ufotable"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Catalog Score (1–10)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={1}
                    max={10}
                    value={rating}
                    onChange={(e) => {
                      setRating(e.target.value);
                      setIsDirty(true);
                    }}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-2">
                  Genres
                </label>
                <div className="flex flex-wrap gap-2">
                  {GENRE_PRESETS.map((g) => {
                    const active = genres.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleToggleGenre(g)}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          active
                            ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] border-[var(--accent-primary)]'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Franchise Universe ID
                  </label>
                  <input
                    type="text"
                    value={franchiseId}
                    onChange={(e) => {
                      setFranchiseId(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g., demon-slayer"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm font-mono text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Relation Type
                  </label>
                  <input
                    type="text"
                    value={relationType}
                    onChange={(e) => {
                      setRelationType(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Season 1 / Sequel / Movie"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Watch Sequence #
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={sequenceNumber}
                    onChange={(e) => {
                      setSequenceNumber(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="1"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {(onOpenFranchiseBuilder || (isEditing && initialAnime?.id && onOpenCastManager)) && (
                <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2.5">
                  <div className="text-xs text-[var(--text-secondary)]">
                    Manage multi-season watch orders &amp; verified Indian voice actors in dedicated Phase 3 studios:
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {onOpenFranchiseBuilder && (
                      <button
                        type="button"
                        data-testid="editor-open-franchise-builder-btn"
                        onClick={() =>
                          onOpenFranchiseBuilder(
                            franchiseId.trim() ||
                              slug.trim() ||
                              title
                                .trim()
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, '-')
                                .replace(/^-|-$/g, '')
                          )
                        }
                        className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--accent-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Open in Franchise &amp; Watch Order Builder</span>
                      </button>
                    )}
                    {isEditing && initialAnime?.id && onOpenCastManager && (
                      <button
                        type="button"
                        data-testid="editor-open-cast-manager-btn"
                        onClick={() => onOpenCastManager(initialAnime.id)}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-sky-500 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Manage Characters &amp; Voice Cast</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'dubs' && (
            <div className="space-y-5">
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                  4. Indian Regional Dub Intelligence &amp; Official OTT Partners
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Never auto-select languages without verification. New entries start empty (Unverified) until explicitly chosen.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Dub Verification Status
                  </label>
                  <select
                    value={dubVerificationStatus}
                    onChange={(e) => {
                      setDubVerificationStatus(e.target.value as any);
                      setIsDirty(true);
                    }}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  >
                    <option value="unverified">Unverified / Listed</option>
                    <option value="complete">Complete Dub (Season/Episodes Verified)</option>
                    <option value="partial">Partial Dub (Simulcast / Ongoing Dub)</option>
                    <option value="announced">Announced (Official OTT Announcement)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Last Verified Date
                  </label>
                  <input
                    type="date"
                    value={lastVerifiedAt}
                    onChange={(e) => {
                      setLastVerifiedAt(e.target.value);
                      setIsDirty(true);
                    }}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-[var(--text-primary)]">
                    Confirmed Indian Audio Languages ({selectedLanguages.length} selected)
                  </label>
                  {selectedLanguages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLanguages([]);
                        setDubVerificationStatus('unverified');
                        setIsDirty(true);
                      }}
                      className="text-xs font-bold text-red-500 hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {OFFICIAL_INDIAN_LANGUAGES.map((lang) => {
                    const active = selectedLanguages.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        data-testid={`editor-dub-lang-${lang.toLowerCase()}`}
                        onClick={() => handleToggleLanguage(lang)}
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          active
                            ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {active ? `✓ ${lang}` : lang}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Primary Indian OTT Platform
                  </label>
                  <input
                    type="text"
                    list="ott-platform-presets"
                    value={primaryPlatform}
                    onChange={(e) => {
                      setPrimaryPlatform(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g., Crunchyroll, Netflix, JioHotstar"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  />
                  <datalist id="ott-platform-presets">
                    {OTT_PRESETS.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Primary Watch / Stream URL
                  </label>
                  <input
                    type="url"
                    value={watchUrl}
                    onChange={(e) => {
                      setWatchUrl(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="https://www.crunchyroll.com/series/..."
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Official Verification Source URL
                  </label>
                  <input
                    type="url"
                    value={officialSourceUrl}
                    onChange={(e) => {
                      setOfficialSourceUrl(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Official OTT show page or announcement URL"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Per-Platform Streaming Partners List */}
              <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                    Platform-Specific Dub Breakdown ({partners.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setPartners((prev) => [
                        ...prev,
                        { name: '', url: '', languages: [], episodeCount: '' },
                      ]);
                      setIsDirty(true);
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--accent-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add OTT Partner</span>
                  </button>
                </div>

                {partners.map((partner, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                      <input
                        type="text"
                        value={partner.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPartners((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, name: val } : item))
                          );
                          setIsDirty(true);
                        }}
                        placeholder="Platform (e.g., Crunchyroll)"
                        className="sm:col-span-4 min-h-[40px] px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                      />
                      <input
                        type="url"
                        value={partner.url}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPartners((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, url: val } : item))
                          );
                          setIsDirty(true);
                        }}
                        placeholder="https://..."
                        className="sm:col-span-5 min-h-[40px] px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                      />
                      <input
                        type="number"
                        min={0}
                        value={partner.episodeCount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPartners((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, episodeCount: val } : item))
                          );
                          setIsDirty(true);
                        }}
                        placeholder="Dubbed Eps"
                        className="sm:col-span-2 min-h-[40px] px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPartners((prev) => prev.filter((_, i) => i !== idx));
                          setIsDirty(true);
                        }}
                        className="sm:col-span-1 min-h-[40px] rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center cursor-pointer"
                        aria-label="Remove OTT partner"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'seasons' && (
            <div className="space-y-5">
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                  5. Seasons, Episode Counts &amp; Simulcast Schedule
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Configure total episodes, season breakdown, and weekly IST broadcast schedule.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Total Original Episodes
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={episodesCount}
                    onChange={(e) => {
                      setEpisodesCount(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g., 12 or 24"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Release Season Label
                  </label>
                  <input
                    type="text"
                    value={seasonName}
                    onChange={(e) => {
                      setSeasonName(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g., Winter 2025"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    Season &amp; Episode Summary
                  </label>
                  <input
                    type="text"
                    value={seasonEpisodeCount}
                    onChange={(e) => {
                      setSeasonEpisodeCount(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g., S1: 12 Eps | S2: 13 Eps"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {airingStatus === 'Airing' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                      Weekly Broadcast Day (IST)
                    </label>
                    <select
                      value={broadcastDay}
                      onChange={(e) => {
                        setBroadcastDay(e.target.value);
                        setIsDirty(true);
                      }}
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                    >
                      <option value="">Select Day...</option>
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                      <option value="Sunday">Sunday</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                      Broadcast Time (IST)
                    </label>
                    <input
                      type="text"
                      value={broadcastTime}
                      onChange={(e) => {
                        setBroadcastTime(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="e.g., 9:30 PM IST"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              )}

              {/* Structured Season Entries */}
              <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                    Structured Seasons / Arcs ({seasonEntries.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setSeasonEntries((prev) => [
                        ...prev,
                        { type: 'Season', name: `Season ${prev.length + 1}`, episodes: '' },
                      ]);
                      setIsDirty(true);
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--accent-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Season</span>
                  </button>
                </div>

                {seasonEntries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
                  >
                    <select
                      value={entry.type}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSeasonEntries((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, type: val } : s))
                        );
                        setIsDirty(true);
                      }}
                      className="sm:col-span-3 min-h-[40px] px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                    >
                      <option value="Season">Season</option>
                      <option value="Movie">Movie</option>
                      <option value="OVA">OVA</option>
                    </select>
                    <input
                      type="text"
                      value={entry.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSeasonEntries((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, name: val } : s))
                        );
                        setIsDirty(true);
                      }}
                      placeholder="Season Name"
                      className="sm:col-span-5 min-h-[40px] px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                    />
                    <input
                      type="number"
                      min={0}
                      value={entry.episodes}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSeasonEntries((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, episodes: val } : s))
                        );
                        setIsDirty(true);
                      }}
                      placeholder="Episodes"
                      className="sm:col-span-3 min-h-[40px] px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSeasonEntries((prev) => prev.filter((_, i) => i !== idx));
                        setIsDirty(true);
                      }}
                      className="sm:col-span-1 min-h-[40px] rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'translations' && (
            <div className="space-y-4">
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                  6. Regional Synopsis Translations (`ta`, `hi`, `te`, `ml`, `kn`, `bn`)
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Localized synopses are stored in the additive `anime_translations` table so the canonical English synopsis is never overwritten.
                </p>
              </div>

              {isEditing && initialAnime?.id ? (
                <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">
                      Open in Workers AI Translation Studio
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Edit, regenerate with Cloudflare Workers AI, or lock manual translations across all 6 Indian scripts.
                    </p>
                  </div>
                  {onOpenTranslationsForAnime && (
                    <button
                      type="button"
                      onClick={() => onOpenTranslationsForAnime(initialAnime.id)}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-bold inline-flex items-center gap-2 shrink-0 cursor-pointer"
                    >
                      <Languages className="w-4 h-4" />
                      <span>Launch Translation Studio</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                  Save or publish this anime entry first to generate and lock regional translations in the Workers AI Translation Studio.
                </div>
              )}
            </div>
          )}

          {activeTab === 'publish' && (
            <div className="space-y-5">
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                  7. Pre-Publish Quality Checklist
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Verify completeness before publishing to the live AniDub India catalog.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {EDITOR_TABS.filter((t) => t.id !== 'publish').map((tab) => {
                  const issues = tabValidation[tab.id] || [];
                  const passed = issues.length === 0;
                  return (
                    <div
                      key={tab.id}
                      className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                        passed
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-amber-500/10 border-amber-500/30'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
                          {passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <span>{tab.label}</span>
                        </div>
                        {issues.length > 0 ? (
                          <ul className="mt-1.5 space-y-0.5 text-[11px] text-amber-500 font-semibold">
                            {issues.map((iss, i) => (
                              <li key={i}>• {iss}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                            All required fields verified
                          </p>
                        )}
                      </div>
                      {!passed && (
                        <button
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className="text-[11px] font-bold text-[var(--accent-primary)] hover:underline shrink-0 cursor-pointer"
                        >
                          Fix
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSave(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save as Unpublished Draft</span>
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSave(true)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:opacity-95 text-[var(--accent-on-primary,#fff)] text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{isEditing ? 'Update & Publish Live' : 'Publish to Live Catalog'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right 4 Columns: Live Public Card & Detail Preview */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                Live Public Card Preview
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                {airingStatus}
              </span>
            </div>

            {/* Banner + Poster Preview */}
            <div className="rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
              <div className="h-28 w-full bg-[var(--bg-primary)] relative overflow-hidden">
                {bannerImage || coverImage ? (
                  <img
                    src={bannerImage || coverImage}
                    alt={title || 'Preview banner'}
                    className="w-full h-full object-cover opacity-80"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[var(--text-secondary)]">
                    No Banner Set
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              </div>

              <div className="p-3.5 -mt-10 relative flex items-end gap-3">
                <div className="w-16 h-24 rounded-lg overflow-hidden border-2 border-[var(--bg-surface)] bg-[var(--bg-primary)] shrink-0 shadow-md">
                  {coverImage ? (
                    <img
                      src={coverImage}
                      alt={title || 'Poster preview'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-[var(--text-secondary)] text-center p-1">
                      No Poster
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-0.5">
                  <div className="text-sm font-extrabold text-[var(--text-primary)] truncate">
                    {title || 'Untitled Anime Entry'}
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] truncate">
                    {animeType} · {releaseYear || 'Year N/A'} ·{' '}
                    {episodesCount ? `${episodesCount} Eps` : 'Eps Unverified'}
                  </div>
                </div>
              </div>

              <div className="px-3.5 pb-3.5 space-y-2.5">
                {/* Dub Status Preview Badge */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${
                      dubVerificationStatus === 'complete'
                        ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                        : dubVerificationStatus === 'partial'
                          ? 'bg-sky-500/15 text-sky-500 border-sky-500/30'
                          : dubVerificationStatus === 'announced'
                            ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                            : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    Dub: {dubVerificationStatus}
                  </span>
                  {primaryPlatform && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30">
                      {primaryPlatform}
                    </span>
                  )}
                </div>

                {/* Selected Indian Languages */}
                {selectedLanguages.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedLanguages.map((lang) => (
                      <span
                        key={lang}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-[var(--text-secondary)] italic">
                    No Indian dub languages selected (Unverified)
                  </div>
                )}

                <p className="text-xs text-[var(--text-secondary)] line-clamp-3 leading-relaxed">
                  {synopsis || 'English synopsis preview will appear here...'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1-Click Auto-Fill Metadata Drawer / Modal with Field-Level Diff Preview */}
      {isAutoFillOpen && (
        <div
          data-testid="autofill-metadata-modal"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="w-full max-w-3xl rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden my-8">
            <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-[var(--text-primary)] truncate">
                    1-Click Metadata Auto-Fill (AniList / Jikan)
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    Imports canonical artwork, synopsis, studio &amp; episode count. Never overwrites Indian dub or OTT fields.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAutoFillOpen(false)}
                className="min-h-[40px] min-w-[40px] rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Search Bar & Provider Switch */}
              <form onSubmit={handleRunMetadataSearch} className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={autoFillQuery}
                    onChange={(e) => setAutoFillQuery(e.target.value)}
                    placeholder="Search anime title (e.g., Dandadan, Demon Slayer)..."
                    className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  />
                </div>
                <select
                  value={autoFillProvider}
                  onChange={(e) => setAutoFillProvider(e.target.value as 'anilist' | 'jikan')}
                  className="min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)]"
                >
                  <option value="anilist">AniList GraphQL</option>
                  <option value="jikan">Jikan (MyAnimeList)</option>
                </select>
                <button
                  type="submit"
                  disabled={isSearchingMeta}
                  className="min-h-[44px] px-4 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSearchingMeta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Search</span>
                </button>
              </form>

              {metaSearchError && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-500">
                  {metaSearchError}
                </div>
              )}

              {/* Candidate List OR Field-Level Diff Preview */}
              {!selectedCandidate ? (
                <div className="space-y-2.5">
                  {metaCandidates.map((cand) => (
                    <div
                      key={`${cand.provider}-${cand.externalId}`}
                      className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {cand.posterUrl ? (
                          <img
                            src={cand.posterUrl}
                            alt={cand.title}
                            className="w-11 h-16 rounded-lg object-cover shrink-0 border border-[var(--border-subtle)]"
                          />
                        ) : (
                          <div className="w-11 h-16 rounded-lg bg-[var(--bg-surface)] shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[var(--text-primary)] truncate">
                            {cand.title}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] truncate">
                            {cand.format} · {cand.year || 'N/A'} ·{' '}
                            {cand.episodes !== null ? `${cand.episodes} Eps` : 'Eps Unknown'} ·{' '}
                            {cand.studio || 'Studio N/A'}
                          </div>
                          <div className="text-[10px] font-mono text-[var(--text-secondary)] mt-0.5">
                            {cand.provider.toUpperCase()} ID #{cand.externalId}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectCandidate(cand)}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--accent-primary)]/15 hover:bg-[var(--accent-primary)]/25 border border-[var(--accent-primary)]/30 text-xs font-bold text-[var(--accent-primary)] shrink-0 cursor-pointer"
                      >
                        Review Diff
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--accent-primary)]">
                        Field-Level Diff Preview
                      </div>
                      <div className="text-sm font-bold text-[var(--text-primary)]">
                        {selectedCandidate.title} ({selectedCandidate.provider.toUpperCase()} #{selectedCandidate.externalId})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCandidate(null)}
                      className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      ← Back to Results
                    </button>
                  </div>

                  {fieldDiffs.length === 0 ? (
                    <div className="p-4 rounded-xl bg-[var(--bg-elevated)] text-xs text-[var(--text-secondary)]">
                      All eligible metadata fields already match this candidate.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {fieldDiffs.map((diff) => (
                        <label
                          key={diff.field}
                          className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-start gap-3 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={diff.defaultSelected}
                            onChange={() => handleToggleDiffField(diff.field)}
                            className="mt-1 w-4 h-4 accent-[var(--accent-primary)]"
                          />
                          <div className="min-w-0 flex-1 text-xs space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-[var(--text-primary)]">{diff.label}</span>
                              {diff.hasCurrentValue && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500">
                                  Existing Value Protected by Default
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              <div className="p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                                <div className="text-[10px] font-bold uppercase text-[var(--text-secondary)]">
                                  Current Value
                                </div>
                                <div className="text-[11px] text-[var(--text-primary)] break-words line-clamp-2 mt-0.5">
                                  {diff.currentValue || '(Empty)'}
                                </div>
                              </div>
                              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                                <div className="text-[10px] font-bold uppercase text-emerald-500">
                                  Fetched Value
                                </div>
                                <div className="text-[11px] text-[var(--text-primary)] break-words line-clamp-2 mt-0.5">
                                  {diff.fetchedValue}
                                </div>
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => setSelectedCandidate(null)}
                      className="min-h-[44px] px-4 rounded-xl bg-[var(--bg-elevated)] text-xs font-bold text-[var(--text-secondary)] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApplySelectedDiffs}
                      className="min-h-[44px] px-4 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-extrabold cursor-pointer"
                    >
                      Apply Selected Fields ({fieldDiffs.filter((d) => d.defaultSelected).length})
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Exit Warning Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                Discard Unsaved Changes?
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              You have unsaved edits in the Modular Anime Editor. Leaving now will discard your changes.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="min-h-[44px] px-4 rounded-xl bg-[var(--bg-elevated)] text-xs font-bold text-[var(--text-primary)] cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDirty(false);
                  setShowExitConfirm(false);
                  onCancel();
                }}
                className="min-h-[44px] px-4 rounded-xl bg-red-500 text-white text-xs font-extrabold cursor-pointer"
              >
                Discard &amp; Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
