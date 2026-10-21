import React, { createContext, useContext, useState, useCallback } from 'react';
import { DynamicIsland, DynamicIslandToast } from './DynamicIsland';

export interface ToastContextType {
  showToast: (title: string, message: string, type?: 'success' | 'warning' | 'info') => void;
  success: (title: string, message: string) => void;
  error: (title: string, message: string) => void;
  info: (title: string, message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<DynamicIslandToast | null>(null);

  const showToast = useCallback((title: string, message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    const newToast: DynamicIslandToast = {
      id: `toast_${Date.now()}`,
      title,
      message,
      type
    };
    setToasts(newToast);

    setTimeout(() => {
      setToasts(prev => (prev?.id === newToast.id ? null : prev));
    }, 4500);
  }, []);

  const success = useCallback((title: string, message: string) => {
    showToast(title, message, 'success');
  }, [showToast]);

  const error = useCallback((title: string, message: string) => {
    showToast(title, message, 'warning');
  }, [showToast]);

  const info = useCallback((title: string, message: string) => {
    showToast(title, message, 'info');
  }, [showToast]);

  const removeToast = useCallback(() => {
    setToasts(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info }}>
      {children}
      <DynamicIsland toast={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
