import path from 'node:path';
import { fileURLToPath } from 'node:url';

const security = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server build (`.next/standalone`) for a real server / Docker.
  output: 'standalone',
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  images: {
    // Product photos are resized by Supabase's image CDN (see src/lib/image-loader.ts),
    // so pages stay fast without the Next image server.
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
  },
  async headers() {
    return [
      { source: '/:path*', headers: security },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] },
      { source: '/pw/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' }] },
      { source: '/:file(frame.webp|og.jpg|icon-192.png|icon-512.png)', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] },
    ];
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
      { source: '/products', destination: '/search', permanent: true },
    ];
  },
};

export default nextConfig;
