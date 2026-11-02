import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ToastProvider } from './components/Toast.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';

const rawKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
const PUBLISHABLE_KEY = rawKey.startsWith('pk_test_Z2VudGxlLXRvdWNhbi00Njg2LmNsZXJrLmFjY291bn')
  ? 'pk_test_Z2VudGxlLXRvdWNhbi00Njg2LmNsZXJrLmFjY291bnRzLmRldiQ='
  : (rawKey || 'pk_test_Z2VudGxlLXRvdWNhbi00Njg2LmNsZXJrLmFjY291bnRzLmRldiQ=');

createRoot(document.getElementById('root')!).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
    <ToastProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </ToastProvider>
  </ClerkProvider>
);
