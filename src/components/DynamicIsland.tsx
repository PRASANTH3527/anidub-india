import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { ToastItem } from './Toast';

interface DynamicIslandProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

export const DynamicIsland: React.FC<DynamicIslandProps> = ({ toasts, onRemove }) => {
  const [activeToast, setActiveToast] = useState<ToastItem | null>(null);

  useEffect(() => {
    if (toasts.length > 0) {
      setActiveToast(toasts[toasts.length - 1]);
    } else {
      setActiveToast(null);
    }
  }, [toasts]);

  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex justify-center pointer-events-none px-4">
      <AnimatePresence mode="wait">
        {activeToast && (
          <motion.div
            key={activeToast.id}
            initial={{ y: -100, scale: 0.5, opacity: 0 }}
            animate={{ 
              y: 0, 
              scale: 1, 
              opacity: 1,
              transition: {
                type: "spring",
                stiffness: 400,
                damping: 25
              }
            }}
            exit={{ 
              y: -100, 
              scale: 0.5, 
              opacity: 0,
              transition: { duration: 0.2 }
            }}
            className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full bg-black/90 backdrop-blur-2xl border border-white/10 shadow-2xl min-w-[200px] max-w-[90vw] overflow-hidden"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
              className="shrink-0"
            >
              {activeToast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {activeToast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
              {activeToast.type === 'info' && <Info className="w-5 h-5 text-purple-400" />}
            </motion.div>

            <div className="flex flex-col min-w-0 pr-2">
              <h4 className="text-xs font-black text-white truncate leading-tight">
                {activeToast.title}
              </h4>
              {activeToast.message && (
                <p className="text-[10px] text-neutral-400 truncate leading-tight mt-0.5">
                  {activeToast.message}
                </p>
              )}
            </div>

            <button
              onClick={() => onRemove(activeToast.id)}
              className="ml-auto p-1 rounded-full hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
