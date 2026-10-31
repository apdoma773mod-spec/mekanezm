'use client';
// The owner's own listings. The phone keeps (id, secret) pairs from when he added them (no account needed).
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { scrapDone, scrapMine, scrapRenew } from '@/lib/api';
import { ago, sizeText, titleOf, type Scrap } from '@/lib/scraps';
import { SCRAP_KEY } from '../add/add-form';

type Mine = Scrap & { status: string; expires_at: string };
const STATUS: Record<string, string> = { active: 'ظاهرة', sold: 'اتباعت', removed: 'اتشالت', hidden: 'مخفية (بلاغات)' };

export function Mine() {
  const [list, setList] = useState<Mine[] | null>(null);
  const [msg, setMsg] = useState('');
  const pairs = () => { try { return JSON.parse(localStorage.getItem(SCRAP_KEY) || '[]') as { id: string; secret: string }[]; } catch { return []; } };
  async function load() {
    const p = pairs();
    if (!p.length) return setList([]);
    const r = await scrapMine(p);
    setList(r.ok && Array.isArray(r.data) ? (r.data as unknown as Mine[]) : []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const secret = (id: string) => pairs().find(x => x.id === id)?.secret ?? '';
  async function act(id: string, kind: 'sold' | 'removed' | 'renew') {
    setMsg('⏳…');
    const r = kind === 'renew' ? await scrapRenew(id, secret(id)) : await scrapDone(id, secret(id), kind);
    setMsg(r.ok ? '✔ تمام' : 'ماحصلش — جرّب تاني');
    load();
  }
  if (!list) return <p className="mut">⏳ بنحمّل…</p>;
  if (!list.length) return <div className="info-cards"><div>مفيش فضلة مسجّلة على الموبايل ده. <Link href="/scraps/add">ضيف فضلتك</Link>. (الفضلة بتظهر هنا بس على نفس الموبايل اللي ضفتها منه.)</div></div>;
  return (
    <>
      <div className="scraps">{list.map(s => (
        <article key={s.id} className="scrap">
          <div className="sc-t"><b>{titleOf(s)}</b><span className="sc-size">{sizeText(s)}</span><small>{STATUS[s.status] ?? s.status} · {ago(s.created_at)}</small></div>
          {s.status === 'active' && (
            <div className="sc-act">
              <button type="button" className="pri" onClick={() => act(s.id, 'sold')}>✔ اتباعت</button>
              <button type="button" className="sec" onClick={() => act(s.id, 'renew')}>🔄 لسه موجودة (30 يوم)</button>
              <button type="button" className="lnk" onClick={() => window.confirm('تشيل الإعلان؟') && act(s.id, 'removed')}>🗑️ شيل</button>
            </div>
          )}
        </article>
      ))}</div>
      <p className="mut" aria-live="polite">{msg}</p>
    </>
  );
}
