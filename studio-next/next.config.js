const SEC = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
];
module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  // كل الصفحات Next: الستوديو (app/page.tsx) والأدمن (app/admin). مفيش ولا صفحة HTML — اللينكات القديمة بتحوّل للجديدة
  async redirects() {
    return [
      { source: '/admin.html', destination: '/admin', permanent: true },
      { source: '/index.html', destination: '/', permanent: true },
    ];
  },
  async headers() {
    return [
      { source: '/:path*', headers: SEC },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      { source: '/(icon-192.png|icon-512.png)', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] },
    ];
  },
};
