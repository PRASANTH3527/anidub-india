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
  keywords: [
    'Tamil dubbed anime',
    'Telugu anime dubs',
    'Hindi dubbed anime online',
    'Malayalam anime dubs',
    'Kannada anime dubs',
    'Indian anime streaming directory',
    'Crunchyroll India dubs',
    'Netflix anime dubs India',
    'JioHotstar anime dubs',
    'JioCinema anime dubs',
  ],
  authors: [{ name: 'AniDub India Team', url: 'https://anidub.in' }],
  creator: 'AniDub India',
  publisher: 'AniDub India',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://anidub.in',
    siteName: 'AniDub India',
    title: 'AniDub India — Tamil, Telugu & Hindi Dubbed Anime Directory',
    description: 'Discover which anime are dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada — and where to stream them legally on Crunchyroll, Netflix, and JioCinema.',
    images: [
      {
        url: DEFAULT_BANNER,
        width: 1200,
        height: 630,
        alt: 'AniDub India — Indian Regional Dubbed Anime Directory',
        type: 'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AniDub India — Tamil, Telugu & Hindi Dubbed Anime Directory',
    description: 'Discover which anime are dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada — verified streaming links in India.',
    images: [DEFAULT_BANNER],
  },
  alternates: {
    canonical: 'https://anidub.in',
  },
  verification: {
    google: 'GC9I6JD43yIsgwDhpwT3a4SKpDeBExC-Typd_4JTOL8',
  },
};

const ROOT_SCHEMA_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'AniDub India',
  url: 'https://anidub.in',
  description: 'Discover which anime are dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada with verified Indian streaming platform links.',
  inLanguage: ['en', 'ta', 'te', 'hi', 'ml', 'kn'],
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://anidub.in/?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
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
      <head>
        <meta name="google-site-verification" content="GC9I6JD43yIsgwDhpwT3a4SKpDeBExC-Typd_4JTOL8" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ROOT_SCHEMA_JSONLD) }}
        />
      </head>
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
