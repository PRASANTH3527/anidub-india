import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X, Share } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'button' | 'menu-item';
  onActionComplete?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'button',
  onActionComplete,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
      onActionComplete?.();
      return;
    }
    if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      {variant === 'menu-item' ? (
        <button
          type="button"
          role="menuitem"
          onClick={handleInstallClick}
          className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
        >
          {isIOS ? (
            <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Download className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <div>
            <div>{isIOS ? 'Install on iPhone / iPad' : 'Install AniDub App'}</div>
            <div className="text-[10px] text-neutral-400 font-normal">Add to Home Screen</div>
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          aria-label="Install AniDub India App"
          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 hover:text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
        >
          {isIOS ? <Smartphone className="w-3.5 h-3.5 shrink-0" /> : <Download className="w-3.5 h-3.5 shrink-0" />}
          <span>{isIOS ? 'Install' : 'Install App'}</span>
        </button>
      )}

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-pwa-guide-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-[#111624] border border-white/15 p-6 shadow-2xl space-y-4 text-left"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 id="ios-pwa-guide-title" className="text-base font-bold text-white">
                Install AniDub India on iOS
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="Close install instructions"
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-2.5 text-xs text-neutral-300 leading-relaxed list-decimal pl-4">
              <li>
                Tap the <strong className="text-white inline-flex items-center gap-1">Share <Share className="w-3 h-3 inline" /></strong> button in Safari&apos;s toolbar.
              </li>
              <li>
                Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong className="text-white">Add</strong> to launch AniDub India like a native app.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-4 left-4 z-[90] flex items-center gap-2 rounded-xl bg-amber-500/95 border border-amber-300/40 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-xl backdrop-blur-md"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Showing cached data</span>
    </div>
  );
};
