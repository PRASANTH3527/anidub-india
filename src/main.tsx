import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ToastProvider } from './components/Toast.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { ClerkProvider } from './lib/clerk.tsx';
import './index.css';

const PUBLISHABLE_KEY =
  (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY ||
  (import.meta as any).env?.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  "pk_test_Z2VudGxlLXRvdWNhbi00Njg2LmNsZXJrLmFjY291bnRzLmRldiQ";

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

createRoot(document.getElementById('root')!).render(
  <ClerkProvider
    publishableKey={PUBLISHABLE_KEY}
    afterSignOutUrl="/"
  >
    <ToastProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </ToastProvider>
  </ClerkProvider>
);
