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
    <html lang="en" className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('anidub_accent_theme');
                  var themes = {
                    'default-red': { primary: '#e11d48', glow: 'rgba(225, 29, 72, 0.4)', gradient: 'linear-gradient(135deg, #e11d48, #be123c)', light: '#fda4af', badge: '#881337', border: 'rgba(225, 29, 72, 0.45)', ring: 'rgba(225, 29, 72, 0.6)', rgb: '225, 29, 72' },
                    'zenitsu-yellow': { primary: '#eab308', glow: 'rgba(234, 179, 8, 0.45)', gradient: 'linear-gradient(135deg, #eab308, #d97706)', light: '#fef08a', badge: '#713f12', border: 'rgba(234, 179, 8, 0.45)', ring: 'rgba(234, 179, 8, 0.65)', rgb: '234, 179, 8' },
                    'naruto-orange': { primary: '#f97316', glow: 'rgba(249, 115, 22, 0.45)', gradient: 'linear-gradient(135deg, #f97316, #c2410c)', light: '#fed7aa', badge: '#7c2d12', border: 'rgba(249, 115, 22, 0.45)', ring: 'rgba(249, 115, 22, 0.65)', rgb: '249, 115, 22' },
                    'gojo-blue': { primary: '#06b6d4', glow: 'rgba(6, 182, 212, 0.45)', gradient: 'linear-gradient(135deg, #06b6d4, #0284c7)', light: '#a5f3fc', badge: '#164e63', border: 'rgba(6, 182, 212, 0.45)', ring: 'rgba(6, 182, 212, 0.65)', rgb: '6, 182, 212' },
                    'zoro-green': { primary: '#10b981', glow: 'rgba(16, 185, 129, 0.45)', gradient: 'linear-gradient(135deg, #10b981, #047857)', light: '#a7f3d0', badge: '#064e3b', border: 'rgba(16, 185, 129, 0.45)', ring: 'rgba(16, 185, 129, 0.65)', rgb: '16, 185, 129' },
                    'default-purple': { primary: '#9333ea', glow: 'rgba(147, 51, 234, 0.45)', gradient: 'linear-gradient(135deg, #9333ea, #6366f1)', light: '#d8b4fe', badge: '#581c87', border: 'rgba(147, 51, 234, 0.45)', ring: 'rgba(147, 51, 234, 0.65)', rgb: '147, 51, 234' }
                  };
                  var t = themes[saved] || themes['default-red'];
                  var root = document.documentElement;
                  root.style.setProperty('--primary-accent', t.primary);
                  root.style.setProperty('--primary-glow', t.glow);
                  root.style.setProperty('--primary-gradient', t.gradient);
                  root.style.setProperty('--primary-light', t.light);
                  root.style.setProperty('--primary-badge', t.badge);
                  root.style.setProperty('--primary-border', t.border);
                  root.style.setProperty('--primary-ring', t.ring);
                  root.style.setProperty('--primary-accent-rgb', t.rgb);
                  root.style.setProperty('--color-purple-600', t.primary);
                  root.style.setProperty('--color-purple-500', t.primary);
                  root.style.setProperty('--color-purple-400', t.light);
                  root.style.setProperty('--color-purple-300', t.light);
                  root.style.setProperty('--color-purple-700', t.badge);
                  root.style.setProperty('--color-purple-800', t.badge);
                  root.style.setProperty('--color-purple-900', t.badge);
                  root.setAttribute('data-anime-theme', saved || 'default-red');
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-[#0b0f17] text-neutral-100 antialiased min-h-screen">
        <SWRegister />
        <ThemeWrapper>
          {children}
        </ThemeWrapper>
      </body>
    </html>
  );
}
