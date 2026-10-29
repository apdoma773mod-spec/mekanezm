'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FqTab, ReqTab } from '@/components/hy/field-tabs';
import { AccTab, IcTab, PtTab } from '@/components/hy/money-tabs';
import { CarTab, CtTab, IdTab, WaTab } from '@/components/hy/other-tabs';
import { Card } from '@/components/hy/ui';
import { CloseTab, VanTab } from '@/components/hy/van-tabs';
import { useIsAdmin } from '@/components/use-role';
import { money } from '@/lib/format';
import { useHyToday } from '@/lib/hy-queries';

type Tab = 'fq' | 'req' | 'van' | 'cls' | 'ic' | 'acc' | 'ct' | 'wa' | 'pt' | 'car' | 'id';
/** Same tabs, icons and order as the old «🏢 الشركات» screen; the money between the companies is the owner's. */
const TABS: [Tab, string, string, boolean?][] = [
  ['fq', '⚡', 'أوردر سريع'],
  ['req', '📦', 'مطلوب من الميدان'],
  ['van', '🚚', 'العربية'],
  ['cls', '🧾', 'التصفية'],
  ['ic', '🔁', 'التعامل', true],
  ['acc', '⚖️', 'حساب الشركتين', true],
  ['ct', '📑', 'العقود والعرابين'],
  ['wa', '📲', 'الواتساب'],
  ['pt', '🤝', 'الشركاء', true],
  ['car', '🚗', 'السيارة'],
  ['id', '🎨', 'الهوية'],
];

function TodayChips({ go }: { go: (t: Tab) => void }) {
  const admin = useIsAdmin();
  const t = useHyToday().data;
  if (!t) return null;
  const chips: [Tab, string, string][] = [['van', `💰 مبيعات النهارده ${money(t.salesToday)} (${t.salesCount})`, '#15803d']];
  if (t.openRequests) chips.push(['req', `📦 مطلوب لسه ${t.openRequests}`, '#d97706']);
  if (t.closePending) chips.push(['cls', '🧾 التصفية لسه ماتقفلتش', '#dc2626']);
  if (admin && Math.abs(t.net) > 0.5) chips.push(['acc', `⚖️ ${t.net > 0 ? 'على هيدرولك ' : 'على ميكانيزم '}${money(Math.abs(t.net))}`, '#087f8c']);
  if (t.lateContracts) chips.push(['ct', `📑 عقود متأخرة ${t.lateContracts}`, '#dc2626']);
  if (t.carAlerts) chips.push(['car', `🚗 ${t.carAlerts} تنبيه سيارة`, '#dc2626']);
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0 10px' }}>
      {chips.map(([k, txt, col]) => (
        <button key={k + txt} type="button" onClick={() => go(k)} style={{ flex: 'none', padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${col}`, background: 'var(--card,#fff)', fontWeight: 800, color: 'inherit', whiteSpace: 'nowrap' }}>
          {txt}
        </button>
      ))}
    </div>
  );
}

export default function HyPage() {
  const router = useRouter();
  const admin = useIsAdmin();
  const [tab, setTab] = useState<Tab>('fq');
  const reqCount = useHyToday().data?.openRequests ?? 0;
  const tabs = TABS.filter((t) => !t[3] || admin);
  const view = () => {
    if (!admin && tabs.every((t) => t[0] !== tab)) return <Card>للمدير بس.</Card>;
    switch (tab) {
      case 'fq':
        return <FqTab />;
      case 'req':
        return <ReqTab />;
      case 'van':
        return <VanTab />;
      case 'cls':
        return <CloseTab />;
      case 'ic':
        return <IcTab onAcc={() => setTab('acc')} />;
      case 'acc':
        return <AccTab onIc={() => setTab('ic')} />;
      case 'ct':
        return <CtTab />;
      case 'wa':
        return <WaTab />;
      case 'pt':
        return <PtTab />;
      case 'car':
        return <CarTab />;
      case 'id':
        return <IdTab />;
    }
  };
  return (
    <>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg,#f5f7f8)', padding: '12px 0 6px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={() => router.back()} style={{ flex: 'none', padding: '12px 16px', borderRadius: 12, background: 'var(--card,#fff)', border: '1.5px solid var(--border)', fontWeight: 700, color: 'inherit' }}>
            → رجوع
          </button>
          <h2 style={{ margin: 0, fontSize: 19 }}>🏢 الشركات: ميكانيزم وهيدرولك</h2>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 0 4px' }}>
          {tabs.map(([k, i, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              style={{ flex: 'none', padding: '11px 16px', borderRadius: 99, fontWeight: 800, whiteSpace: 'nowrap', border: `1.5px solid ${tab === k ? 'var(--blue)' : 'var(--border)'}`, background: tab === k ? 'var(--blue)' : 'var(--card,#fff)', color: tab === k ? '#fff' : 'inherit' }}
            >
              {i} {l}
              {k === 'req' && reqCount ? ` (${reqCount})` : ''}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '6px 0 100px', maxWidth: 760, margin: '0 auto' }}>
        {tab !== 'ct' && tab !== 'id' && <TodayChips go={setTab} />}
        {view()}
      </div>
    </>
  );
}
