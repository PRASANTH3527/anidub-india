import React, { createContext, useContext, useState, useCallback } from 'react';
import { DynamicIsland } from './DynamicIsland';

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
      <DynamicIsland toasts={toasts} onRemove={removeToast} />
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
