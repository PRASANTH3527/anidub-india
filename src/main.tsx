import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ToastProvider } from './components/Toast.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { ClerkProvider } from './lib/clerk.tsx';
import './index.css';

const googleFontsSheet = document.getElementById('google-fonts-stylesheet') as HTMLLinkElement | null;
if (googleFontsSheet && googleFontsSheet.media === 'print') {
  googleFontsSheet.media = 'all';
}

createRoot(document.getElementById('root')!).render(
  <ClerkProvider
    publishableKey="pk_test_Z2VudGxlLXRvdWNhbi00Njg2LmNsZXJrLmFjY291bnRzLmRldiQ"
    afterSignOutUrl="/"
  >
    <ToastProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </ToastProvider>
  </ClerkProvider>
);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Non-fatal in restricted/sandboxed preview frames
    });
  });
}

