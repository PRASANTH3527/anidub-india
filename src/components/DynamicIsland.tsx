import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface DynamicIslandToast {
  id: string;
  type: 'success' | 'warning' | 'info';
  title: string;
  message: string;
}

export interface DynamicIslandProps {
  toast: DynamicIslandToast | null;
  onDismiss: () => void;
}

/**
 * Standardized Eclipse Toast Notification:
 * - Mobile: positioned cleanly ABOVE the 56px mobile bottom navigation bar
 *   (`bottom-[calc(env(safe-area-inset-bottom,0px)+4.25rem)]`)
 * - Desktop: positioned at `md:top-4 md:bottom-auto`
 * - 180ms transition respecting `prefers-reduced-motion`
 * - 44x44px accessible dismiss button
 */
export const DynamicIsland: React.FC<DynamicIslandProps> = ({
  toast,
  onDismiss,
}) => {
  return (
    <div
      data-testid="eclipse-toast-container"
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] md:bottom-auto md:top-4 left-0 right-0 z-[100] flex justify-center pointer-events-none px-3 sm:px-4 font-sans"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            role="status"
            aria-live="polite"
            data-testid="eclipse-toast"
            className="pointer-events-auto flex items-center gap-3 pl-4 pr-1.5 py-1.5 rounded-[12px] bg-[#12141E] border border-[#292B39] shadow-2xl min-w-[240px] max-w-[92vw] sm:max-w-md overflow-hidden"
          >
            {/* ICON WRAPPER */}
            <div className="shrink-0">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#34D399]" />}
              {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-[#F87171]" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-[#B49AF8]" />}
            </div>

            {/* TEXT COLUMN */}
            <div className="flex flex-col min-w-0 pr-1">
              <span className="text-xs sm:text-[13px] font-bold text-[#F4F3FA] truncate leading-tight">
                {toast.title}
              </span>
              <span className="text-xs text-[#A1A5B5] truncate leading-tight mt-0.5">
                {toast.message}
              </span>
            </div>

            {/* CLOSE BUTTON (44x44px touch target) */}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss notification"
              className="ml-auto w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] hover:bg-[#191C29] text-[#A1A5B5] hover:text-[#F4F3FA] flex items-center justify-center transition-colors duration-180 motion-reduce:transition-none cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
