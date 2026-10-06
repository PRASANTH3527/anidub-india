import { Anime } from '../types/anime';

export interface SeoConfig {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  canonicalUrl?: string;
}

/**
 * Dynamically updates document head metadata for search engine indexing and social sharing.
 */
export function updateSeoTags(config: SeoConfig) {
  // 1. Page Title
  document.title = config.title;

  // 2. Meta Description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', config.description);

  // 3. Meta Keywords
  let metaKeywords = document.querySelector('meta[name="keywords"]');
  if (!metaKeywords) {
    metaKeywords = document.createElement('meta');
    metaKeywords.setAttribute('name', 'keywords');
    document.head.appendChild(metaKeywords);
  }
  const defaultKeywords = [
    'Tamil dubbed anime',
    'Telugu anime dubs',
    'Hindi dubbed anime online',
    'Malayalam anime dubs',
    'Kannada anime',
    'Indian anime dub directory',
    'Crunchyroll India dubs',
    'Netflix anime dubs India',
  ];
  metaKeywords.setAttribute(
    'content',
    (config.keywords ? [...config.keywords, ...defaultKeywords] : defaultKeywords).join(', ')
  );

  // 4. OpenGraph Tags
  updateMetaTag('property', 'og:site_name', 'AniDub India');
  updateMetaTag('property', 'og:type', 'video.other');
  updateMetaTag('property', 'og:title', config.title);
  updateMetaTag('property', 'og:description', config.description);
  if (config.ogImage) {
    updateMetaTag('property', 'og:image', config.ogImage);
    updateMetaTag('property', 'og:image:secure_url', config.ogImage);
    updateMetaTag('property', 'og:image:alt', config.title);
  }

  // 5. Twitter Card Tags
  updateMetaTag('name', 'twitter:card', 'summary_large_image');
  updateMetaTag('name', 'twitter:title', config.title);
  updateMetaTag('name', 'twitter:description', config.description);
  if (config.ogImage) {
    updateMetaTag('name', 'twitter:image', config.ogImage);
  }

  // 6. Canonical URL
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', config.canonicalUrl || window.location.href);
}

function updateMetaTag(key: 'name' | 'property', attr: string, content: string) {
  let element = document.querySelector(`meta[${key}="${attr}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(key, attr);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/**
 * Builds rich SEO configuration for a specific anime page.
 */
export function buildAnimeSeo(anime: Anime): SeoConfig {
  const dubList = Array.isArray(anime?.dubs) ? anime.dubs.join(', ') : 'Regional Indian Dubs';
  const platforms = Array.isArray(anime?.platforms)
    ? anime.platforms.map((p) => p?.name || String(p)).filter(Boolean).join(', ')
    : 'Crunchyroll, Netflix';
  const title = `${anime?.title || 'Anime'} (${dubList} Dub) — Where to Watch & Episodes | AniDub India`;
  
  const description = `Available in ${dubList}. Watch ${anime?.title || 'Anime'} legally on ${platforms}. Episode guides, official Indian dub voice cast, and high quality streaming links on AniDub India.`;

  const keywords = [
    `${anime.title} Tamil dub`,
    `${anime.title} Telugu dub`,
    `${anime.title} Hindi dub`,
    `${anime.title} regional dub streaming`,
    `Watch ${anime.title} in Tamil`,
    `${anime.title} Crunchyroll India`,
    `${anime.title} voice cast`,
  ];

  const posterUrl = anime.imageUrl || anime.poster || '';
  const studioName = (anime as any).animationStudio || anime.studio || '';
  const dubQuery = Array.isArray(anime.dubs) ? anime.dubs.join(',') : 'Tamil,Telugu';
  const ogDynamicUrl = `/api/og?title=${encodeURIComponent(anime.title || '')}&poster=${encodeURIComponent(posterUrl)}&dubs=${encodeURIComponent(dubQuery)}&studio=${encodeURIComponent(studioName)}&rating=${encodeURIComponent(String(anime.rating || '8.5'))}&type=${encodeURIComponent(anime.type || 'TV Series')}`;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://anidub.in';
  const fullOgUrl = `${origin}${ogDynamicUrl}`;

  return {
    title,
    description,
    keywords,
    ogImage: fullOgUrl,
    canonicalUrl: `${origin}/#anime/${anime.id}`,
  };
}
