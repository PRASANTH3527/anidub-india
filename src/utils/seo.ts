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
  updateMetaTag('property', 'og:title', config.title);
  updateMetaTag('property', 'og:description', config.description);
  if (config.ogImage) {
    updateMetaTag('property', 'og:image', config.ogImage);
  }

  // 5. Twitter Card Tags
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
  const dubList = anime.dubs.join(', ');
  const title = `${anime.title} (${dubList} Dub) — Where to Watch & Episodes | AniDub India`;
  
  const description = `Watch ${anime.title} dubbed in ${dubList}. Check official streaming platforms (${anime.platforms.map((p) => p.name).join(', ')}), Indian dub cast, release date (${anime.originalReleaseDate || anime.releaseYear}), and dub quality ratings.`;

  const keywords = [
    `${anime.title} Tamil dub`,
    `${anime.title} Telugu dub`,
    `${anime.title} Hindi dub`,
    `${anime.title} regional dub streaming`,
    `Watch ${anime.title} in Tamil`,
    `${anime.title} Crunchyroll India`,
    `${anime.title} voice cast`,
  ];

  return {
    title,
    description,
    keywords,
    ogImage: anime.poster,
    canonicalUrl: `${window.location.origin}/#anime/${anime.id}`,
  };
}
