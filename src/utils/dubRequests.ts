export const DUB_REQUEST_LANGUAGES = [
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
] as const;

export type DubRequestLanguage = (typeof DUB_REQUEST_LANGUAGES)[number];

export const DUB_REQUEST_VOTED_STORAGE_KEY = 'cf_dub_request_voted_ids_v1';

export interface DubRequestItem {
  id: number;
  anime_title: string;
  anime_id?: number | null;
  language: DubRequestLanguage;
  vote_count: number;
  created_at?: string;
  updated_at?: string;
  hasVoted?: boolean;
}

export function normalizeRequestTitle(title: string): string {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeRequestLanguage(raw: unknown): DubRequestLanguage | null {
  const clean = String(raw || '').trim().toLowerCase();
  if (!clean) return null;
  if (clean === 'hindi' || clean === 'hi') return 'Hindi';
  if (clean === 'tamil' || clean === 'ta') return 'Tamil';
  if (clean === 'telugu' || clean === 'te') return 'Telugu';
  if (clean === 'malayalam' || clean === 'ml') return 'Malayalam';
  if (clean === 'kannada' || clean === 'kn') return 'Kannada';
  return null;
}

export function validateDubRequestSubmission(input: {
  animeTitle?: unknown;
  animeId?: unknown;
  language?: unknown;
  website?: unknown;
}):
  | {
      ok: true;
      data: {
        anime_title: string;
        normalized_title: string;
        anime_id: number | null;
        language: DubRequestLanguage;
      };
    }
  | { ok: false; error: string; status: number } {
  // Honeypot anti-spam trap
  if (input.website && String(input.website).trim().length > 0) {
    return { ok: false, error: 'Spam check failed.', status: 400 };
  }

  const animeTitle = String(input.animeTitle || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (animeTitle.length < 2 || animeTitle.length > 120) {
    return {
      ok: false,
      error: 'Anime title must be between 2 and 120 characters.',
      status: 400,
    };
  }

  if (/https?:\/\/|www\./i.test(animeTitle)) {
    return {
      ok: false,
      error: 'Please enter an anime title, not a URL.',
      status: 400,
    };
  }

  const normalized_title = normalizeRequestTitle(animeTitle);
  if (normalized_title.length < 2) {
    return {
      ok: false,
      error: 'Please enter a valid anime title.',
      status: 400,
    };
  }

  const language = normalizeRequestLanguage(input.language);
  if (!language) {
    return {
      ok: false,
      error: `Please choose a valid Indian language (${DUB_REQUEST_LANGUAGES.join(', ')}).`,
      status: 400,
    };
  }

  const animeIdNum =
    input.animeId !== undefined && input.animeId !== null && String(input.animeId).trim() !== ''
      ? Number(input.animeId)
      : null;
  const anime_id =
    animeIdNum !== null && Number.isInteger(animeIdNum) && animeIdNum > 0 ? animeIdNum : null;

  return {
    ok: true,
    data: {
      anime_title: animeTitle,
      normalized_title,
      anime_id,
      language,
    },
  };
}

export function sortAndFilterDubRequests(
  items: DubRequestItem[],
  options: { language?: string; search?: string } = {}
): DubRequestItem[] {
  const langFilter = String(options.language || 'All').trim().toLowerCase();
  const searchFilter = String(options.search || '').trim().toLowerCase();

  return [...items]
    .filter((item) => {
      if (langFilter && langFilter !== 'all' && item.language.toLowerCase() !== langFilter) {
        return false;
      }
      if (searchFilter) {
        const hay = `${item.anime_title} ${item.language}`.toLowerCase();
        if (!hay.includes(searchFilter)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (b.vote_count !== a.vote_count) return b.vote_count - a.vote_count;
      return b.id - a.id;
    });
}

export function readVotedDubRequestIds(storage?: Storage | null): number[] {
  const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!target) return [];
  try {
    const raw = target.getItem(DUB_REQUEST_VOTED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(parsed.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))
    );
  } catch {
    return [];
  }
}

export function markDubRequestVotedLocally(requestId: number, storage?: Storage | null): number[] {
  const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const existing = readVotedDubRequestIds(target);
  if (!Number.isInteger(requestId) || requestId <= 0) return existing;
  if (existing.includes(requestId)) return existing;
  const next = [...existing, requestId];
  if (target) {
    try {
      target.setItem(DUB_REQUEST_VOTED_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}
