import React, { useEffect } from 'react';

export type ScriptStrategy = 'beforeInteractive' | 'afterInteractive' | 'lazyOnload' | 'worker';

export interface ScriptProps extends React.ScriptHTMLAttributes<HTMLScriptElement> {
  id?: string;
  src?: string;
  strategy?: ScriptStrategy;
  onLoad?: (e?: any) => void;
  onReady?: () => void;
  onError?: (e?: any) => void;
  children?: string;
}

/**
 * Schedules a callback according to the requested Next.js Script loading strategy
 * (`afterInteractive` or `lazyOnload`) to eliminate render-blocking execution.
 */
export function scheduleByStrategy(strategy: ScriptStrategy = 'afterInteractive', callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  if (strategy === 'beforeInteractive') {
    callback();
    return () => {};
  }

  if (strategy === 'lazyOnload') {
    let timerId: any = null;
    let idleId: any = null;

    const runIdle = () => {
      if ('requestIdleCallback' in window) {
        idleId = (window as any).requestIdleCallback(() => callback(), { timeout: 3500 });
      } else {
        timerId = setTimeout(callback, 1200);
      }
    };

    if (document.readyState === 'complete') {
      runIdle();
    } else {
      window.addEventListener('load', runIdle, { once: true });
    }

    return () => {
      window.removeEventListener('load', runIdle);
      if (timerId) clearTimeout(timerId);
      if (idleId && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleId);
      }
    };
  }

  // Default: afterInteractive
  const timer = setTimeout(callback, 0);
  return () => clearTimeout(timer);
}

export const Script: React.FC<ScriptProps> = ({
  id,
  src,
  strategy = 'afterInteractive',
  onLoad,
  onReady,
  onError,
  children,
  ...rest
}) => {
  useEffect(() => {
    return scheduleByStrategy(strategy, () => {
      if (!src && !children) {
        onLoad?.();
        onReady?.();
        return;
      }

      if (id && document.getElementById(id)) {
        onReady?.();
        return;
      }

      const script = document.createElement('script');
      if (id) script.id = id;
      script.async = true;
      script.defer = true;

      if (src) {
        script.src = src;
        script.onload = (e) => {
          onLoad?.(e);
          onReady?.();
        };
        script.onerror = (e) => {
          onError?.(e);
        };
      } else if (typeof children === 'string') {
        script.textContent = children;
      }

      Object.entries(rest).forEach(([key, val]) => {
        if (typeof val === 'string') {
          script.setAttribute(key, val);
        }
      });

      document.body.appendChild(script);
      if (!src) {
        onLoad?.();
        onReady?.();
      }
    });
  }, [id, src, strategy, children]);

  return null;
};

export default Script;
