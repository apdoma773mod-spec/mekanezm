'use client';
// «طلباتي»: orders sent from this phone, each with a one-tap «تابع طلبك».
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useShop, type SavedOrder } from './shop-provider';

export function OrdersList() {
  const { open } = useShop();
  const [L, setL] = useState<SavedOrder[] | null>(null);
  useEffect(() => { try { setL(JSON.parse(localStorage.getItem('mk_orders') || '[]')); } catch { setL([]); } }, []);
  if (!L) return null;
  if (!L.length) return (
    <div className="empty">
      <p>مفيش طلبات متسجلة على الموبايل ده لسه.</p>
      <button className="sec" onClick={() => open({ kind: 'track' })}>📦 تتبّع طلب برقم موبايلك</button>{' '}
      <Link className="btn-wa" href="/">تصفح المنتجات</Link>
    </div>
  );
  return (
    <div className="info-cards">
      {L.map(o => (
        <div key={o.ref}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{o.custom ? 'تجهيز' : 'طلب'} رقم <span dir="ltr">{o.ref}</span></b>
            <small className="mut" style={{ flex: 'none' }}>{new Date(o.at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
          </div>
          <div className="mut" style={{ fontSize: 13 }}>{o.lines.map(([n, q]) => `${n} × ${q}`).join('، ')}</div>
          <div className="mut" style={{ fontSize: 13 }}>{o.ship}</div>
          <button className="sec" style={{ marginTop: 8, width: '100%' }} onClick={() => open({ kind: 'track', ref: o.ref, phone: o.phone })}>📦 تابع الطلب ده</button>
        </div>
      ))}
    </div>
  );
}
