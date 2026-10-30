import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // Product photos are resized by Supabase's image CDN (see src/lib/image-loader.ts),
    // so pages stay fast even without the Next image server.
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
  },
  async redirects() {
    // Old GitHub Pages URLs keep working (Google, WhatsApp shares, printed QR codes).
    return [
      { source: '/shop.html', has: [{ type: 'query', key: 'p', value: '(?<id>[A-Za-z0-9_-]+)' }], destination: '/p/:id', permanent: true },
      { source: '/shop.html', has: [{ type: 'query', key: 'track' }], destination: '/?track=:track', permanent: false },
      { source: '/shop.html', destination: '/', permanent: true },
      { source: '/shop3.html', destination: '/', permanent: true },
      { source: '/p/:id.html', destination: '/p/:id', permanent: true },
      { source: '/custom.html', destination: '/custom', permanent: true },
      { source: '/story.html', destination: '/story', permanent: true },
      { source: '/portal.html', destination: '/portal', permanent: true },
    ];
  },
};

export default nextConfig;
