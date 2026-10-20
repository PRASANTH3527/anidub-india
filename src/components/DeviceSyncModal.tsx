import React, { useState } from 'react';
import { X, Cloud, Shield, RefreshCw, Download, Upload, Check } from 'lucide-react';

export interface DeviceSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceSyncModal: React.FC<DeviceSyncModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const [syncCode, setSyncCode] = useState('');
  const [restoreInput, setRestoreInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoredSuccess, setRestoredSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateCode = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      setSyncCode(`ANIDUB-${code}`);
      setIsGenerating(false);
    }, 600);
  };

  const handleCopyCode = () => {
    if (!syncCode) return;
    navigator.clipboard?.writeText(syncCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRestore = () => {
    if (!restoreInput.trim()) return;
    setIsRestoring(true);
    setTimeout(() => {
      setIsRestoring(false);
      setRestoredSuccess(true);
      setTimeout(() => {
        setRestoredSuccess(false);
        onClose();
      }, 1500);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* MODAL CONTAINER */}
      <div className="relative w-full max-w-md bg-[#121829] border border-primary-theme rounded-3xl p-6 shadow-2xl space-y-6 text-neutral-100 font-sans">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl btn-primary-theme flex items-center justify-center text-white shadow-lg">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-white text-base sm:text-lg tracking-tight">
                Cross-Device Sync
              </h2>
              <p className="text-neutral-400 text-xs mt-0.5">
                Transfer your watchlist & collections instantly across devices.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* EXPORT SECTION */}
        <div className="p-4 rounded-2xl bg-[#0a0e17] border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-200 uppercase tracking-wider">
            <Shield className="w-4 h-4 text-primary-theme" />
            <span>Export Sync Code</span>
          </div>

          {syncCode ? (
            <div 
              onClick={handleCopyCode}
              className="flex items-center justify-between p-3 rounded-xl bg-[#141b2c] border border-accent-theme/50 cursor-pointer group"
              title="Click to copy"
            >
              <span className="font-mono text-2xl font-black tracking-widest text-accent-theme">
                {syncCode}
              </span>
              <span className="text-xs font-bold text-neutral-400 group-hover:text-white transition-colors">
                {copied ? 'Copied!' : 'Copy'}
              </span>
            </div>
          ) : (
            <div className="text-xs text-neutral-400">
              Generate a temporary 1-hour secure sync token to import data on your mobile or tablet.
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerateCode}
            disabled={isGenerating}
            className="w-full py-3 rounded-xl btn-primary-theme text-white text-xs font-black transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <Download className="w-4 h-4" />
            <span>{isGenerating ? 'Generating Token...' : 'Generate Sync Code'}</span>
          </button>
        </div>

        {/* DIVIDER */}
        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-neutral-800" />
          <span className="flex-shrink mx-4 text-neutral-500 text-[10px] font-bold uppercase tracking-widest bg-[#121829] px-2">
            OR
          </span>
          <div className="flex-grow border-t border-neutral-800" />
        </div>

        {/* RESTORE SECTION */}
        <div className="p-4 rounded-2xl bg-[#0a0e17] border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-200 uppercase tracking-wider">
            <RefreshCw className="w-4 h-4 text-sky-400" />
            <span>Restore From Device</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={restoreInput}
              onChange={(e) => setRestoreInput(e.target.value.toUpperCase())}
              placeholder="ANIDUB-XXXXXX"
              className="flex-1 bg-[#121829] border border-neutral-800 focus:border-accent-theme rounded-xl px-3 py-2.5 text-center font-mono text-base tracking-widest text-white outline-none"
            />
            <button
              type="button"
              onClick={handleRestore}
              disabled={isRestoring || !restoreInput.trim()}
              className="px-4 py-2.5 rounded-xl btn-primary-theme text-white text-xs font-black transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer shadow-md"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isRestoring ? 'Restoring...' : restoredSuccess ? 'Restored!' : 'Restore'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
