import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, message, type = 'success', duration = 3500 }: Omit<ToastItem, 'id'>) => {
      const id = 'toast-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 4);
      const newToast: ToastItem = { id, title, message, type, duration };

      setToasts((prev) => [...prev.slice(-3), newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((title: string, message?: string) => {
    showToast({ title, message, type: 'success' });
  }, [showToast]);

  const error = useCallback((title: string, message?: string) => {
    showToast({ title, message, type: 'error' });
  }, [showToast]);

  const info = useCallback((title: string, message?: string) => {
    showToast({ title, message, type: 'info' });
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info }}>
      {children}
      {/* Toast Floating Container */}
      <div 
        aria-live="polite"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl border shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-300 transition-all ${
                isSuccess
                  ? 'bg-[#0f1d1b]/95 border-emerald-500/40 text-emerald-200'
                  : isError
                  ? 'bg-[#211116]/95 border-rose-500/40 text-rose-200'
                  : 'bg-[#141b2d]/95 border-purple-500/40 text-purple-200'
              }`}
            >
              {/* Icon */}
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {isError && <AlertCircle className="w-5 h-5 text-rose-400" />}
                {!isSuccess && !isError && <Info className="w-5 h-5 text-purple-400" />}
              </div>

              {/* Text */}
              <div className="flex-grow min-w-0">
                <h4 className="font-heading font-black text-xs sm:text-sm text-white tracking-tight">
                  {toast.title}
                </h4>
                {toast.message && (
                  <p className="text-[11px] text-neutral-300 mt-0.5 leading-snug">
                    {toast.message}
                  </p>
                )}
              </div>

              {/* Dismiss */}
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      showToast: () => {},
      success: (t, m) => console.log('[Toast Success]', t, m),
      error: (t, m) => console.error('[Toast Error]', t, m),
      info: (t, m) => console.log('[Toast Info]', t, m),
    };
  }
  return context;
};
