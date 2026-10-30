import '@fontsource/cairo/arabic-400.css';
import '@fontsource/cairo/arabic-600.css';
import '@fontsource/cairo/arabic-800.css';
import '@fontsource/cairo/latin-400.css';
import '@fontsource/cairo/latin-800.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { FB_PIXEL, GA_ID, SITE_URL } from '@/lib/config';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'ميكانيزم | Mechanism',
  description: 'ميكانيزم | Mechanism: إكسسوارات الدريسينج روم والمطابخ وأبواب الخشب. مفصلات ومجر ومقابض وجرار. اطلب من الموقع أو على الواتساب.',
  applicationName: 'ميكانيزم',
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  appleWebApp: { capable: true, title: 'ميكانيزم' },
  openGraph: {
    type: 'website', locale: 'ar_EG', siteName: 'ميكانيزم | Mechanism',
    title: 'ميكانيزم | Mechanism', description: 'إكسسوارات الدريسينج روم والمطابخ وأبواب الخشب. اطلب الآن من الموقع أو على الواتساب.',
    images: [{ url: '/og.jpg', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0f1a14' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
        {/* Analytics load after the page is idle so they never slow the first paint. */}
        {GA_ID && <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="lazyOnload" />
          <Script id="ga" strategy="lazyOnload">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}');`}</Script>
        </>}
        {FB_PIXEL && <Script id="fb" strategy="lazyOnload">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${FB_PIXEL}');fbq('track','PageView');`}</Script>}
      </body>
    </html>
  );
}
