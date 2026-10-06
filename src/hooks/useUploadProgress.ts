// ==============================================================================
// AniDub India — Frontend Hook: useUploadProgress
// Real-time Firestore Listener for system/upload_status
// ==============================================================================

import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

export interface UploadProgressState {
  jobId: string | null;
  status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed';
  totalItems: number;
  processedItems: number;
  successCount: number;
  failedCount: number;
  dlqCount: number;
  currentBatch: number;
  totalBatches: number;
  percentage: number;
  lastProcessedTitle?: string;
  error?: string | null;
  startedAt?: string;
  updatedAt?: any;
  completedAt?: string;
}

export function useUploadProgress() {
  const [progress, setProgress] = useState<UploadProgressState>({
    jobId: null,
    status: 'idle',
    totalItems: 0,
    processedItems: 0,
    successCount: 0,
    failedCount: 0,
    dlqCount: 0,
    currentBatch: 0,
    totalBatches: 0,
    percentage: 0,
    error: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscribe to real-time updates from Firestore doc: system/upload_status
  useEffect(() => {
    try {
      const statusDocRef = doc(db, 'system', 'upload_status');
      const unsubscribe = onSnapshot(
        statusDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const total = Number(data.totalItems || 0);
            const processed = Number(data.processedItems || 0);
            const calcPct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

            setProgress({
              jobId: data.jobId || null,
              status: data.status || 'idle',
              totalItems: total,
              processedItems: processed,
              successCount: Number(data.successCount || 0),
              failedCount: Number(data.failedCount || 0),
              dlqCount: Number(data.dlqCount || 0),
              currentBatch: Number(data.currentBatch || 0),
              totalBatches: Number(data.totalBatches || 0),
              percentage: typeof data.percentage === 'number' ? data.percentage : calcPct,
              lastProcessedTitle: data.lastProcessedTitle || '',
              error: data.error || null,
              startedAt: data.startedAt,
              updatedAt: data.updatedAt,
              completedAt: data.completedAt,
            });
          }
        },
        (error) => {
          console.warn('[useUploadProgress] Snapshot subscription notice:', error);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('[useUploadProgress] Setup error:', err);
    }
  }, []);

  /**
   * Dispatches bulk upload to the backend API route with instant 202 Accepted acknowledgment
   */
  const startBulkUpload = useCallback(async (items: any[]) => {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Upload list cannot be empty.');
    }

    setIsSubmitting(true);
    try {
      // Optimistic initial state
      setProgress((prev) => ({
        ...prev,
        status: 'queued',
        totalItems: items.length,
        processedItems: 0,
        percentage: 0,
        error: null,
      }));

      const res = await fetch('/api/admin/bulk-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      });

      if (!res.ok && res.status !== 202) {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.error || `Upload failed with status: ${res.status}`;
        setProgress(prev => ({ ...prev, status: 'failed', error: errMsg }));
        throw new Error(errMsg);
      }

      const data = await res.json();
      return data;
    } catch (err: any) {
      setProgress(prev => ({ ...prev, status: 'failed', error: err?.message || 'Failed to start upload' }));
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  /**
   * Resets the upload progress status in Firestore
   */
  const resetProgress = useCallback(async () => {
    try {
      const statusDocRef = doc(db, 'system', 'upload_status');
      await setDoc(statusDocRef, {
        status: 'idle',
        jobId: null,
        totalItems: 0,
        processedItems: 0,
        percentage: 0,
        successCount: 0,
        failedCount: 0,
        dlqCount: 0,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('[useUploadProgress] Reset error:', err);
      // Fallback local reset
      setProgress({
        jobId: null,
        status: 'idle',
        totalItems: 0,
        processedItems: 0,
        successCount: 0,
        failedCount: 0,
        dlqCount: 0,
        currentBatch: 0,
        totalBatches: 0,
        percentage: 0,
        error: null,
      });
    }
  }, []);

  const isUploading = isSubmitting || progress.status === 'queued' || progress.status === 'processing';

  return {
    progress,
    isUploading,
    isSubmitting,
    startBulkUpload,
    resetProgress,
  };
}
