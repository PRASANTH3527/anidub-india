import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://anidub.in';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
