import React from 'react';
import '../src/index.css';

export const metadata = {
  title: 'AniDub India - Regional Dubbed Anime Directory',
  description: 'Discover anime dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0b0f17] text-neutral-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
