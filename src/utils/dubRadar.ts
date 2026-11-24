import { resolveCanonicalAnimeStatus } from './animeStatus';

export const DUB_RADAR_STAGES = [
  'Official Announcement',
  'Production Confirmed',
  'Release Scheduled',
  'Partially Available',
  'Fully Available',
] as const;

export type DubRadarStage = (typeof DUB_RADAR_STAGES)[number];

export const DUB_RADAR_LANGUAGES = [
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
] as const;

export type DubRadarLanguage = (typeof DUB_RADAR_LANGUAGES)[number];

export interface DubRadarEntry {
  id: number | string;
  anime_title: string;
  anime_id?: number | null;
  slug?: string | null;
  languages: string[];
  platform: string;
  stage: DubRadarStage;
  release_date: string;
  source_url: string;
  notes: string;
  cover_image?: string;
  updated_at?: string;
  created_at?: string;
  isCatalogDerived?: boolean;
}

export interface DubRadarStageMeta {
  stage: DubRadarStage;
  shortLabel: string;
  description: string;
  badgeClass: string;
  dotClass: string;
}

export const DUB_RADAR_STAGE_META: Record<DubRadarStage, DubRadarStageMeta> = {
  'Official Announcement': {
    stage: 'Official Announcement',
    shortLabel: 'Announced',
    description: 'New Indian dub officially announced',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
    dotClass: 'bg-sky-400',
  },
  'Production Confirmed': {
    stage: 'Production Confirmed',
    shortLabel: 'In Production',
    description: 'Reliable dubbing studio or casting update',
    badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/35',
    dotClass: 'bg-violet-400',
  },
  'Release Scheduled': {
    stage: 'Release Scheduled',
    shortLabel: 'Scheduled',
    description: 'OTT platform & release window confirmed',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    dotClass: 'bg-amber-400',
  },
  'Partially Available': {
    stage: 'Partially Available',
    shortLabel: 'Partial Dub',
    description: 'Weekly / initial dubbed episodes streaming',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/35',
    dotClass: 'bg-orange-400',
  },
  'Fully Available': {
    stage: 'Fully Available',
    shortLabel: 'Full Season',
    description: 'Full season Indian dub released',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
    dotClass: 'bg-emerald-400',
  },
};

export function normalizeDubRadarStage(raw: unknown): DubRadarStage {
  const clean = String(raw || '').trim().toLowerCase();
  if (!clean) return 'Official Announcement';

  if (clean.includes('fully') || clean === 'completed' || clean === 'complete') {
    return 'Fully Available';
  }
  if (clean.includes('partial') || clean.includes('ongoing') || clean === 'airing') {
    return 'Partially Available';
  }
  if (clean.includes('schedul') || clean.includes('date')) {
    return 'Release Scheduled';
  }
  if (clean.includes('prod') || clean.includes('cast') || clean.includes('record')) {
    return 'Production Confirmed';
  }
  return 'Official Announcement';
}

export function getDubRadarStageIndex(stage: DubRadarStage | string): number {
  const normalized = normalizeDubRadarStage(stage);
  const idx = DUB_RADAR_STAGES.indexOf(normalized);
  return idx >= 0 ? idx : 0;
}

export function parseRadarLanguages(raw: unknown): string[] {
  const rawList = Array.isArray(raw)
    ? raw.map((item) => String(item || '').trim())
    : typeof raw === 'string'
      ? raw.split(/[,/|•+]+/).map((s) => s.trim())
      : [];

  const canonical = new Set<string>();
  for (const token of rawList) {
    const low = token.toLowerCase();
    if (!low) continue;
    if (low.includes('hin')) canonical.add('Hindi');
    else if (low.includes('tam')) canonical.add('Tamil');
    else if (low.includes('tel')) canonical.add('Telugu');
    else if (low.includes('mal')) canonical.add('Malayalam');
    else if (low.includes('kan')) canonical.add('Kannada');
  }
  return Array.from(canonical);
}

export function normalizeDubRadarRow(row: Record<string, unknown>): DubRadarEntry {
  const animeIdNum = Number(row.anime_id ?? row.animeId);
  return {
    id: (row.id as number | string) ?? `radar-${String(row.anime_title || '')}`,
    anime_title: String(row.anime_title ?? row.animeTitle ?? '').trim(),
    anime_id: Number.isInteger(animeIdNum) && animeIdNum > 0 ? animeIdNum : null,
    slug: row.slug ? String(row.slug).trim() : null,
    languages: parseRadarLanguages(row.languages),
    platform: String(row.platform || '').trim(),
    stage: normalizeDubRadarStage(row.stage),
    release_date: String(row.release_date ?? row.releaseDate ?? '').trim(),
    source_url: String(row.source_url ?? row.sourceUrl ?? '').trim(),
    notes: String(row.notes || '').trim(),
    cover_image: String(row.cover_image ?? row.coverImage ?? '').trim(),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
    created_at: row.created_at ? String(row.created_at) : undefined,
    isCatalogDerived: Boolean(row.isCatalogDerived),
  };
}

export function filterDubRadarEntries(
  entries: DubRadarEntry[],
  filters: { language?: string; stage?: string; search?: string }
): DubRadarEntry[] {
  const langFilter = String(filters.language || 'All').trim().toLowerCase();
  const stageFilter = String(filters.stage || 'All').trim().toLowerCase();
  const searchFilter = String(filters.search || '').trim().toLowerCase();

  return entries.filter((entry) => {
    if (langFilter && langFilter !== 'all') {
      const hasLang = entry.languages.some((l) => l.toLowerCase() === langFilter);
      if (!hasLang) return false;
    }
    if (stageFilter && stageFilter !== 'all') {
      if (entry.stage.toLowerCase() !== stageFilter) return false;
    }
    if (searchFilter) {
      const haystack = `${entry.anime_title} ${entry.platform} ${entry.notes} ${entry.languages.join(' ')}`.toLowerCase();
      if (!haystack.includes(searchFilter)) return false;
    }
    return true;
  });
}

export interface ValidatedDubRadarPayload {
  anime_title: string;
  anime_id: number | null;
  slug: string | null;
  languages: string;
  platform: string;
  stage: DubRadarStage;
  release_date: string;
  source_url: string;
  notes: string;
  cover_image: string;
}

export function validateDubRadarPayload(
  body: Record<string, unknown>
): { ok: true; data: ValidatedDubRadarPayload } | { ok: false; error: string } {
  const anime_title = String(body.anime_title ?? body.animeTitle ?? '').trim();
  if (anime_title.length < 2 || anime_title.length > 160) {
    return { ok: false, error: 'Anime title must be between 2 and 160 characters.' };
  }

  const parsedLanguages = parseRadarLanguages(body.languages);
  if (parsedLanguages.length === 0) {
    return { ok: false, error: 'Select at least one Indian dub language (Hindi, Tamil, Telugu, Malayalam, or Kannada).' };
  }

  const rawStage = String(body.stage || '').trim();
  const validExactStage = DUB_RADAR_STAGES.find(
    (s) => s.toLowerCase() === rawStage.toLowerCase()
  );
  if (!validExactStage) {
    return {
      ok: false,
      error: `Stage must be one of: ${DUB_RADAR_STAGES.join(', ')}.`,
    };
  }

  const animeIdRaw = body.anime_id ?? body.animeId;
  const animeIdNum = animeIdRaw !== null && animeIdRaw !== undefined && String(animeIdRaw).trim() !== ''
    ? Number(animeIdRaw)
    : null;
  const anime_id = animeIdNum !== null && Number.isInteger(animeIdNum) && animeIdNum > 0 ? animeIdNum : null;

  const slug = String(body.slug || '').trim().slice(0, 160) || null;
  const platform = String(body.platform || '').trim().slice(0, 120);
  const release_date = String(body.release_date ?? body.releaseDate ?? '').trim().slice(0, 80);
  const source_url = String(body.source_url ?? body.sourceUrl ?? '').trim().slice(0, 500);
  const notes = String(body.notes || '').trim().slice(0, 400);
  const cover_image = String(body.cover_image ?? body.coverImage ?? '').trim().slice(0, 500);

  return {
    ok: true,
    data: {
      anime_title,
      anime_id,
      slug,
      languages: parsedLanguages.join(', '),
      platform,
      stage: validExactStage,
      release_date,
      source_url,
      notes,
      cover_image,
    },
  };
}

/**
 * Honest catalog-derived radar entries used ONLY for Upcoming / Airing titles when no
 * explicit `dub_radar` row exists yet for that anime. Never invents dates or source links.
 */
export function buildCatalogFallbackRadarEntries(catalogItems: any[]): DubRadarEntry[] {
  if (!Array.isArray(catalogItems) || catalogItems.length === 0) return [];
  const results: DubRadarEntry[] = [];

  for (const anime of catalogItems) {
    if (!anime || typeof anime !== 'object') continue;
    const canonicalStatus = resolveCanonicalAnimeStatus(anime);
    if (canonicalStatus !== 'Airing' && canonicalStatus !== 'Upcoming') continue;

    const langs = parseRadarLanguages(anime.languages);
    if (langs.length === 0) continue;

    const stage: DubRadarStage =
      canonicalStatus === 'Upcoming' ? 'Official Announcement' : 'Partially Available';

    results.push({
      id: `catalog-${anime.id}`,
      anime_title: String(anime.title || '').trim(),
      anime_id: Number(anime.id) > 0 ? Number(anime.id) : null,
      slug: anime.slug ? String(anime.slug) : null,
      languages: langs,
      platform: String(anime.platform || '').trim(),
      stage,
      release_date: '', // Never invent release dates
      source_url: String(anime.official_source_url || '').trim(),
      notes:
        canonicalStatus === 'Upcoming'
          ? 'Tracked from catalog upcoming listings. Release date TBA.'
          : 'Currently airing Indian dub tracked from catalog.',
      cover_image: String(anime.cover_image || anime.posterUrl || anime.image || '').trim(),
      isCatalogDerived: true,
    });
  }

  return results;
}
