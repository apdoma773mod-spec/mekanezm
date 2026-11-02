import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/site-parts';
import { getSettings } from '@/lib/catalog';
import { SKILLS, matchPros } from '@/lib/pros';
import { ProCard, ProNote } from './pro-card';

export const revalidate = 60;
export const metadata: Metadata = {
  title: 'نجارين وفنيين نرشّحهم لتركيب وصيانة المطابخ والدواليب | ميكانيزم',
  description: 'نجارين ومهندسين مستقلين راجعنا شغلهم، شوف أعمالهم وكلّمهم على طول. ميكانيزم بتبيع الإكسسوارات ومبتركّبش.',
  alternates: { canonical: '/pros' },
};

export default async function Pros({ searchParams }: { searchParams: Promise<{ s?: string; a?: string }> }) {
  const { s, a } = await searchParams;
  const site = await getSettings();
  const list = matchPros(site.pros, s, a); // people from the typed area come first
  return (
    <>
      <main id="main" className="page narrow">
        <nav className="bc" aria-label="مكانك في الموقع"><Link href="/">الرئيسية</Link><span>›</span><span>فنيين نرشّحهم</span></nav>
        <h1 className="page-h">🧰 فنيين نرشّحهم</h1>
        <ProNote />
        <div className="info-cards" style={{ marginBottom: 12 }}>
          <div>
            <h2>محتاج حد دلوقتي؟</h2>
            احكيلنا محتاج إيه وفين، وهنرشّحلك الأنسب.
            <div style={{ marginTop: 8 }}><Link className="pri" href="/help" style={{ display: 'block', textAlign: 'center', padding: '12px', color: '#fff' }}>🙋 احكيلنا محتاج إيه</Link></div>
          </div>
        </div>
        <div className="chips" style={{ margin: '0 0 10px' }} role="group" aria-label="التخصص">
          <Link href="/pros" className={!s ? 'on' : ''} replace>الكل</Link>
          {SKILLS.map(([k, n]) => <Link key={k} href={`/pros?s=${k}`} className={s === k ? 'on' : ''} replace>{n}</Link>)}
        </div>
        <form action="/pros" className="pro-area">
          {s && <input type="hidden" name="s" value={s} />}
          <input name="a" defaultValue={a ?? ''} placeholder="منطقتك (مثلاً: فيصل، مدينة نصر)" maxLength={40} aria-label="منطقتك" />
          <button type="submit">🔎</button>
        </form>
        {!list.length ? (
          <div className="info-cards"><div>
            {site.pros.length ? <>مفيش حد مسجّل للتخصص ده{a ? ' في منطقتك' : ''} لسه. <Link href="/help">ابعتلنا طلبك</Link> وهنحاول نوصّلك لحد.</> : <>لسه بنجهّز القايمة. لو محتاج حد دلوقتي <Link href="/help">ابعتلنا طلبك</Link> وهنرد عليك.</>}
          </div></div>
        ) : <div className="pros">{list.map(p => <ProCard key={p.id} p={p} />)}</div>}
        <div className="info-cards" style={{ marginTop: 14 }}>
          <div>
            <h2>🔨 انت نجار أو مهندس؟</h2>
            ضيف نفسك في القايمة وزباين ميكانيزم هيوصلولك. بس بشروط وبعد مراجعة.
            <div><Link href="/pros/join">اعرف الشروط وقدّم ←</Link></div>
          </div>
        </div>
      </main>
      <Footer site={site} />
    </>
  );
}
