'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fileToDataUrl } from '@/lib/image';

/** 🔗 صفحة العميل الخاصة (portal.html القديمة): حسابه وفواتيره وطلب يكتبه ويبعت معاه صور وفيديو. من غير تسجيل دخول. */
interface Snap {
  shop: { name: string; phone: string };
  customer: string;
  bal: number;
  inv: { no: string; date: string; items: { n: string; q: number; u: string; t: number }[]; tot: number; paid: number; rem: number; recv: string; miss: string; got: string; gotDate: string }[];
  pays: { date: string; amount: number; note: string }[];
  rets: { date: string; n: string; q: number; t: number }[];
}
const M = (n: number) => `${(Math.round((+n || 0) * 100) / 100).toLocaleString('ar-EG')} ج.م`;
const card = { background: '#fff', border: '1px solid #e3e8ea', borderRadius: 16, padding: 14, marginBottom: 12 } as const;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api/v1/portal/public/${path}`, { ...init, headers: { 'content-type': 'application/json' } });
  const j = (await r.json().catch(() => ({}))) as { message?: string };
  if (!r.ok) throw new Error(j.message || (r.status === 404 ? 'الرابط ده مش شغال' : 'حصلت مشكلة، جرّب تاني'));
  return j as T;
}

const blobB64 = (f: Blob) =>
  new Promise<string>((ok, bad) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => bad(new Error('مقدرتش أقرا الملف'));
    r.readAsDataURL(f);
  });

export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const [s, setS] = useState<Snap | null>(null);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [media, setMedia] = useState<{ u: string; t: 'i' | 'v' }[]>([]);
  const [busy, setBusy] = useState('');
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    call<Snap>(token)
      .then(setS)
      .catch((e) => setErr(e.message));
  }, [token]);
  useEffect(load, [load]);

  const pick = async (fs: File[]) => {
    for (const f of fs) {
      try {
        setBusy(`⏳ جاري رفع ${f.type.startsWith('video') ? 'الفيديو' : 'الصورة'}…`);
        const isV = f.type.startsWith('video/');
        if (isV && f.size > 18 * 1024 * 1024) throw new Error('الفيديو كبير — ابعت فيديو أقصر');
        const data = isV ? await blobB64(f) : await fileToDataUrl(f, 1400);
        const r = await call<{ u: string; t: 'i' | 'v' }>(`${token}/media`, { method: 'POST', body: JSON.stringify({ data, ext: isV ? 'mp4' : 'jpg' }) });
        setMedia((m) => [...m, r]);
      } catch (e) {
        setErr((e as Error).message);
      }
    }
    setBusy('');
  };

  const send = async () => {
    if (!text.trim() && !media.length) return setErr('اكتب طلبك الأول');
    setBusy('⏳ جاري الإرسال…');
    setErr('');
    try {
      await call(`${token}/msg`, { method: 'POST', body: JSON.stringify({ body: text.trim(), media }) });
      setText('');
      setMedia([]);
      setSent(true);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy('');
  };

  if (!s && err) return <div dir="rtl" style={{ padding: 30, textAlign: 'center', fontSize: 18 }}>{err}</div>;
  if (!s) return <div dir="rtl" style={{ padding: 30, textAlign: 'center' }}>⏳ جاري التحميل…</div>;

  return (
    <div dir="rtl" style={{ maxWidth: 640, margin: '0 auto', padding: 14, background: '#f5f7f8', minHeight: '100vh', color: '#14262b' }}>
      <div style={{ background: 'linear-gradient(135deg,#087f8c,#0b4e57)', color: '#fff', borderRadius: 18, padding: 18, marginBottom: 12, borderBottom: '5px solid #c9971f' }}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>{s.shop.name}</div>
        <div style={{ opacity: 0.9, marginTop: 4 }}>أهلاً {s.customer} 👋</div>
      </div>

      <div style={card}>
        <small style={{ color: '#7b8a90' }}>حسابك عندنا</small>
        <div style={{ fontSize: 28, fontWeight: 800, color: s.bal > 0.004 ? '#c0392b' : '#159447' }}>
          {Math.abs(s.bal) < 0.005 ? 'حسابك مظبوط ✔' : s.bal > 0 ? `عليك ${M(s.bal)}` : `ليك عندنا ${M(-s.bal)}`}
        </div>
        {s.shop.phone ? (
          <a href={`tel:${s.shop.phone}`} style={{ color: '#087f8c', fontWeight: 700 }} dir="ltr">
            📞 {s.shop.phone}
          </a>
        ) : null}
      </div>

      <div style={card}>
        <b style={{ fontSize: 17 }}>✍️ اكتب طلبك</b>
        <p style={{ color: '#6b7c82', fontSize: 13, margin: '4px 0 8px' }}>اكتب الأصناف والكميات اللي محتاجها، وابعت صورة أو فيديو لأي صنف.</p>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="مثلاً: عايز ٢٠ مفصلة بلوم و ٥ مجرى ٤٥…" style={{ width: '100%', padding: 12, border: '1px solid #d6dfe2', borderRadius: 12, font: 'inherit' }} />
        {media.length > 0 && (
          <div style={{ margin: '6px 0', color: '#087f8c' }}>
            📎 مرفق: {media.filter((m) => m.t === 'i').length} صورة، {media.filter((m) => m.t === 'v').length} فيديو
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button type="button" onClick={() => file.current?.click()} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #d6dfe2', background: '#fff', font: 'inherit' }}>
            📷 صورة / فيديو
          </button>
          <button type="button" disabled={!!busy} onClick={send} style={{ padding: '10px 18px', borderRadius: 12, border: 0, background: '#087f8c', color: '#fff', fontWeight: 800, font: 'inherit' }}>
            إرسال الطلب
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => {
            const fs = [...(e.target.files ?? [])];
            e.target.value = '';
            if (fs.length) void pick(fs);
          }}
        />
        {busy && <div style={{ marginTop: 8, color: '#6b7c82' }}>{busy}</div>}
        {err && <div style={{ marginTop: 8, color: '#c0392b' }}>{err}</div>}
        {sent && <div style={{ marginTop: 8, color: '#159447', fontWeight: 700 }}>✔ وصل طلبك — هنكلمك قريب 🙏</div>}
      </div>

      <h3 style={{ margin: '16px 4px 8px' }}>🧾 فواتيرك ({s.inv.length})</h3>
      {s.inv.map((i) => (
        <div key={i.no} style={card}>
          <div onClick={() => setOpen(open === i.no ? null : i.no)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <b>{i.no}</b> <small style={{ color: '#7b8a90' }}>{i.date}</small>
              {i.miss && !i.got ? <span style={{ marginRight: 6, color: '#b9770e' }}>📦 فيه ناقص</span> : null}
            </div>
            <div>
              <b>{M(i.tot)}</b> {i.rem > 0.004 ? <span style={{ color: '#c0392b' }}>• باقي {M(i.rem)}</span> : <span style={{ color: '#159447' }}>• مدفوعة</span>}
            </div>
          </div>
          {open === i.no && (
            <div style={{ marginTop: 8, lineHeight: 1.9 }}>
              {i.items.map((x, k) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e3e8ea' }}>
                  <span>
                    {x.n} × {x.q} {x.u}
                  </span>
                  <b>{M(x.t)}</b>
                </div>
              ))}
              <div style={{ marginTop: 6 }}>
                المدفوع: <b>{M(i.paid)}</b>
              </div>
              {i.recv && <div>📅 تاريخ الاستلام: {i.recv}</div>}
              {i.miss && (
                <div style={{ background: '#fff4dc', borderRadius: 10, padding: 8, marginTop: 6, whiteSpace: 'pre-wrap' }}>
                  <b>الناقص يوم الاستلام:</b>
                  <br />
                  {i.miss}
                </div>
              )}
              {i.got && (
                <div style={{ background: '#e7f7ec', borderRadius: 10, padding: 8, marginTop: 6, whiteSpace: 'pre-wrap' }}>
                  <b>اتسلّم بعد كده{i.gotDate ? ` (${i.gotDate})` : ''}:</b>
                  <br />
                  {i.got}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {!s.inv.length && <div style={{ ...card, textAlign: 'center', color: '#7b8a90' }}>لسه مفيش فواتير</div>}

      {s.pays.length > 0 && (
        <>
          <h3 style={{ margin: '16px 4px 8px' }}>💵 دفعاتك</h3>
          <div style={card}>
            {s.pays.map((p, k) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: k ? '1px dashed #e3e8ea' : 0 }}>
                <span>
                  {p.date} {p.note ? `· ${p.note}` : ''}
                </span>
                <b style={{ color: '#159447' }}>{M(p.amount)}</b>
              </div>
            ))}
          </div>
        </>
      )}
      {s.rets.length > 0 && (
        <>
          <h3 style={{ margin: '16px 4px 8px' }}>↩️ مرتجعاتك</h3>
          <div style={card}>
            {s.rets.map((r, k) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: k ? '1px dashed #e3e8ea' : 0 }}>
                <span>
                  {r.date} · {r.n} × {r.q}
                </span>
                <b>{M(r.t)}</b>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
