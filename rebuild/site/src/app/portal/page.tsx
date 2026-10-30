import './portal.css';
import type { Metadata, Viewport } from 'next';
import { PortalApp } from './portal-app';

export const metadata: Metadata = { title: 'حسابك عند ميكانيزم', robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: '#0B1650' };

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  return <PortalApp token={(await searchParams).t ?? ''} />;
}
