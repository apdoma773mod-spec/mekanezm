'use client';
// «يوصلك إمتى؟»: expected date by delivery method, in Cairo time, skipping the shop's days off (shown after load).
import { useEffect, useState } from 'react';
import { ETA, OPENING } from '@/lib/config';

type M = 'pickup' | 'local' | 'gov';
const cairo = (d: Date) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', weekday: 'short', hour: 'numeric', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric' })
  .formatToParts(d).map(p => [p.type, p.value]));
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const off = (d: Date) => OPENING.closedDays.includes(DAYS.indexOf(cairo(d).weekday));
const fmt = (d: Date) => d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Cairo' });

/** Add n working days (skipping days off) starting from the first working day the order is handled. */
function addWork(start: Date, n: number) {
  const d = new Date(start);
  while (off(d)) d.setDate(d.getDate() + 1);
  for (let k = 0; k < n; k++) { d.setDate(d.getDate() + 1); while (off(d)) d.setDate(d.getDate() + 1); }
  return d;
}

export function DeliveryEta({ ok }: { ok: boolean }) {
  const [m, setM] = useState<M>('local');
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  if (!now) return null;
  const late = Number(cairo(now).hour) >= ETA.cutoff;
  const start = new Date(now); if (late || off(now)) start.setDate(start.getDate() + 1);
  const text = !ok ? 'المنتج بالحجز — بنقولك ميعاد وصوله لما نأكد الطلب.'
    : m === 'pickup' ? (off(now) || Number(cairo(now).hour) >= OPENING.close - 1 ? `جاهز تستلمه ${fmt(addWork(start, 0))}` : 'جاهز تستلمه النهارده من المحل')
      : (() => { const [a, b] = m === 'local' ? ETA.local : ETA.gov; return `يوصلك تقريباً بين ${fmt(addWork(start, a))} و${fmt(addWork(start, b))}`; })();
  return (
    <div className="pvbox eta">
      <h2>🚚 يوصلك إمتى؟</h2>
      {ok && <div className="chips" role="group" aria-label="طريقة الاستلام">
        {([['local', 'القاهرة والجيزة'], ['gov', 'محافظة تانية'], ['pickup', 'من المحل']] as [M, string][]).map(([k, t]) => (
          <button key={k} type="button" className={m === k ? 'on' : ''} onClick={() => setM(k)}>{t}</button>
        ))}
      </div>}
      <p><b>{text}</b>{ok && m !== 'pickup' && <small>لو طلبت {late ? 'دلوقتي' : `قبل الساعة ${ETA.cutoff > 12 ? ETA.cutoff - 12 : ETA.cutoff} ${ETA.cutoff >= 12 ? 'العصر' : 'الصبح'}`}، بنأكد معاك الميعاد بالظبط.</small>}</p>
    </div>
  );
}
