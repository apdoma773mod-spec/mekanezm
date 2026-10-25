import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/700.css';
import '@fontsource/cairo/800.css';
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
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'MEKANIZM | نظام المخزون',
  description: 'سيستم إدارة محل ميكانيزم',
  robots: { index: false, follow: false },
  appleWebApp: { title: 'ميكانيزم', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#087f8c',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
