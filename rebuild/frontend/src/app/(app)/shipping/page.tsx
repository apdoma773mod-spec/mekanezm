'use client';

import { useEffect, useState } from 'react';
import { SHIP_FLOW, type ShipmentDto, type ShipStatus } from '@mk/shared';
import { useModal } from '@/components/modals/modal-host';
import { ShipCard } from '@/components/shipping-card';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useShipments, useUpdateShipment } from '@/lib/phase4-queries';

export default function ShippingPage() {
  const { open } = useModal();
  const toast = useToast();
  const [tab, setTab] = useState<'open' | 'collect' | 'done' | 'other'>('open');
  const [kind, setKind] = useState<'' | 'SHIP' | 'DELIVERY'>('');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 200);
    return () => clearTimeout(t);
  }, [text]);
  const list = useShipments({ tab, kind: kind || undefined, q: q || undefined });
  const S = list.data?.summary;

  return (
    <>
      <div className="title-row">
        <div className="title">
          <h1>🚚 الشحن والتوصيل</h1>
          <p>متابعة كل طلب من طباعة الملصق لحد ما نتحاسب</p>
        </div>
        <div className="btnrow">
          <button type="button" className="primary" onClick={() => open({ kind: 'shipEdit' })}>
            ＋ شحنة جديدة
          </button>
          <button type="button" className="secondary" onClick={() => list.refetch()}>
            🔄 تحديث
          </button>
        </div>
      </div>
      <div className="toolbar">
        {(
          [
            ['open', 'شغالة'],
            ['collect', 'مستنية التحصيل'],
            ['done', 'خلصت'],
            ['other', 'مرتجع / ملغي'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" className={tab === k ? 'primary' : 'secondary'} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <input className="search" placeholder="ابحث بالاسم، التليفون، رقم الشحنة أو البوليصة..." value={text} onChange={(e) => setText(e.target.value)} />
        <select className="search" style={{ maxWidth: 150 }} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="">شحن + توصيل</option>
          <option value="SHIP">📦 شحن بس</option>
          <option value="DELIVERY">🛵 توصيل بس</option>
        </select>
      </div>
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorBox message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <>
          {S && (
            <div className="shsum">
              <div>
                <small>شحنات شغالة</small>
                <b>{S.open}</b>
              </div>
              <div>
                <small>في الطريق (مع الشركة/المندوب)</small>
                <b>{S.moving}</b> <small>{money(S.movingCod)}</small>
              </div>
              <div>
                <small>استلمت ومستنية التحصيل</small>
                <b>{S.waiting}</b> <small>{money(S.waitingCod)}</small>
              </div>
            </div>
          )}
          {list.data.items.length ? (
            list.data.items.map((s) => <ShipCard key={s.id} s={s} />)
          ) : (
            <div className="card">
              <div className="empty">مفيش شحنات هنا</div>
            </div>
          )}
        </>
      )}
    </>
  );
}
