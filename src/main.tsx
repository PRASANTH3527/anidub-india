import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress harmless ResizeObserver loop limit exceeded error
const originalOnError = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  if (typeof message === 'string' && message.includes('ResizeObserver')) {
    return true;
  }
  if (originalOnError) {
    return originalOnError(message, source, lineno, colno, error);
  }
  return false;
};

window.addEventListener('error', (e) => {
  if (e.message && e.message.includes('ResizeObserver')) {
    e.stopImmediatePropagation();
  }
});

createRoot(document.getElementById('root')!).render(<App />);

