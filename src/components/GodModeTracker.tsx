import React, { useEffect, useRef, useState } from 'react';
import { useUser } from '../lib/clerk';
import { 
  getOrCreateSessionId, 
  sendAnalyticsPayload, 
  calculateScrollDepth,
  trackAnalyticsEvent 
} from '../utils/analytics';

export interface GodModeTrackerProps {
  currentPath?: string;
  activeAnimeSlug?: string | null;
  activeTab?: string;
}

export const GodModeTracker: React.FC<GodModeTrackerProps> = ({
  currentPath,
  activeAnimeSlug,
  activeTab
}) => {
  const { user } = useUser();
  const clerkUserId = user?.id || null;
  const [trackerReady, setTrackerReady] = useState(false);

  // Resolve current active effective route path
  const effectivePath = React.useMemo(() => {
    if (activeAnimeSlug) return `/anime/${activeAnimeSlug}`;
    if (currentPath) return currentPath;
    if (activeTab && activeTab !== 'home' && activeTab !== 'catalog') return `/${activeTab}`;
    if (typeof window !== 'undefined') return window.location.pathname || '/';
    return '/';
  }, [currentPath, activeAnimeSlug, activeTab]);

  const activePathRef = useRef<string>(effectivePath);
  const startTimeRef = useRef<number>(Date.now());
  const maxScrollRef = useRef<number>(0);
  const clerkUserIdRef = useRef<string | null>(clerkUserId);

  useEffect(() => {
    clerkUserIdRef.current = clerkUserId;
  }, [clerkUserId]);

  // Flush current pageview metrics to edge backend
  const flushPageviewMetrics = (isBeacon: boolean = false) => {
    const timeSpent = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
    const maxScroll = maxScrollRef.current;
    const path = activePathRef.current;
    const sessionId = getOrCreateSessionId();

    sendAnalyticsPayload({
      sessionId,
      clerkUserId: clerkUserIdRef.current,
      type: 'pageview_update',
      path,
      timeSpentSeconds: timeSpent,
      maxScrollDepth: maxScroll
    });
  };

  // 1. Initial pageview & route transitions (deferred until lazyOnload trackerReady)
  useEffect(() => {
    if (!trackerReady) return;

    // If path changed, flush stats for the previous path first
    if (activePathRef.current !== effectivePath) {
      flushPageviewMetrics(false);
    }

    activePathRef.current = effectivePath;
    startTimeRef.current = Date.now();
    maxScrollRef.current = calculateScrollDepth();

    // Register new pageview
    const sessionId = getOrCreateSessionId();
    sendAnalyticsPayload({
      sessionId,
      clerkUserId: clerkUserIdRef.current,
      type: 'pageview',
      path: effectivePath,
      timeSpentSeconds: 0,
      maxScrollDepth: maxScrollRef.current
    });
  }, [effectivePath, trackerReady]);

  // 2. Scroll depth passive listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const depth = calculateScrollDepth();
          if (depth > maxScrollRef.current) {
            maxScrollRef.current = depth;
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // 3. Tab Visibility & Page Unload Listeners (with Beacon)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPageviewMetrics(true);
      } else {
        // Reset start time upon returning to tab
        startTimeRef.current = Date.now();
      }
    };

    const handleBeforeUnload = () => {
      flushPageviewMetrics(true);
    };

    const handlePageHide = () => {
      flushPageviewMetrics(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  // 4. Automatic Outbound Link & Click Tracker
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a, button');
      if (!target) return;

      const href = target.getAttribute('href') || target.getAttribute('data-href');
      const actionTitle = target.getAttribute('title') || target.getAttribute('data-track') || target.textContent?.trim().slice(0, 30);

      // Detect outbound streaming platform clicks
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        try {
          const url = new URL(href);
          const currentHost = window.location.host;
          
          if (url.host !== currentHost) {
            let eventType = 'outbound_click';
            const lowerHost = url.host.toLowerCase();
            if (lowerHost.includes('crunchyroll')) eventType = 'clicked_crunchyroll';
            else if (lowerHost.includes('netflix')) eventType = 'clicked_netflix';
            else if (lowerHost.includes('jiocinema') || lowerHost.includes('hotstar')) eventType = 'clicked_jiocinema';
            else if (lowerHost.includes('youtube')) eventType = 'clicked_youtube';
            else if (lowerHost.includes('bilibili')) eventType = 'clicked_bilibili';

            trackAnalyticsEvent(eventType, href, clerkUserIdRef.current);
          }
        } catch {}
      } else if (target.getAttribute('data-track-event')) {
        const customEvent = target.getAttribute('data-track-event');
        if (customEvent) {
          trackAnalyticsEvent(customEvent, actionTitle || '', clerkUserIdRef.current);
        }
      }
    };

    document.addEventListener('click', handleGlobalClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, []);

  // 5. Periodic Heartbeat Ping (Every 60s) for Real-Time Live Users tracking
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const sessionId = getOrCreateSessionId();
        sendAnalyticsPayload({
          sessionId,
          clerkUserId: clerkUserIdRef.current,
          type: 'ping',
          path: activePathRef.current
        });
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // 6. Defer tracker activation until browser is idle after load (non-blocking)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const activate = () => setTrackerReady(true);
    const scheduleIdle = () => {
      if ('requestIdleCallback' in window) {
        idleId = (window as any).requestIdleCallback(activate, { timeout: 3500 });
      } else {
        timerId = setTimeout(activate, 1200);
      }
    };

    if (document.readyState === 'complete') {
      scheduleIdle();
    } else {
      window.addEventListener('load', scheduleIdle, { once: true });
    }

    return () => {
      window.removeEventListener('load', scheduleIdle);
      if (timerId !== null) clearTimeout(timerId);
      if (idleId !== null && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleId);
      }
    };
  }, []);

  return null;
};
