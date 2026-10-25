'use client';

import { useEffect, useState } from 'react';
import { SHIP_FLOW, type ShipmentDto, type ShipStatus } from '@mk/shared';
import { useModal } from '@/components/modals/modal-host';
import { kindIc, stLabel, useShipActions } from '@/components/modals/shipment-modals';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useShipments, useUpdateShipment } from '@/lib/phase4-queries';

const STEP_SHORT: Record<string, string> = { new: 'جديدة', printed: 'الملصق', handed: 'الشركة', out: 'في الطريق', delivered: 'استلم', paid: 'اتحاسبنا' };
const fmtT = (t: string) => new Date(t).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' });
const nextOf = (s: ShipmentDto): ShipStatus | null => {
  const f = SHIP_FLOW[s.kind];
  const i = f.indexOf(s.status);
  return i > -1 && i < f.length - 1 ? f[i + 1]! : null;
};
const NEXT_BTN: Partial<Record<ShipStatus, string>> = { printed: '🖨️ اطبع الملصق', handed: '📦 سلّمتها لشركة الشحن', delivered: '✅ العميل استلم', paid: '💰 اتحاسبنا' };
const nextBtn = (s: ShipmentDto, n: ShipStatus) => (n === 'out' ? (s.kind === 'SHIP' ? '🚚 اتشحنت' : '🛵 خرجت مع المندوب') : NEXT_BTN[n]);

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
  const update = useUpdateShipment();
  const { label, notify } = useShipActions();
  const S = list.data?.summary;

  const step = async (s: ShipmentDto) => {
    const n = nextOf(s);
    if (!n) return;
    if (n === 'printed') return label(s);
    if (n === 'paid') return open({ kind: 'shipPaid', s });
    if ((n === 'handed' && s.kind === 'SHIP' && !s.carrier) || (n === 'out' && s.kind === 'DELIVERY' && !s.driver && !s.carrier)) return open({ kind: 'shipWho', s, next: n });
    try {
      const r = await update.mutateAsync({ id: s.id, input: { status: n } });
      toast(`✔ ${stLabel(n, s.kind)}`);
      if ((n === 'out' || n === 'handed') && r.phone && window.confirm('تبعت للعميل رسالة واتساب إن طلبه خرج؟')) notify(r);
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  return (
    <section id="shipping">
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
            list.data.items.map((s) => {
              const f = SHIP_FLOW[s.kind];
              const i = f.indexOf(s.status);
              const n = nextOf(s);
              const last = s.log[s.log.length - 1];
              return (
                <div key={s.id} className="card shc" style={{ marginBottom: 12 }}>
                  <div className="shh">
                    <div>
                      <b style={{ fontSize: 17 }}>{s.name}</b>{' '}
                      {s.phone && (
                        <>
                          —{' '}
                          <a href={`tel:${s.phone}`} dir="ltr">
                            {s.phone}
                          </a>
                        </>
                      )}
                      <div className="mut">
                        {s.no} • {fmtT(s.createdAt)}
                        {s.invoiceNo ? ` • فاتورة ${s.invoiceNo}` : ''}
                      </div>
                    </div>
                    <div>
                      <span className="badge">{kindIc(s.kind)}</span> <span className={`badge st-${s.status}`}>{stLabel(s.status, s.kind)}</span>
                    </div>
                  </div>
                  {(s.gov || s.area || s.address) && (
                    <div className="ln">
                      📍 {[s.gov, s.area].filter(Boolean).join(' — ')}
                      {s.address ? ` — ${s.address}` : ''}
                    </div>
                  )}
                  {(s.carrier || s.tracking) && (
                    <div className="ln">
                      🚚 {s.carrier}
                      {s.tracking && (
                        <>
                          {' — بوليصة '}
                          <b dir="ltr">{s.tracking}</b>
                        </>
                      )}
                    </div>
                  )}
                  {s.driver && (
                    <div className="ln">
                      🛵 {s.driver}
                      {s.driverPhone && (
                        <>
                          {' — '}
                          <a href={`tel:${s.driverPhone}`} dir="ltr">
                            {s.driverPhone}
                          </a>
                        </>
                      )}
                    </div>
                  )}
                  <div className="ln">
                    {s.cod > 0 ? (
                      <>
                        💰 المطلوب تحصيله: <b>{money(s.cod)}</b>
                      </>
                    ) : (
                      '✔ مدفوع — مفيش تحصيل'
                    )}
                    {s.fee > 0 && <span className="mut"> • مصاريف الشحن {money(s.fee)}</span>}
                    {s.pieces > 1 && <span className="mut"> • {s.pieces} طرود</span>}
                  </div>
                  {i > -1 && (
                    <>
                      <div className="steps">
                        {f.map((x, k) => (
                          <span key={x} className={k <= i ? 'on' : ''} />
                        ))}
                      </div>
                      <div className="stepl">
                        {f.map((x, k) => (
                          <span key={x} className={k <= i ? 'on' : ''}>
                            {STEP_SHORT[x]}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {last && (
                    <div className="mut" style={{ marginTop: 4 }}>
                      آخر تحديث: {stLabel(last.s, s.kind)}
                      {last.by ? ` — ${last.by}` : ''} • {fmtT(last.at)}
                    </div>
                  )}
                  <div className="btnrow" style={{ marginTop: 10 }}>
                    {n && (
                      <button type="button" className="primary" disabled={update.isPending} onClick={() => step(s)}>
                        {nextBtn(s, n)}
                      </button>
                    )}
                    <button type="button" className="secondary" onClick={() => label(s)}>
                      🖨️ الملصق
                    </button>
                    {s.phone && (
                      <button type="button" className="secondary" onClick={() => notify(s)}>
                        💬 بلّغ العميل
                      </button>
                    )}
                    <button type="button" className="secondary" onClick={() => open({ kind: 'shipEdit', id: s.id })}>
                      ✏️ تعديل
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="card">
              <div className="empty">مفيش شحنات هنا</div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
