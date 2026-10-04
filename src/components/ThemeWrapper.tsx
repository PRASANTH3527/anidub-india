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
        ['--primary-accent' as string]: '#9333ea',
        ['--primary-glow' as string]: 'rgba(147, 51, 234, 0.5)',
        ['--primary-gradient' as string]: 'linear-gradient(135deg, #9333ea, #4f46e5)',
        ['--primary-light' as string]: '#c084fc',
        ['--primary-badge' as string]: '#581c87',
        ['--primary-border' as string]: 'rgba(147, 51, 234, 0.4)',
        ['--primary-ring' as string]: 'rgba(147, 51, 234, 0.6)',
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
