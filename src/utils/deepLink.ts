// ==============================================================================
// AniDub India — Smart Deep Linking Engine for Streaming Platforms
// Opens native mobile apps via custom URL schemes / Intents with safe Web fallback
// ==============================================================================

export interface DeepLinkTarget {
  platformName: string;
  nativeScheme: string;
  androidIntent?: string;
  webUrl: string;
  packageName?: string;
}

/**
 * Detects whether the current browser is running on a mobile device (Android / iOS)
 */
export function isMobileDevice(): { isMobile: boolean; isAndroid: boolean; isIOS: boolean } {
  if (typeof window === 'undefined') {
    return { isMobile: false, isAndroid: false, isIOS: false };
  }

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isAndroid = /android/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
  const isMobile = isAndroid || isIOS || /mobile/i.test(userAgent);

  return { isMobile, isAndroid, isIOS };
}

/**
 * Resolves content identifiers and generates custom schemes for legal streaming services
 */
export function buildDeepLink(platformName: string, webUrl: string): DeepLinkTarget {
  const normName = platformName.toLowerCase();

  // 1. Netflix (nflx://)
  if (normName.includes('netflix')) {
    // Extract title id from https://www.netflix.com/title/80241842 or /watch/80241842
    const match = webUrl.match(/(?:title|watch)\/([0-9]+)/);
    const titleId = match ? match[1] : '';
    const nativeScheme = titleId ? `nflx://www.netflix.com/title/${titleId}` : 'nflx://';
    const androidIntent = titleId 
      ? `intent://www.netflix.com/title/${titleId}#Intent;package=com.netflix.mediaclient;scheme=nflx;end`
      : `intent://#Intent;package=com.netflix.mediaclient;scheme=nflx;end`;

    return {
      platformName: 'Netflix',
      nativeScheme,
      androidIntent,
      webUrl,
      packageName: 'com.netflix.mediaclient',
    };
  }

  // 2. Crunchyroll (crunchyroll://)
  if (normName.includes('crunchyroll')) {
    // Extract series or episode slug
    const match = webUrl.match(/series\/([A-Za-z0-9]+)/);
    const seriesId = match ? match[1] : '';
    const nativeScheme = seriesId ? `crunchyroll://series/${seriesId}` : 'crunchyroll://';
    const androidIntent = seriesId
      ? `intent://www.crunchyroll.com/series/${seriesId}#Intent;package=com.crunchyroll.crunchyrollapp;scheme=crunchyroll;end`
      : `intent://#Intent;package=com.crunchyroll.crunchyrollapp;scheme=crunchyroll;end`;

    return {
      platformName: 'Crunchyroll',
      nativeScheme,
      androidIntent,
      webUrl,
      packageName: 'com.crunchyroll.crunchyrollapp',
    };
  }

  // 3. JioCinema (jiocinema://)
  if (normName.includes('jiocinema') || normName.includes('jio cinema')) {
    return {
      platformName: 'JioCinema',
      nativeScheme: 'jiocinema://',
      androidIntent: 'intent://#Intent;package=com.jio.media.ondemand;scheme=jiocinema;end',
      webUrl,
      packageName: 'com.jio.media.ondemand',
    };
  }

  // 4. Disney+ Hotstar (hotstar://)
  if (normName.includes('hotstar') || normName.includes('disney')) {
    return {
      platformName: 'Disney+ Hotstar',
      nativeScheme: 'hotstar://',
      androidIntent: 'intent://#Intent;package=in.startv.hotstar;scheme=hotstar;end',
      webUrl,
      packageName: 'in.startv.hotstar',
    };
  }

  // 5. Amazon Prime Video (primevideo://)
  if (normName.includes('prime') || normName.includes('amazon')) {
    return {
      platformName: 'Prime Video',
      nativeScheme: 'primevideo://',
      androidIntent: 'intent://#Intent;package=com.amazon.avod.thirdpartyclient;scheme=primevideo;end',
      webUrl,
      packageName: 'com.amazon.avod.thirdpartyclient',
    };
  }

  // 6. YouTube (vnd.youtube://)
  if (normName.includes('youtube')) {
    const videoMatch = webUrl.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
    const videoId = videoMatch ? videoMatch[1] : '';
    const nativeScheme = videoId ? `vnd.youtube:${videoId}` : 'vnd.youtube://';

    return {
      platformName: 'YouTube',
      nativeScheme,
      webUrl,
      packageName: 'com.google.android.youtube',
    };
  }

  // Generic fallback
  return {
    platformName,
    nativeScheme: webUrl,
    webUrl,
  };
}

/**
 * Attempts to launch native application with fallback logic to web URL
 */
export function openStreamingPlatform(
  platformName: string,
  webUrl: string,
  callbacks?: {
    onAttemptApp?: () => void;
    onFallbackWeb?: () => void;
  }
) {
  if (typeof window === 'undefined') return;

  const { isMobile, isAndroid } = isMobileDevice();
  const target = buildDeepLink(platformName, webUrl);

  // If user is on a desktop computer, immediately open web URL in new tab
  if (!isMobile) {
    window.open(target.webUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  callbacks?.onAttemptApp?.();

  // Determine preferred mobile URI
  const appUri = isAndroid && target.androidIntent ? target.androidIntent : target.nativeScheme;

  const now = Date.now();
  let appOpened = false;

  // Track if user successfully navigated away to native app
  const visibilityHandler = () => {
    if (document.hidden || (document as any).webkitHidden) {
      appOpened = true;
      document.removeEventListener('visibilitychange', visibilityHandler);
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  // Attempt opening the custom scheme via iframe or direct location
  const fallbackTimeout = setTimeout(() => {
    document.removeEventListener('visibilitychange', visibilityHandler);

    // If app didn't open and page is still focused after 1500ms, redirect to web fallback
    if (!appOpened && (Date.now() - now < 2500)) {
      callbacks?.onFallbackWeb?.();
      window.location.href = target.webUrl;
    }
  }, 1500);

  // Trigger custom URL scheme
  try {
    window.location.href = appUri;
  } catch (err) {
    clearTimeout(fallbackTimeout);
    window.location.href = target.webUrl;
  }
}
