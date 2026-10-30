import type { MetadataRoute } from 'next';

/** Makes «Add to Home Screen» install the system as an app (full screen, own icon). No service worker on purpose: a cached old version after an update is worse than a slow start. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ميكانيزم',
    short_name: 'ميكانيزم',
    description: 'سيستم إدارة محل ميكانيزم',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    dir: 'rtl',
    lang: 'ar',
    background_color: '#fff7e0',
    theme_color: '#087f8c',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
