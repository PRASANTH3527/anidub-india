'use client';

import React from 'react';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

function ThemeContainer({ children }: { children: React.ReactNode }) {
  // Use static default values instead of dynamic theme from context
  return (
    <div
      id="anidub-root"
      className="min-h-screen text-neutral-100 antialiased selection:bg-[var(--primary-accent)] selection:text-white"
      suppressHydrationWarning
      style={{
        ['--primary-accent' as string]: '#e11d48',
        ['--primary-glow' as string]: 'rgba(225, 29, 72, 0.4)',
        ['--primary-gradient' as string]: 'linear-gradient(135deg, #e11d48, #be123c)',
        ['--primary-light' as string]: '#fda4af',
        ['--primary-badge' as string]: '#881337',
        ['--primary-border' as string]: 'rgba(225, 29, 72, 0.45)',
        ['--primary-ring' as string]: 'rgba(225, 29, 72, 0.6)',
      }}
    >
      {children}
    </div>
  );
}

export const ThemeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ThemeProvider>
      <ThemeContainer>{children}</ThemeContainer>
    </ThemeProvider>
  );
};
