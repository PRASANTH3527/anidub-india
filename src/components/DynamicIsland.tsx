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
  onDismiss
}) => {
  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex justify-center pointer-events-none px-4 font-sans">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full bg-black/90 backdrop-blur-2xl border border-white/10 shadow-2xl min-w-[200px] max-w-[90vw] overflow-hidden"
          >
            {/* ICON WRAPPER */}
            <div className="shrink-0">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-purple-400" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-purple-400" />}
            </div>

            {/* TEXT COLUMN */}
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-xs font-black text-white truncate leading-tight">
                {toast.title}
              </span>
              <span className="text-[10px] text-neutral-400 truncate leading-tight mt-0.5">
                {toast.message}
              </span>
            </div>

            {/* CLOSE BUTTON */}
            <button
              onClick={onDismiss}
              className="ml-auto p-1 rounded-full hover:bg-white/10 text-neutral-500 hover:text-white transition-colors cursor-pointer shrink-0"
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
