import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Rewrites are fixed at build time, so Docker passes BACKEND_URL as a build argument.
const backend = process.env.BACKEND_URL ?? 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    // The browser only ever talks to this origin, so auth cookies stay first-party.
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
