'use client';

import React, { useEffect } from 'react';
import { syncManager } from '../services/syncManager';

export const UserPendingSync: React.FC = () => {
  useEffect(() => {
    // Check and silently sync pending submissions from IndexedDB on app load
    const syncSubmissions = async () => {
      try {
        const result = await syncManager.syncUserSubmissions();
        if (result.synced > 0) {
          console.log(`[UserPendingSync] Silently synced ${result.synced} pending user submission(s) to Firestore via IndexedDB.`);
        }
      } catch (err) {
        // Silently catch errors to avoid disturbing the user
        console.warn('[UserPendingSync] Background sync attempt notice:', err);
      }
    };

    // Run on app load
    syncSubmissions();

    // Register Background Sync API with browser service worker
    syncManager.requestServiceWorkerSync();

    // Also retry when network comes online
    window.addEventListener('online', syncSubmissions);
    return () => window.removeEventListener('online', syncSubmissions);
  }, []);

  return null;
};

export default UserPendingSync;
