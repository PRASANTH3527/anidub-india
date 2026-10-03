import React from 'react';
import '../index.css';
import SWRegister from '../components/SWRegister';

const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&h=630&fit=crop&q=85';

export const viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
};

export const metadata = {
  title: 'AniDub India — Tamil, Telugu & Hindi Dubbed Anime Directory',
  description: 'Discover which anime are dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada — and where to stream them legally on Crunchyroll, Netflix, and JioCinema.',
  manifest: '/manifest.json',
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
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#7c3aed" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AniDub India" />
        <link rel="apple-touch-icon" href="/icon.svg" />

        {/* Explicit Open Graph tags for WhatsApp / Telegram link crawlers */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="AniDub India" />
        <meta property="og:title" content="AniDub India — Tamil, Telugu & Hindi Dubbed Anime Directory" />
        <meta property="og:description" content="Discover which anime are dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada — and where to stream them legally on Crunchyroll, Netflix, and JioCinema." />
        <meta property="og:image" content={DEFAULT_BANNER} />
        <meta property="og:image:secure_url" content={DEFAULT_BANNER} />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="AniDub India — Regional Anime Dub Directory" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="AniDub India — Tamil, Telugu & Hindi Dubbed Anime Directory" />
        <meta name="twitter:description" content="Discover which anime are dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada — and where to stream them legally." />
        <meta name="twitter:image" content={DEFAULT_BANNER} />
      </head>
      <body className="bg-[#0b0f17] text-neutral-100 antialiased min-h-screen">
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
