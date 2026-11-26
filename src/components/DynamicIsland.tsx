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

export const DynamicIsland: React.FC<DynamicIslandProps> = ({
  toast,
  onDismiss,
}) => {
  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex justify-center pointer-events-none px-4 font-sans">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            role="status"
            aria-live="polite"
            className="pointer-events-auto flex items-center gap-3 pl-4 pr-2 py-2 rounded-2xl bg-[#12141E] border border-[#292B39] shadow-2xl min-w-[220px] max-w-[92vw] sm:max-w-md overflow-hidden"
          >
            {/* ICON WRAPPER */}
            <div className="shrink-0">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#34D399]" />}
              {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-[#F87171]" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-[#B49AF8]" />}
            </div>

            {/* TEXT COLUMN */}
            <div className="flex flex-col min-w-0 pr-1">
              <span className="text-xs font-bold text-[#F4F3FA] truncate leading-tight">
                {toast.title}
              </span>
              <span className="text-[11px] text-[#A1A5B5] truncate leading-tight mt-0.5">
                {toast.message}
              </span>
            </div>

            {/* CLOSE BUTTON (44x44px touch target on mobile) */}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss notification"
              className="ml-auto w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl hover:bg-[#191C29] text-[#A1A5B5] hover:text-[#F4F3FA] flex items-center justify-center transition-colors duration-150 cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
