import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ToastProvider } from './components/Toast.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { ClerkProvider } from './lib/clerk.tsx';
import './index.css';

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
