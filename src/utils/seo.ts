import { Anime, DubLanguage } from '../types/anime';

export interface SeoConfig {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  canonicalUrl?: string;
}

export interface SeoFaqItem {
  question: string;
  answer: string;
}

const DEFAULT_BANNER = 'https://anidub.in/41533.png';

/**
 * Generates natural user FAQ entries for rich snippets & long-tail search targeting
 */
export function generateAnimeFaqs(anime: Anime): SeoFaqItem[] {
  const title = anime.title || 'This anime';
  const dubs = Array.isArray(anime.dubs) && anime.dubs.length > 0 ? anime.dubs.join(', ') : 'Tamil, Telugu, and Hindi';
  const platforms = Array.isArray(anime.platforms) && anime.platforms.length > 0
    ? anime.platforms.map((p: any) => typeof p === 'string' ? p : p?.name).filter(Boolean).join(', ')
    : 'Crunchyroll, Netflix, and JioHotstar';
  const studio = (anime as any).animationStudio || anime.studio || 'official animation studio';
  const episodes = anime.episodes ? `${anime.episodes} episodes` : 'full seasons';
  const releaseYear = anime.releaseYear || 'recent releases';
  const primaryDub = (anime.dubs && anime.dubs[0]) || 'Tamil';

  return [
    {
      question: `Where can I watch ${title} dubbed in India legally?`,
      answer: `${title} is available for legal streaming in India on ${platforms}. You can stream official high-definition releases with verified Indian regional audio dubs and English subtitles on these platforms.`,
    },
    {
      question: `What Indian languages is ${title} dubbed in?`,
      answer: `${title} is officially available with dub tracks in ${dubs}. Additional regional dub releases are tracked continuously by the AniDub India streaming catalog.`,
    },
    {
      question: `Is ${title} available with ${primaryDub} dub?`,
      answer: anime.dubs?.includes(primaryDub as DubLanguage)
        ? `Yes! ${title} features an official ${primaryDub} dub available to stream legally in India on ${platforms}.`
        : `Currently, ${title} is officially dubbed in ${dubs} in India. Check our schedule for upcoming ${primaryDub} dub announcements.`,
    },
    {
      question: `How many episodes are available for ${title}?`,
      answer: `${title} consists of ${episodes} produced by ${studio}, originally released in ${releaseYear}.`,
    },
    {
      question: `Is ${title} free to watch in India?`,
      answer: `Streaming availability depends on the hosting platform (${platforms}). Selected platforms provide ad-supported free episodes, while complete regional dubbed seasons are accessible via official subscription plans.`,
    },
  ];
}

/**
 * Builds rich SEO configuration for a specific anime entry.
 * Format: "[Anime Name] Dubbed Streaming in India - AniDub India"
 */
export function buildAnimeSeo(anime: Anime): SeoConfig {
  const dubList = Array.isArray(anime?.dubs) && anime.dubs.length > 0
    ? anime.dubs.join(', ')
    : 'Tamil, Telugu, Hindi';
  
  const platforms = Array.isArray(anime?.platforms) && anime.platforms.length > 0
    ? anime.platforms.map((p) => (typeof p === 'string' ? p : p?.name)).filter(Boolean).join(', ')
    : 'Crunchyroll, Netflix, JioCinema, JioHotstar';

  // 1. Dynamic Meta Title (Standardized format)
  const title = `${anime?.title || 'Anime'} Dubbed Streaming in India - AniDub India`;
  
  // 2. Dynamic Meta Description
  const description = `Stream ${anime?.title || 'Anime'} legally dubbed in ${dubList} in India on ${platforms}. Episode guides, Indian dub voice cast, and official streaming links on AniDub India.`;

  const keywords = [
    `${anime.title} dubbed`,
    `${anime.title} Tamil dub`,
    `${anime.title} Telugu dub`,
    `${anime.title} Hindi dub`,
    `${anime.title} Malayalam dub`,
    `${anime.title} Kannada dub`,
    `Watch ${anime.title} in India`,
    `Stream ${anime.title} legally`,
    `${anime.title} Crunchyroll India`,
    `${anime.title} Netflix India`,
    `${anime.title} JioHotstar`,
    'Indian anime dub directory',
  ];

  const posterUrl = anime.imageUrl || anime.poster || DEFAULT_BANNER;
  const studioName = (anime as any).animationStudio || anime.studio || 'Animation Studio';
  const dubQuery = Array.isArray(anime.dubs) ? anime.dubs.join(',') : 'Tamil,Telugu';

  const ogDynamicUrl = `/api/og?title=${encodeURIComponent(anime.title || '')}&poster=${encodeURIComponent(posterUrl)}&dubs=${encodeURIComponent(dubQuery)}&studio=${encodeURIComponent(studioName)}&rating=${encodeURIComponent(String(anime.rating || '8.5'))}&type=${encodeURIComponent(anime.type || 'TV Series')}`;

  const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://anidub.in';
  const fullOgUrl = `${origin}${ogDynamicUrl}`;

  return {
    title,
    description,
    keywords,
    ogImage: fullOgUrl,
    canonicalUrl: `${origin}/anime/${anime.id}`,
  };
}

/**
 * Builds Schema.org FAQPage JSON-LD object for Google Rich Results
 */
export function buildFaqSchemaOrg(anime: Anime): Record<string, any> {
  const faqs = generateAnimeFaqs(anime);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Injects or updates Schema.org Structured Data (TVSeries / Movie & FAQPage) in document head
 */
export function injectSchemaOrgData(anime: Anime) {
  if (typeof document === 'undefined' || !anime) return;

  const isMovie = (anime.type || '').toLowerCase().includes('movie');
  const dubList = Array.isArray(anime.dubs) && anime.dubs.length > 0 ? anime.dubs : ['Tamil'];
  const platforms = Array.isArray(anime.platforms)
    ? anime.platforms.map((p) => (typeof p === 'string' ? p : p?.name)).filter(Boolean)
    : ['Crunchyroll'];

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': isMovie ? 'Movie' : 'TVSeries',
    name: anime.title,
    alternateName: [anime.romajiTitle, (anime as any).nativeTitle].filter(Boolean),
    description: anime.synopsis || `Stream ${anime.title} legally dubbed in Indian regional languages on ${platforms.join(', ')}.`,
    image: anime.imageUrl || anime.poster || DEFAULT_BANNER,
    genre: Array.isArray(anime.genres) ? anime.genres : ['Animation', 'Action'],
    inLanguage: dubList.map((lang: string) => lang.toLowerCase()),
    productionCompany: {
      '@type': 'Organization',
      name: anime.studio || (anime as any).animationStudio || 'Animation Studio',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: String(anime.rating || '8.5'),
      bestRating: '10',
      worstRating: '1',
      ratingCount: Number((anime as any).upvotes || anime.likes || 120),
    },
    offers: platforms.map((platform: string) => ({
      '@type': 'Offer',
      name: platform,
      category: 'Subscription',
      eligibleRegion: {
        '@type': 'Country',
        name: 'IN',
      },
    })),
  };

  if (anime.releaseYear) {
    schema.datePublished = `${anime.releaseYear}-01-01`;
  }
  if (!isMovie) {
    schema.numberOfEpisodes = Number(anime.episodes || 12);
    schema.numberOfSeasons = 1;
  }

  // 1. Primary TVSeries / Movie schema
  let script = document.querySelector('script#anime-schema-jsonld') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'anime-schema-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(schema);

  // 2. FAQPage Schema for Rich Snippets
  const faqSchema = buildFaqSchemaOrg(anime);
  let faqScript = document.querySelector('script#anime-faq-jsonld') as HTMLScriptElement | null;
  if (!faqScript) {
    faqScript = document.createElement('script');
    faqScript.id = 'anime-faq-jsonld';
    faqScript.type = 'application/ld+json';
    document.head.appendChild(faqScript);
  }
  faqScript.textContent = JSON.stringify(faqSchema);
}

/**
 * Dynamically updates document head metadata for search engine indexing, WhatsApp & Telegram cards,
 * canonical URLs, and Schema.org rich snippets.
 */
export function updateSeoTags(config: SeoConfig, anime?: Anime) {
  if (typeof document === 'undefined') return;

  // 1. Page Title
  document.title = config.title;

  // 2. Meta Description
  updateMetaTag('name', 'description', config.description);

  // 3. Meta Keywords
  const defaultKeywords = [
    'Tamil dubbed anime',
    'Telugu anime dubs',
    'Hindi dubbed anime online',
    'Malayalam anime dubs',
    'Kannada anime',
    'Indian anime dub directory',
    'Crunchyroll India dubs',
    'Netflix anime dubs India',
    'JioHotstar anime dubs',
  ];
  updateMetaTag(
    'name',
    'keywords',
    (config.keywords ? [...config.keywords, ...defaultKeywords] : defaultKeywords).join(', ')
  );

  // 4. OpenGraph Tags (WhatsApp, Telegram, Discord, Facebook)
  updateMetaTag('property', 'og:site_name', 'AniDub India');
  updateMetaTag('property', 'og:locale', 'en_IN');
  updateMetaTag('property', 'og:type', anime?.type?.toLowerCase().includes('movie') ? 'video.movie' : 'video.other');
  updateMetaTag('property', 'og:title', config.title);
  updateMetaTag('property', 'og:description', config.description);
  
  if (config.canonicalUrl) {
    updateMetaTag('property', 'og:url', config.canonicalUrl);
  }
  
  if (config.ogImage) {
    updateMetaTag('property', 'og:image', config.ogImage);
    updateMetaTag('property', 'og:image:secure_url', config.ogImage);
    updateMetaTag('property', 'og:image:alt', config.title);
    updateMetaTag('property', 'og:image:width', '1200');
    updateMetaTag('property', 'og:image:height', '630');
    updateMetaTag('property', 'og:image:type', 'image/png');
  }

  // 5. Twitter Card Tags
  updateMetaTag('name', 'twitter:card', 'summary_large_image');
  updateMetaTag('name', 'twitter:title', config.title);
  updateMetaTag('name', 'twitter:description', config.description);
  if (config.ogImage) {
    updateMetaTag('name', 'twitter:image', config.ogImage);
  }

  // 6. Canonical URL - Ensures proper self-referencing canonical
  const finalCanonical = config.canonicalUrl || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://anidub.in');
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', finalCanonical);

  // 7. Inject Schema.org TVSeries / Movie Structured Data and FAQPage Schema
  if (anime) {
    injectSchemaOrgData(anime);
  }
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
