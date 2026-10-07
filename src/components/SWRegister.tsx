'use client';

import { useEffect } from 'react';

export default function SWRegister() {
  useEffect(() => {
    // Suppress benign ResizeObserver notifications loop error
    if (typeof window !== 'undefined') {
      const originalError = console.error;
      console.error = (...args) => {
        if (typeof args[0] === 'string' && args[0].includes('ResizeObserver loop completed with undelivered notifications')) {
          return;
        }
        originalError.apply(console, args);
      };
      window.addEventListener('error', e => {
        if (e.message && e.message.includes('ResizeObserver loop completed')) {
          e.stopImmediatePropagation();
        }
      });
    }

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('[PWA] Service Worker registered with scope:', registration.scope);

          // Listen for Background Sync completion broadcast messages from Service Worker
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'SYNC_COMPLETED') {
              console.log('[PWA] Background Sync completed for', event.data.count, 'items');
              window.dispatchEvent(
                new CustomEvent('pwa-sync-completed', { detail: event.data })
              );
            }
          });
        } catch (error) {
          console.warn('[PWA] Service Worker registration failed:', error);
        }
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
        return () => window.removeEventListener('load', registerSW);
      }
    }
  }, []);

  return null;
}
