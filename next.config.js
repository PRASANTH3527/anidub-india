/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
