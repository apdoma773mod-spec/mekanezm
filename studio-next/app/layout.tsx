import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = { title: 'استوديو ميكانيزم', manifest: '/manifest.webmanifest', icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' } };
export const viewport: Viewport = { themeColor: '#0B0B0C', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
