/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    '*.run.app',
    'ais-dev-6p7rzfmrynewixau5fp7yy-712933804987.asia-southeast1.run.app',
    'localhost:3000',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'cdn.myanimelist.net' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  // Since the original app used hashes, we might want to support them, 
  // but standard routes are better for SEO and middleware tracking.
  async redirects() {
    return [
      // Example of a redirect if you move away from hashes
      // { source: '/#anime/:id', destination: '/anime/:id', permanent: false },
    ];
  },
};

export default nextConfig;
