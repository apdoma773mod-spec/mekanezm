const SEC = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
];
module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  // الرئيسية بقت Next بالكامل (app/page.tsx). الأدمن لسه صفحة HTML — هيتحول بعدين
  async rewrites() { return { beforeFiles: [{ source: '/admin', destination: '/admin.html' }], afterFiles: [], fallback: [] }; },
  async headers() {
    return [
      { source: '/:path*', headers: SEC },
      { source: '/(index.html|smart.js|pro.js|gate.js|admin.html|sw.js)', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      { source: '/(icon-192.png|icon-512.png)', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] },
    ];
  },
};
