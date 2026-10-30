import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mic, MicOff, Settings, RefreshCw, AlertCircle, Chrome, Globe, Info } from 'lucide-react';

export interface MicPermissionBottomSheetProps {
  isOpen: boolean;
  isPermanentlyBlocked: boolean;
  onClose: () => void;
  onAllow: () => void;
}

export const MicPermissionBottomSheet: React.FC<MicPermissionBottomSheetProps> = ({
  isOpen,
  isPermanentlyBlocked,
  onClose,
  onAllow
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-[101] bg-[#0d111c] border-t border-white/10 rounded-t-[32px] p-6 sm:p-8 shadow-[0_-20px_40px_rgba(0,0,0,0.4)] font-sans text-neutral-100 max-w-2xl mx-auto"
          >
            {/* Handle Bar */}
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />

            <div className="flex flex-col items-center text-center space-y-4 mb-8">
              <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg ${
                isPermanentlyBlocked 
                  ? 'bg-red-500/10 border border-red-500/30 text-red-500' 
                  : 'bg-purple-500/10 border border-purple-500/30 text-purple-400'
              }`}>
                {isPermanentlyBlocked ? <MicOff size={32} /> : <Mic size={32} />}
              </div>
              <div className="space-y-2 px-4">
                <h2 className="text-xl font-black text-white tracking-tight">
                  {isPermanentlyBlocked ? 'Permission Blocked' : 'Voice Search Experience'}
                </h2>
                <p className="text-sm text-neutral-400 leading-relaxed max-w-sm">
                  {isPermanentlyBlocked 
                    ? "To use voice search, tap the lock icon in the browser's URL bar, go to Permissions, and allow Microphone access."
                    : 'To search for your favorite anime using your voice, we need permission to use your microphone.'}
                </p>
              </div>
            </div>

            {isPermanentlyBlocked ? (
              /* Visual Helper for blocked state */
              <div className="space-y-3 mb-8">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 items-center">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                    <Settings size={20} />
                  </div>
                  <div className="text-xs leading-relaxed text-neutral-300 font-medium">
                    Settings usually stay active after you refresh the page.
                  </div>
                </div>
              </div>
            ) : (
              /* Simple info for first-time / retry state */
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10 mb-8">
                <Info size={18} className="text-purple-400 shrink-0 mt-0.5" />
                <p className="text-xs text-neutral-400 leading-relaxed">
                  We only listen when you tap the microphone. Audio is processed directly in your browser and never stored on our servers.
                </p>
              </div>
            )}

            {/* Action Footer */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-sm font-bold text-neutral-300 transition-all cursor-pointer border border-white/10 order-2 sm:order-1"
              >
                Maybe Later
              </button>
              <button
                onClick={onAllow}
                className="flex-1 px-6 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold shadow-lg shadow-purple-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer order-1 sm:order-2 active:scale-95"
              >
                {isPermanentlyBlocked ? <RefreshCw size={18} /> : <Mic size={18} />}
                <span>{isPermanentlyBlocked ? 'I have updated settings' : 'Allow / Retry'}</span>
              </button>
            </div>

            <div className="mt-6 flex items-center gap-2 justify-center text-[10px] text-neutral-500 font-medium">
              <AlertCircle size={12} />
              <span>Permission prompts are handled by your browser securely.</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
