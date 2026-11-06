import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './cairo.css';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/almarai/400.css';
import '@fontsource/almarai/700.css';
import '@fontsource/noto-kufi-arabic/400.css';
import '@fontsource/noto-kufi-arabic/700.css';
import '@fontsource/amiri/400.css';
import '@fontsource/amiri/700.css';
import '@fontsource/changa/400.css';
import '@fontsource/changa/700.css';
import './globals.css';
import './legacy.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'MEKANIZM | نظام المخزون',
  description: 'سيستم إدارة محل ميكانيزم',
  robots: { index: false, follow: false },
  appleWebApp: { title: 'ميكانيزم', statusBarStyle: 'default', capable: true },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#087f8c',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* ⚡ the last saved font and colours before anything is drawn (no flash of another font) */}
        <script dangerouslySetInnerHTML={{ __html: "try{var c=localStorage.getItem('mk_theme_css');if(c)document.documentElement.style.cssText=c}catch(e){}" }} />
        {/* الخط الأساسي بيتحمّل مع الصفحة نفسها */}
        <link rel="preload" href="/fonts/cairo-arabic-400-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/cairo-arabic-700-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/cairo-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
