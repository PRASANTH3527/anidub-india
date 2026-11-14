import { isExcludedLanguage, normalizeLanguageName } from './languages';

export const SITE_ORIGIN = 'https://anidub.in';
export const SITE_NAME = 'ANIDUB INDIA';
export const DEFAULT_OG_IMAGE = 'https://anidub.in/logo.png';

export const PRIMARY_SEO_LANGUAGES = [
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
] as const;

export const FEATURED_SEO_LANGUAGES = [
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Bengali',
  'Marathi',
  'Gujarati',
  'Punjabi',
] as const;

export interface SeoMetaPayload {
  title: string;
  ogTitle: string;
  description: string;
  image: string;
  canonicalUrl: string;
  ogType: 'website' | 'video.tv_show' | 'video.movie';
  jsonLd?: string;
}

export interface HTMLRewriterElementLike {
  setInnerContent: (content: string, options?: { html?: boolean }) => unknown;
  setAttribute: (name: string, value: string) => unknown;
  append?: (content: string, options?: { html?: boolean }) => unknown;
}

export interface HTMLRewriterHandlerLike {
  element?: (element: HTMLRewriterElementLike) => void | Promise<void>;
}

export interface HTMLRewriterLike {
  on: (selector: string, handlers: HTMLRewriterHandlerLike) => HTMLRewriterLike;
  transform: (response: Response) => Response;
}

export type HTMLRewriterConstructorLike = new () => HTMLRewriterLike;

declare const HTMLRewriter: HTMLRewriterConstructorLike | undefined;

export function getLanguageSlug(language: string): string {
  return normalizeLanguageName(language)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parses `/dubbed-anime/:language` paths and returns normalized `{ slug, language }`.
 * Returns null if the path does not match or represents an invalid/excluded language tag.
 */
export function parseLanguageFromPath(
  pathname: string
): { slug: string; language: string } | null {
  if (!pathname || typeof pathname !== 'string') return null;
  const cleanPath = pathname.split(/[?#]/)[0];
  const match = cleanPath.match(/^\/dubbed-anime\/([^/]+)\/?$/i);
  if (!match) return null;

  let decoded = '';
  try {
    decoded = decodeURIComponent(match[1]).trim();
  } catch {
    return null;
  }

  // Only allow clean alphabetic/hyphenated language slugs
  if (!decoded || !/^[a-zA-Z][a-zA-Z\s-]{0,30}$/.test(decoded)) {
    return null;
  }

  const normalized = normalizeLanguageName(decoded.replace(/-/g, ' '));
  if (!normalized || isExcludedLanguage(normalized)) {
    return null;
  }

  return {
    slug: getLanguageSlug(normalized),
    language: normalized,
  };
}

/**
 * Checks whether an anime record includes the target regional language.
 */
export function filterAnimeByLanguage<
  T extends {
    languages?: unknown;
    language?: unknown;
    dub?: unknown;
    dubbedLanguages?: unknown;
  },
>(list: T[], targetLanguage: string): T[] {
  if (!Array.isArray(list) || !targetLanguage) return [];
  const normalizedTarget = normalizeLanguageName(targetLanguage).toLowerCase();
  if (!normalizedTarget) return [];

  return list.filter((anime) => {
    if (!anime) return false;
    const raw =
      anime.languages ?? anime.language ?? anime.dub ?? anime.dubbedLanguages;
    if (!raw) return false;

    const tokens = Array.isArray(raw)
      ? raw.map(String)
      : typeof raw === 'string'
        ? raw.split(/[,/|•+]+/)
        : [];

    return tokens.some((token) => {
      const norm = normalizeLanguageName(token);
      return norm.toLowerCase() === normalizedTarget;
    });
  });
}

function resolveOrigin(rawOrigin?: string): string {
  if (!rawOrigin || typeof rawOrigin !== 'string') return SITE_ORIGIN;
  try {
    const parsed = new URL(rawOrigin);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return parsed.origin;
    }
    if (
      parsed.hostname === 'anidub.in' ||
      parsed.hostname.endsWith('.anidub.in') ||
      parsed.hostname.endsWith('.pages.dev') ||
      parsed.hostname.endsWith('.workers.dev')
    ) {
      return SITE_ORIGIN;
    }
    return parsed.origin;
  } catch {
    return SITE_ORIGIN;
  }
}

function resolveAbsoluteImageUrl(rawImage: unknown, origin: string): string {
  if (typeof rawImage !== 'string') return DEFAULT_OG_IMAGE;
  const trimmed = rawImage.trim();
  if (!trimmed) return DEFAULT_OG_IMAGE;
  if (trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('http://')) {
    return `https://${trimmed.slice('http://'.length)}`;
  }
  if (trimmed.startsWith('/')) {
    return `${origin}${trimmed}`;
  }
  return DEFAULT_OG_IMAGE;
}

function truncateDescription(text: string, maxLen = 158): string {
  const cleaned = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 3).trimEnd()}...`;
}

function serializeSafeJsonLd(payload: Record<string, unknown>): string {
  return JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function extractNormalizedDubLanguages(rawLanguages: unknown): string[] {
  const tokens = Array.isArray(rawLanguages)
    ? rawLanguages.map(String)
    : typeof rawLanguages === 'string' && rawLanguages.trim().length > 0
      ? rawLanguages.split(/[,/|•+]+/)
      : [];

  const normalized = Array.from(
    new Set(
      tokens
        .map((l) => normalizeLanguageName(l))
        .filter((l) => Boolean(l) && !isExcludedLanguage(l))
    )
  );

  return normalized.length > 0 ? normalized : ['Hindi', 'Tamil', 'Telugu'];
}

/**
 * Generates Google-friendly Schema.org JSON-LD (`TVSeries` or `Movie`)
 * for anime detail pages and edge HTMLRewriter responses.
 */
export function buildAnimeJsonLd(
  anime: Record<string, unknown>,
  originInput?: string,
  fallbackIdOrSlug?: string
): string {
  const origin = resolveOrigin(originInput);
  const title = String(anime.title || '').trim() || 'Anime Dub Details';
  const slugOrId = String(anime.slug || anime.id || fallbackIdOrSlug || '').trim();
  const url = slugOrId ? `${origin}/anime/${encodeURIComponent(slugOrId)}` : `${origin}/`;
  const dubLanguages = extractNormalizedDubLanguages(anime.languages);
  const langsFormatted = dubLanguages.join(', ');

  const synopsis = truncateDescription(String(anime.synopsis || anime.description || ''), 300);
  const description =
    synopsis ||
    `Watch ${title} with official ${langsFormatted} dubs legally in India on ANIDUB INDIA.`;

  const image = resolveAbsoluteImageUrl(
    anime.cover_image ?? anime.poster_url ?? anime.banner_image,
    origin
  );

  const animeType = String(anime.type || '').toLowerCase();
  const isMovie = animeType.includes('movie');

  const jsonLdObj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': isMovie ? 'Movie' : 'TVSeries',
    name: title,
    description,
    image,
    url,
    inLanguage: dubLanguages,
  };

  const rawGenres = String(anime.genres || anime.genre || '').trim();
  if (rawGenres) {
    const genreList = rawGenres
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);
    if (genreList.length > 0) {
      jsonLdObj.genre = genreList;
    }
  }

  const parsedYear = Number(anime.releaseYear ?? anime.year);
  if (Number.isFinite(parsedYear) && parsedYear >= 1950 && parsedYear <= 2100) {
    jsonLdObj.datePublished = String(parsedYear);
  }

  const studio = String(anime.studio || '').trim();
  if (studio && studio.toLowerCase() !== 'unknown studio') {
    jsonLdObj.productionCompany = {
      '@type': 'Organization',
      name: studio,
    };
  }

  const parsedEpisodes = Number(anime.episodes_count ?? anime.episodes ?? anime.episode_count);
  if (!isMovie && Number.isFinite(parsedEpisodes) && parsedEpisodes > 0) {
    jsonLdObj.numberOfEpisodes = Math.round(parsedEpisodes);
  }

  const parsedRating = Number(anime.rating);
  if (Number.isFinite(parsedRating) && parsedRating > 0 && parsedRating <= 10) {
    const votes = Number(anime.community_votes ?? anime.popularity ?? 1);
    jsonLdObj.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(parsedRating.toFixed(1)),
      bestRating: 10,
      worstRating: 1,
      ratingCount: Number.isFinite(votes) && votes > 0 ? Math.round(votes) : 1,
    };
  }

  return serializeSafeJsonLd(jsonLdObj);
}

export function buildDefaultSeoMeta(originInput?: string): SeoMetaPayload {
  const origin = resolveOrigin(originInput);
  const description =
    'Discover 100+ Indian-dubbed anime with Hindi, Tamil, and Telugu regional audio dubs on ANIDUB INDIA. The premier destination for legal anime streaming in India.';
  return {
    title: 'ANIDUB INDIA | The Premier Destination for Anime Streaming & Dubbing in India',
    ogTitle: 'ANIDUB INDIA | Anime Streaming & Dubbing',
    description,
    image: DEFAULT_OG_IMAGE,
    canonicalUrl: `${origin}/`,
    ogType: 'website',
    jsonLd: serializeSafeJsonLd({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: `${origin}/`,
      description,
    }),
  };
}

export function buildAnimeSeoMeta(
  anime: Record<string, unknown>,
  originInput?: string,
  fallbackIdOrSlug?: string
): SeoMetaPayload {
  const origin = resolveOrigin(originInput);
  const title = String(anime.title || '').trim() || 'Anime Dub Details';
  const slugOrId = String(anime.slug || anime.id || fallbackIdOrSlug || '').trim();
  const canonicalUrl = slugOrId ? `${origin}/anime/${encodeURIComponent(slugOrId)}` : `${origin}/`;

  const dubLanguages = extractNormalizedDubLanguages(anime.languages);
  const langsFormatted = dubLanguages.join(', ');

  const synopsis = truncateDescription(String(anime.synopsis || anime.description || ''), 145);
  const fallbackDesc = `Watch ${title} in ${langsFormatted} dubs legally in India. Streaming platforms, episode counts, and community ratings on ANIDUB INDIA.`;
  const description = synopsis
    ? truncateDescription(`${synopsis} (${langsFormatted} Dub)`, 160)
    : truncateDescription(fallbackDesc, 160);

  const image = resolveAbsoluteImageUrl(
    anime.cover_image ?? anime.poster_url ?? anime.banner_image,
    origin
  );

  const animeType = String(anime.type || '').toLowerCase();
  const ogType: SeoMetaPayload['ogType'] = animeType.includes('movie')
    ? 'video.movie'
    : 'video.tv_show';

  return {
    title: `${title} (${langsFormatted} Dub) | ANIDUB INDIA`,
    ogTitle: `${title} – Official Indian Dub | ANIDUB INDIA`,
    description,
    image,
    canonicalUrl,
    ogType,
    jsonLd: buildAnimeJsonLd(anime, originInput, fallbackIdOrSlug),
  };
}

export function buildLanguageSeoMeta(
  language: string,
  originInput?: string
): SeoMetaPayload {
  const origin = resolveOrigin(originInput);
  const normalized = normalizeLanguageName(language) || 'Hindi';
  const slug = getLanguageSlug(normalized);
  const description = `Browse the complete directory of official ${normalized} dubbed anime streaming legally in India on Crunchyroll, Netflix, JioHotstar, and Prime Video.`;
  const canonicalUrl = `${origin}/dubbed-anime/${slug}`;

  return {
    title: `Best ${normalized} Dubbed Anime in India | ANIDUB INDIA`,
    ogTitle: `Best ${normalized} Dubbed Anime in India | ANIDUB INDIA`,
    description,
    image: DEFAULT_OG_IMAGE,
    canonicalUrl,
    ogType: 'website',
    jsonLd: serializeSafeJsonLd({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Best ${normalized} Dubbed Anime in India`,
      url: canonicalUrl,
      description,
      inLanguage: normalized,
    }),
  };
}

/**
 * Rewrites HTML `<head>` SEO, OpenGraph, Twitter, and canonical tags using Cloudflare's `HTMLRewriter`.
 */
export function applySeoMetaWithHtmlRewriter(
  response: Response,
  meta: SeoMetaPayload,
  RewriterCtor?: HTMLRewriterConstructorLike
): Response {
  const Ctor =
    RewriterCtor ??
    (typeof HTMLRewriter !== 'undefined' ? HTMLRewriter : undefined);
  if (!Ctor) {
    return response;
  }

  const rewriter = new Ctor()
    .on('title', {
      element(el) {
        el.setInnerContent(meta.title);
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        el.setAttribute('content', meta.description);
      },
    })
    .on('link[rel="canonical"]', {
      element(el) {
        el.setAttribute('href', meta.canonicalUrl);
      },
    })
    .on('meta[property="og:title"]', {
      element(el) {
        el.setAttribute('content', meta.ogTitle);
      },
    })
    .on('meta[property="og:description"]', {
      element(el) {
        el.setAttribute('content', meta.description);
      },
    })
    .on('meta[property="og:image"]', {
      element(el) {
        el.setAttribute('content', meta.image);
      },
    })
    .on('meta[property="og:url"]', {
      element(el) {
        el.setAttribute('content', meta.canonicalUrl);
      },
    })
    .on('meta[property="og:type"]', {
      element(el) {
        el.setAttribute('content', meta.ogType);
      },
    })
    .on('meta[name="twitter:title"]', {
      element(el) {
        el.setAttribute('content', meta.ogTitle);
      },
    })
    .on('meta[name="twitter:description"]', {
      element(el) {
        el.setAttribute('content', meta.description);
      },
    })
    .on('meta[name="twitter:image"]', {
      element(el) {
        el.setAttribute('content', meta.image);
      },
    })
    .on('script[type="application/ld+json"]', {
      element(el) {
        if (meta.jsonLd) {
          el.setInnerContent(meta.jsonLd, { html: true });
        }
      },
    });

  const transformed = rewriter.transform(response);
  const headers = new Headers(transformed.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/html; charset=UTF-8');
  }
  headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  return new Response(transformed.body, {
    status: transformed.status,
    statusText: transformed.statusText,
    headers,
  });
}

export interface D1SeoDbLike {
  prepare: (sql: string) => {
    bind: (...values: unknown[]) => {
      first: <T = Record<string, unknown>>() => Promise<T | null>;
    };
  };
}

/**
 * Fetches published anime metadata from D1 and rewrites the SPA `index.html` response with dynamic meta tags.
 */
export async function resolveAnimeSeoResponse(params: {
  request: Request;
  db?: D1SeoDbLike | null;
  idOrSlug: string;
  baseHtmlResponse: Response;
  RewriterCtor?: HTMLRewriterConstructorLike;
}): Promise<Response> {
  const { request, db, idOrSlug, baseHtmlResponse, RewriterCtor } = params;
  const contentType = baseHtmlResponse.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    return baseHtmlResponse;
  }

  let animeRow: Record<string, unknown> | null = null;
  if (db && idOrSlug) {
    try {
      animeRow = await db
        .prepare(
          "SELECT id, title, slug, synopsis, cover_image, banner_image, languages, year, rating, type, studio, genres, episodes_count, popularity FROM anime WHERE (id = ? OR slug = ?) AND (is_published = 1 OR is_published = true) AND status != 'pending' LIMIT 1"
        )
        .bind(idOrSlug, idOrSlug)
        .first();
    } catch {
      animeRow = null;
    }
  }

  const origin = new URL(request.url).origin;
  const meta = animeRow
    ? buildAnimeSeoMeta(animeRow, origin, idOrSlug)
    : buildDefaultSeoMeta(origin);

  return applySeoMetaWithHtmlRewriter(baseHtmlResponse, meta, RewriterCtor);
}

/**
 * Rewrites the SPA `index.html` response with language landing page SEO tags.
 */
export function resolveLanguageSeoResponse(params: {
  request: Request;
  languageSlug: string;
  baseHtmlResponse: Response;
  RewriterCtor?: HTMLRewriterConstructorLike;
}): Response {
  const { request, languageSlug, baseHtmlResponse, RewriterCtor } = params;
  const contentType = baseHtmlResponse.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    return baseHtmlResponse;
  }

  const parsed = parseLanguageFromPath(`/dubbed-anime/${languageSlug}`);
  const origin = new URL(request.url).origin;
  const meta = parsed
    ? buildLanguageSeoMeta(parsed.language, origin)
    : buildDefaultSeoMeta(origin);

  return applySeoMetaWithHtmlRewriter(baseHtmlResponse, meta, RewriterCtor);
}

/**
 * Client-side DOM head synchronization helper for SPA route transitions.
 */
export function updateDocumentSeoMeta(meta: SeoMetaPayload): void {
  if (typeof document === 'undefined') return;
  document.title = meta.title;

  const setMeta = (selector: string, attr: string, value: string) => {
    const el = document.querySelector(selector);
    if (el) {
      el.setAttribute(attr, value);
    }
  };

  setMeta('meta[name="description"]', 'content', meta.description);
  setMeta('meta[property="og:title"]', 'content', meta.ogTitle);
  setMeta('meta[property="og:description"]', 'content', meta.description);
  setMeta('meta[property="og:image"]', 'content', meta.image);
  setMeta('meta[property="og:url"]', 'content', meta.canonicalUrl);
  setMeta('meta[property="og:type"]', 'content', meta.ogType);
  setMeta('meta[name="twitter:title"]', 'content', meta.ogTitle);
  setMeta('meta[name="twitter:description"]', 'content', meta.description);
  setMeta('meta[name="twitter:image"]', 'content', meta.image);
  setMeta('link[rel="canonical"]', 'href', meta.canonicalUrl);
  if (meta.jsonLd) {
    const ldEl = document.head.querySelector('script[type="application/ld+json"]');
    if (ldEl) {
      ldEl.textContent = meta.jsonLd;
    }
  }
}

export interface SitemapAnimeRow {
  id?: number | string | null;
  slug?: string | null;
  created_at?: string | null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatSitemapLastmod(rawDate: unknown): string | null {
  if (typeof rawDate !== 'string' || !rawDate.trim()) return null;
  const parsed = new Date(rawDate.trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/**
 * Generates a valid XML sitemap combining static directory routes,
 * regional dubbed language landing pages, and published D1 anime pages.
 */
export function buildDynamicSitemapXml(
  animeRows: SitemapAnimeRow[],
  originInput?: string
): string {
  const origin = resolveOrigin(originInput);
  const seenUrls = new Set<string>();
  const urlEntries: string[] = [];

  const pushEntry = (
    loc: string,
    changefreq: 'daily' | 'weekly' | 'monthly',
    priority: string,
    lastmod?: string | null
  ) => {
    if (!loc || seenUrls.has(loc)) return;
    seenUrls.add(loc);
    const lines = [
      '  <url>',
      `    <loc>${escapeXml(loc)}</loc>`,
      ...(lastmod ? [`    <lastmod>${escapeXml(lastmod)}</lastmod>`] : []),
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      '  </url>',
    ];
    urlEntries.push(lines.join('\n'));
  };

  // Core static pages
  pushEntry(`${origin}/`, 'daily', '1.0');
  pushEntry(`${origin}/schedule`, 'daily', '0.8');
  pushEntry(`${origin}/recommendations`, 'weekly', '0.8');
  pushEntry(`${origin}/tierlist`, 'weekly', '0.7');
  pushEntry(`${origin}/chat`, 'daily', '0.6');

  // Regional Indian language SEO landing pages
  for (const lang of FEATURED_SEO_LANGUAGES) {
    const slug = getLanguageSlug(lang);
    const isPrimary = (PRIMARY_SEO_LANGUAGES as readonly string[]).includes(lang);
    pushEntry(
      `${origin}/dubbed-anime/${slug}`,
      isPrimary ? 'daily' : 'weekly',
      isPrimary && ['Hindi', 'Tamil', 'Telugu'].includes(lang) ? '0.9' : '0.8'
    );
  }

  // Dynamic published anime pages from D1
  if (Array.isArray(animeRows)) {
    for (const row of animeRows) {
      if (!row) continue;
      const slugOrId = String(row.slug || row.id || '').trim();
      if (!slugOrId) continue;
      const loc = `${origin}/anime/${encodeURIComponent(slugOrId)}`;
      const lastmod = formatSitemapLastmod(row.created_at);
      pushEntry(loc, 'weekly', '0.8', lastmod);
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urlEntries,
    '</urlset>',
    '',
  ].join('\n');
}
