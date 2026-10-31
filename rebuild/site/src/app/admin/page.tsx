import type { Metadata } from 'next';
import { AdminApp } from './admin-app';
import './admin.css';

// Own manifest so «Add to Home Screen» from here opens /admin, not the shop home page.
export const metadata: Metadata = {
  title: 'إدارة الموقع | ميكانيزم', robots: { index: false, follow: false }, manifest: '/admin.webmanifest',
  appleWebApp: { capable: true, title: 'إدارة ميكانيزم', statusBarStyle: 'default' },
};

export default function AdminPage() {
  return <main id="main" className="adm"><AdminApp /></main>;
}
