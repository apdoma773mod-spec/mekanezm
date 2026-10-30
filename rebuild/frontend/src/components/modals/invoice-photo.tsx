'use client';

import { useRef, useState } from 'react';
import type { ProductDto } from '@mk/shared';
import { api, errorMessage } from '@/lib/api';
import { vn } from '@/lib/import-daily';

/** What the old parse-invoice returns for a supplier invoice photo. */
export interface ReadInvoice {
  supplier?: string;
  invoice_no?: string;
  date?: string;
  items: { text?: string; code?: string; qty?: number; unit?: string; price?: number; total?: number }[];
  notes?: string;
  _check?: { n: number; rows: number; sum: number; grand_total: number; ok: boolean };
}

/** Shrinks the photo to ≤1800 px JPEG (like the old: a phone photo is too big to send as is). */
async function toJpeg(f: File): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error('الملف مش صورة'));
      i.src = url;
    });
    const k = Math.min(1, 1800 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1]!;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Best stock match for a line read from the photo: same code, else most shared words. */
export function matchProduct(text: string, code: string | undefined, all: ProductDto[]): ProductDto | undefined {
  if (code) {
    const c = all.find((p) => p.code === code.toUpperCase() || p.barcode === code);
    if (c) return c;
  }
  const w = vn(text).split(' ').filter((x) => x.length > 1);
  if (!w.length) return undefined;
  let best: { p: ProductDto; s: number } | undefined;
  for (const p of all) {
    const n = vn(p.name);
    const s = w.filter((x) => n.includes(x)).length / Math.max(w.length, n.split(' ').length);
    if (s > (best?.s ?? 0)) best = { p, s };
  }
  return best && best.s >= 0.6 ? best.p : undefined;
}

/** «📷 صوّر الفاتورة / 🖼️ من الصور / 📄 من الملفات» in the purchase window (the old ivBtn). */
export function InvoicePhotoButtons({ onRead }: { onRead: (r: ReadInvoice) => void | Promise<void> }) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setMsg('⏳ جاري قراءة الفاتورة… ممكن تاخد دقيقة');
    try {
      const image = await toJpeg(f);
      const r = await api.post<ReadInvoice>('/ai/read-image', { image, media_type: 'image/jpeg' });
      if (!r.items?.length) throw new Error('مالقيتش أصناف في الصورة');
      await onRead(r);
      const c = r._check;
      setMsg(`✔ اتقرا ${r.items.length} صنف${c && !c.ok ? ' — ⚠️ راجع: ممكن يكون فيه بنود ناقصة أو الإجمالي مش مطابق' : ''}${r.notes ? ` — ${r.notes}` : ''}`);
    } catch (e) {
      setMsg(`⚠️ ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="field full" id="ivBtn">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="primary" style={{ flex: 1, minWidth: 120 }} disabled={busy} onClick={() => cam.current?.click()}>
          📷 صوّر الفاتورة
        </button>
        <button type="button" className="secondary" style={{ flex: 1, minWidth: 100 }} disabled={busy} onClick={() => gal.current?.click()}>
          🖼️ من الصور
        </button>
        <button type="button" className="secondary" style={{ flex: 1, minWidth: 100 }} disabled={busy} onClick={() => gal.current?.click()}>
          📄 من الملفات
        </button>
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void go(e.target.files?.[0])} />
      <input ref={gal} type="file" accept="image/*" hidden onChange={(e) => void go(e.target.files?.[0])} />
      <small style={{ color: 'var(--muted)' }}>{msg || 'صورة فاتورة المورد — بتتقري وتنزل أصنافها هنا، راجعها قبل الحفظ'}</small>
    </div>
  );
}
