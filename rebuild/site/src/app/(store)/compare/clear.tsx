'use client';
import { useRouter } from 'next/navigation';
import { writeCompare } from '@/components/extras';

export function ClearCompare() {
  const router = useRouter();
  return <button type="button" className="sec" style={{ marginTop: 12 }} onClick={() => { writeCompare([]); router.push('/'); }}>🧹 امسح المقارنة</button>;
}
