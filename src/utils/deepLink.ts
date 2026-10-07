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

  let domainAndPath = 'www.crunchyroll.com';
  try {
    const parsed = new URL(webUrl);
    domainAndPath = parsed.host + parsed.pathname + parsed.search;
  } catch {
    // fallback if webUrl is relative or invalid
  }

  let packageName = 'com.crunchyroll.crunchyrollapp';
  let nativeScheme = `crunchyroll://${domainAndPath}`;

  if (normName.includes('netflix')) {
    packageName = 'com.netflix.mediaclient';
    nativeScheme = `nflx://${domainAndPath}`;
  } else if (normName.includes('crunchyroll')) {
    packageName = 'com.crunchyroll.crunchyroid';
    nativeScheme = `crunchyroll://${domainAndPath}`;
  } else if (normName.includes('jiocinema') || normName.includes('jio cinema')) {
    packageName = 'com.jio.media.ondemand';
    nativeScheme = `jiocinema://${domainAndPath}`;
  } else if (normName.includes('hotstar') || normName.includes('disney')) {
    packageName = 'in.startv.hotstar';
    nativeScheme = `hotstar://${domainAndPath}`;
  } else if (normName.includes('prime') || normName.includes('amazon')) {
    packageName = 'com.amazon.avod.thirdpartyclient';
    nativeScheme = `primevideo://${domainAndPath}`;
  } else if (normName.includes('youtube')) {
    packageName = 'com.google.android.youtube';
    nativeScheme = `vnd.youtube://${domainAndPath}`;
  }

  // Android Intent URI scheme fallback as requested:
  // intent://[URL_DOMAIN_AND_PATH]#Intent;scheme=https;package=[PACKAGE_NAME];end;
  const androidIntent = `intent://${domainAndPath}#Intent;scheme=https;package=${packageName};end;`;

  return {
    platformName,
    nativeScheme,
    androidIntent,
    webUrl,
    packageName,
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
