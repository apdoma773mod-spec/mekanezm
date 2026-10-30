import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Rewrites are fixed at build time, so Docker passes BACKEND_URL as a build argument.
// 127.0.0.1, not "localhost": on Windows "localhost" tries IPv6 first and every new proxied
// connection waited up to ~2 s before falling back to the IPv4-only backend.
const backend = process.env.BACKEND_URL ?? 'http://127.0.0.1:4000';

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
