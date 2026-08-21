import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Covers multipart overhead above the 5 MB avatar limit. JSON handlers
    // additionally enforce a streaming 16 KB application-level ceiling.
    proxyClientMaxBodySize: '6mb',
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    if (process.env.NODE_ENV !== 'production') return [];
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000',
          },
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
