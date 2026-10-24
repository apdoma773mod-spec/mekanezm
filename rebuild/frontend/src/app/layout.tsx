import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/700.css';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'ميكانيزم',
  description: 'سيستم إدارة محل ميكانيزم',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
