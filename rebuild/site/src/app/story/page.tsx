import './story.css';
import type { Metadata } from 'next';
import { getSite } from '@/lib/catalog';
import { StoryApp } from './story-app';

export const metadata: Metadata = {
  title: 'ميكانيزم — المنتجات بالتفصيل',
  description: 'اتفرج على منتجات ميكانيزم بالتفصيل: صور ومواصفات بالتمرير',
  robots: { index: false },
};

export default async function StoryPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const site = await getSite();
  const { name, phone, sections, products } = site;
  return <StoryApp site={{ name, phone, sections, products }} initial={(await searchParams).p ?? null} />;
}
