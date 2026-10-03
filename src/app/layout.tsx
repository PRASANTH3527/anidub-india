import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../index.css';
import SWRegister from '../components/SWRegister';

const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&h=630&fit=crop&q=85';

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://anidub.in'),
  title: 'AniDub India — Tamil, Telugu & Hindi Dubbed Anime Directory',
  description: 'Discover which anime are dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada — and where to stream them legally on Crunchyroll, Netflix, and JioCinema.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AniDub India',
  },
  openGraph: {
    title: 'AniDub India — Tamil, Telugu & Hindi Dubbed Anime Directory',
    description: 'Discover which anime are dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada — and where to stream them legally on Crunchyroll, Netflix, and JioCinema.',
    url: 'https://anidub.in',
    siteName: 'AniDub India',
    images: [
      {
        url: DEFAULT_BANNER,
        width: 1200,
        height: 630,
        alt: 'AniDub India — Regional Dubbed Anime Directory',
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AniDub India — Tamil, Telugu & Hindi Dubbed Anime Directory',
    description: 'Discover which anime are dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada — and where to stream them legally.',
    images: [DEFAULT_BANNER],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0b0f17] text-neutral-100 antialiased min-h-screen">
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
