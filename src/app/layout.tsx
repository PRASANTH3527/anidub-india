import React from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import SWRegister from '../components/SWRegister';
import { UserPendingSync } from '../components/UserPendingSync';
import { ThemeWrapper } from '../components/ThemeWrapper';

const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&h=630&fit=crop&q=85';

export const viewport: Viewport = {
  themeColor: '#9333ea',
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
      data-anime-theme="default-purple"
      style={{
        ['--primary-accent' as any]: '#9333ea',
        ['--primary-glow' as any]: 'rgba(147, 51, 234, 0.5)',
        ['--primary-gradient' as any]: 'linear-gradient(135deg, #9333ea, #4f46e5)',
        ['--primary-light' as any]: '#c084fc',
        ['--primary-badge' as any]: '#581c87',
        ['--primary-border' as any]: 'rgba(147, 51, 234, 0.4)',
        ['--primary-ring' as any]: 'rgba(147, 51, 234, 0.6)',
        ['--primary-accent-rgb' as any]: '147, 51, 234',
      }}
    >
      <body className="bg-[#0b0f17] text-neutral-100 antialiased min-h-screen">
        <SWRegister />
        <UserPendingSync />
        <ThemeWrapper>
          {children}
        </ThemeWrapper>
      </body>
    </html>
  );
}
