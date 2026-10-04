import React from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import SWRegister from '../components/SWRegister';
import { ThemeWrapper } from '../components/ThemeWrapper';

const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&h=630&fit=crop&q=85';

export const viewport: Viewport = {
  themeColor: '#e11d48',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://anidub.in'),
  title: 'AniDub India — Tamil, Telugu & Hindi Dubbed Anime Directory',
  description: 'Discover which anime are dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada — and where to stream them legally on Crunchyroll, Netflix, and JioCinema.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html 
      lang="en" 
      className="dark" 
      suppressHydrationWarning
      data-anime-theme="default-red"
      style={{
        ['--primary-accent' as any]: '#e11d48',
        ['--primary-glow' as any]: 'rgba(225, 29, 72, 0.4)',
        ['--primary-gradient' as any]: 'linear-gradient(135deg, #e11d48, #be123c)',
        ['--primary-light' as any]: '#fda4af',
        ['--primary-badge' as any]: '#881337',
        ['--primary-border' as any]: 'rgba(225, 29, 72, 0.45)',
        ['--primary-ring' as any]: 'rgba(225, 29, 72, 0.6)',
        ['--primary-accent-rgb' as any]: '225, 29, 72',
      }}
    >
      <body className="bg-[#0b0f17] text-neutral-100 antialiased min-h-screen">
        <SWRegister />
        <ThemeWrapper>
          {children}
        </ThemeWrapper>
      </body>
    </html>
  );
}
