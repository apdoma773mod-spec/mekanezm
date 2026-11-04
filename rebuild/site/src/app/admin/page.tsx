import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminApp } from './admin-app';
import './admin.css';

// Own manifest so «Add to Home Screen» from here opens /admin, not the shop home page.
export const metadata: Metadata = {
  title: 'إدارة الموقع | ميكانيزم', robots: { index: false, follow: false }, manifest: '/admin.webmanifest',
  appleWebApp: { capable: true, title: 'إدارة ميكانيزم', statusBarStyle: 'default' },
};

// Once the catalog is read from the system (SITE_FROM_BACKEND=1), editing lives there; this panel would write to the unused Supabase copy.
export const dynamic = 'force-dynamic';

export default function AdminPage() {
  if (process.env.SITE_FROM_BACKEND === '1') redirect('https://mekanezm-admin.vercel.app/site');
  return <main id="main" className="adm"><AdminApp /></main>;
}
