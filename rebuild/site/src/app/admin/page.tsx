import type { Metadata } from 'next';
import { AdminApp } from './admin-app';
import './admin.css';

export const metadata: Metadata = { title: 'إدارة الموقع | ميكانيزم', robots: { index: false, follow: false } };

export default function AdminPage() {
  return <main id="main" className="adm"><AdminApp /></main>;
}
