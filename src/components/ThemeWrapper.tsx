'use client';

import React from 'react';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

function ThemeContainer({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <div
      id="anidub-root"
      className="min-h-screen text-neutral-100 antialiased selection:bg-[var(--primary-accent)] selection:text-white"
      style={{
        ['--primary-accent' as string]: theme.primary,
        ['--primary-glow' as string]: theme.glow,
        ['--primary-gradient' as string]: theme.gradient,
        ['--primary-light' as string]: theme.light,
        ['--primary-badge' as string]: theme.badge,
        ['--primary-border' as string]: theme.border,
        ['--primary-ring' as string]: theme.ring,
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
