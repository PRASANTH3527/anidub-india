'use client';

import React, { useState } from 'react';
import { Cloud, Key, Copy, Check, RefreshCw, X, Shield, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';

interface DeviceSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess?: () => void;
}

export const DeviceSyncModal: React.FC<DeviceSyncModalProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess,
}) => {
  const toast = useToast();
  const [syncCode, setSyncCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // 1. Generate 6-digit sync code & save payload to Supabase
  const generateSyncCode = async () => {
    setIsLoading(true);
    try {
      const favorites = JSON.parse(localStorage.getItem('anidub_local_watchlist') || '[]');
      const recentlyViewed = JSON.parse(localStorage.getItem('anidub_recently_viewed') || '[]');
      const upvotes = JSON.parse(localStorage.getItem('anidub_upvoted_anime_ids') || '[]');
      const profile = JSON.parse(localStorage.getItem('anidub_user_profile') || '{}');

      const payload = {
        favorites,
        recentlyViewed,
        upvotes,
        profile,
        updatedAt: new Date().toISOString(),
      };

      const code = Math.floor(100000 + Math.random() * 900000).toString();

      const { error } = await supabase
        .from('device_syncs')
        .insert([{ sync_code: code, payload }]);

      if (error) {
        console.error('Supabase sync insert error:', error);
        toast.error('Sync Error', error.message || 'Failed to generate sync code. Please check table setup.');
        return;
      }

      setSyncCode(code);
      toast.success('Sync Code Generated!', `Your 6-digit code is ${code}. Enter this on your other device.`);
    } catch (err: any) {
      console.error('Generate sync code exception:', err);
      toast.error('Error', 'Failed to generate sync code.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Restore data from Supabase using 6-digit sync code
  const restoreFromSyncCode = async (codeToRestore?: string) => {
    const code = (codeToRestore || inputCode).trim();
    if (!code || code.length !== 6) {
      toast.error('Invalid Code', 'Please enter a valid 6-digit sync code.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('device_syncs')
        .select('*')
        .eq('sync_code', code)
        .single();

      if (error || !data) {
        console.error('Supabase fetch error:', error);
        toast.error('Sync Not Found', 'No sync data found for this 6-digit code or code has expired.');
        return;
      }

      const payload = data.payload;
      if (payload) {
        if (Array.isArray(payload.favorites)) {
          localStorage.setItem('anidub_local_watchlist', JSON.stringify(payload.favorites));
        }
        if (Array.isArray(payload.recentlyViewed)) {
          localStorage.setItem('anidub_recently_viewed', JSON.stringify(payload.recentlyViewed));
        }
        if (Array.isArray(payload.upvotes)) {
          localStorage.setItem('anidub_upvoted_anime_ids', JSON.stringify(payload.upvotes));
        }
        if (payload.profile && typeof payload.profile === 'object') {
          localStorage.setItem('anidub_user_profile', JSON.stringify(payload.profile));
        }
      }

      await supabase
        .from('device_syncs')
        .delete()
        .eq('sync_code', code);

      toast.success('Device Successfully Synced!', 'Watchlist, history, and profile restored!');
      setInputCode('');
      onRestoreSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Restore sync exception:', err);
      toast.error('Restore Error', 'Failed to restore from sync code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!syncCode) return;
    navigator.clipboard.writeText(syncCode);
    setCopied(true);
    toast.success('Copied!', 'Sync code copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-[#121829] border border-primary-theme rounded-3xl p-6 shadow-2xl space-y-6">
        
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl btn-primary-theme flex items-center justify-center text-white shadow-lg">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-black text-white text-base">Anonymous Device Sync</h3>
              <p className="text-[11px] text-neutral-400">Sync data between devices without login</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-6">
          
          <div className="p-4 rounded-2xl bg-[#0a0e17] border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-accent-theme" />
                <span>Export From This Device</span>
              </span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Generate a secure 6-digit sync code to transfer your watchlist, watch history, and profile to another device instantly.
            </p>

            {syncCode ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#141b2c] border border-accent-theme/50">
                <div className="font-mono text-2xl font-black tracking-widest text-accent-theme">
                  {syncCode}
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg btn-primary-theme text-white text-xs font-bold transition-all active:scale-95 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={generateSyncCode}
                disabled={isLoading}
                className="w-full py-3 rounded-xl btn-primary-theme text-white text-xs font-black transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                <span>Generate Sync Code</span>
              </button>
            )}
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-neutral-800"></div>
            <span className="flex-shrink mx-4 text-neutral-500 text-[10px] font-bold uppercase tracking-widest">OR</span>
            <div className="flex-grow border-t border-neutral-800"></div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0a0e17] border border-neutral-800 space-y-3">
            <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-accent-theme" />
              <span>Restore On This Device</span>
            </span>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Enter the 6-digit sync code generated from your other device to import your data.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit code"
                className="flex-1 bg-[#121829] border border-neutral-800 focus:border-accent-theme rounded-xl px-3 py-2.5 text-center font-mono text-base tracking-widest text-white placeholder-neutral-600 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => restoreFromSyncCode()}
                disabled={isLoading || inputCode.length !== 6}
                className="px-4 py-2.5 rounded-xl btn-primary-theme text-white text-xs font-black transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer shadow-md"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>Restore</span>
              </button>
            </div>
          </div>

        </div>

        <div className="flex justify-end pt-2 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
