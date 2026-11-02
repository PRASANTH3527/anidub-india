import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ToastProvider } from './components/Toast.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const AppWrapper = () => {
  const content = (
    <ToastProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </ToastProvider>
  );

  if (!PUBLISHABLE_KEY || PUBLISHABLE_KEY.includes('anidub.india.app')) {
    return content;
  }

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      {content}
    </ClerkProvider>
  );
};

createRoot(document.getElementById('root')!).render(<AppWrapper />);

