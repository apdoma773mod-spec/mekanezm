import type { Metadata } from 'next';
import AdminApp from '@/components/AdminApp';

export const metadata: Metadata = { title: 'إدارة استوديو ميكانيزم', robots: { index: false, follow: false }, manifest: '/admin.webmanifest', icons: { icon: '/admin-192.png', apple: '/admin-touch.png' } };

export default function AdminPage() { return <AdminApp />; }
