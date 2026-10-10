import React from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import SWRegister from '../components/SWRegister';
import { UserPendingSync } from '../components/UserPendingSync';
import { ThemeWrapper } from '../components/ThemeWrapper';

const DEFAULT_BANNER = 'https://anidub.in/41533.png';

export const viewport: Viewport = {
  themeColor: '#9333ea',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://anidub.in'),
  title: 'Anidub India Official Website — Premier Anime Streaming & Dubbing in India',
  description: 'Welcome to the Anidub India Official Website, the premier destination for anime streaming and dubbing in India. Discover and stream anime dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada.',
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
    siteName: 'Anidub India',
    title: 'Anidub India Official Website — Premier Anime Streaming & Dubbing in India',
    description: 'Welcome to the Anidub India Official Website, the premier destination for anime streaming and dubbing in India. Discover and stream anime dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada.',
    images: [
      {
        url: 'https://anidub.in/41533.png',
        secureUrl: 'https://anidub.in/41533.png',
        width: 1000,
        height: 580,
        alt: 'Anidub India Official Website — Premier Anime Streaming & Dubbing in India',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anidub India Official Website — Premier Anime Streaming & Dubbing in India',
    description: 'Welcome to the Anidub India Official Website, the premier destination for anime streaming and dubbing in India.',
    images: ['https://anidub.in/41533.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
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
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://anidub.in/#organization',
      name: 'Anidub India',
      alternateName: ['AniDub India', 'AniDub', 'Anidub India Official Website'],
      url: 'https://anidub.in',
      logo: {
        '@type': 'ImageObject',
        '@id': 'https://anidub.in/#logo',
        url: 'https://anidub.in/41533.png',
        contentUrl: 'https://anidub.in/41533.png',
        caption: 'Anidub India Official Brand Logo',
        width: 1000,
        height: 580,
      },
      image: 'https://anidub.in/41533.png',
      description: 'Anidub India is the official premier destination for anime streaming and dubbing in India, documenting anime dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada.',
      sameAs: ['https://anidub.in'],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://anidub.in/#website',
      url: 'https://anidub.in',
      name: 'Anidub India Official Website',
      alternateName: 'Anidub India',
      publisher: {
        '@id': 'https://anidub.in/#organization',
      },
      description: 'Anidub India Official Website — The premier destination for anime streaming and dubbing in India.',
      inLanguage: ['en-IN', 'ta', 'te', 'hi', 'ml', 'kn'],
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://anidub.in/?q={search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
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

        {/* Open Graph (OG) Tags for Social Media Sharing Previews */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Anidub India" />
        <meta property="og:title" content="Anidub India Official Website — Premier Anime Streaming &amp; Dubbing in India" />
        <meta property="og:description" content="Welcome to the Anidub India Official Website, the premier destination for anime streaming and dubbing in India. Discover and stream anime dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada." />
        <meta property="og:url" content="https://anidub.in" />
        <meta property="og:locale" content="en_IN" />
        <meta property="og:image" content="https://anidub.in/41533.png" />
        <meta property="og:image:secure_url" content="https://anidub.in/41533.png" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1000" />
        <meta property="og:image:height" content="580" />
        <meta property="og:image:alt" content="Anidub India Official Website — Premier Anime Streaming &amp; Dubbing in India" />

        {/* Twitter Card Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Anidub India Official Website — Premier Anime Streaming &amp; Dubbing in India" />
        <meta name="twitter:description" content="Welcome to the Anidub India Official Website, the premier destination for anime streaming and dubbing in India." />
        <meta name="twitter:image" content="https://anidub.in/41533.png" />
        <meta name="twitter:image:alt" content="Anidub India Official Brand Logo" />

        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
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
