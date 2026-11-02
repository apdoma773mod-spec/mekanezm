'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';

/**
 * 📐 «صورة المقاسات»: the product photo on a clean background with dimension arrows and sizes, like the suppliers' pictures.
 *  - من المقاسات: type width / height / depth, the arrows go around the photo.
 *  - علّم على الصورة: for a photo taken with a tape measure in it — tap the two ends of a length, type its size, repeat.
 * The result is one JPEG uploaded like any site photo and put second in the product's photos.
 */
const S = 1200; // the finished picture is S × S
const BOX = 700; // the photo is fitted into BOX × BOX in the middle
const INK = '#b85f1c';
const FONT = '700 38px Cairo, Tahoma, Arial, sans-serif';

type Pt = { x: number; y: number };
interface Mark {
  a: Pt;
  b: Pt;
  label: string;
}

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((ok, bad) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => ok(i);
    i.onerror = () => bad(new Error('مقدرتش أفتح الصورة'));
    i.src = src;
  });

/** Arrow line with end ticks and a label in a white pill, drawn at the given spot. */
function dim(c: CanvasRenderingContext2D, a: Pt, b: Pt, label: string, side = 1) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy * side;
  const ny = ux * side;
  c.save();
  c.strokeStyle = INK;
  c.fillStyle = INK;
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
  const head = (p: Pt, d: number) => {
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineTo(p.x + d * (ux * 22) + nx * 8, p.y + d * (uy * 22) + ny * 8);
    c.lineTo(p.x + d * (ux * 22) - nx * 8, p.y + d * (uy * 22) - ny * 8);
    c.closePath();
    c.fill();
  };
  head(a, 1);
  head(b, -1);
  for (const p of [a, b]) {
    c.beginPath();
    c.moveTo(p.x + nx * 14, p.y + ny * 14);
    c.lineTo(p.x - nx * 14, p.y - ny * 14);
    c.stroke();
  }
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  c.font = FONT;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const w = c.measureText(label).width + 28;
  c.fillStyle = '#fffffff0';
  c.beginPath();
  c.roundRect(mx - w / 2, my - 28, w, 56, 14);
  c.fill();
  c.fillStyle = INK;
  c.fillText(label, mx, my + 2);
  c.restore();
}

async function render(src: string, opts: { w: string; h: string; d: string; marks: Mark[]; mode: 'auto' | 'hand'; brand: string }): Promise<HTMLCanvasElement> {
  const img = await loadImg(src);
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#f4f1ec');
  g.addColorStop(1, '#e9e4dc');
  c.fillStyle = g;
  c.fillRect(0, 0, S, S);
  // a soft floor under the product
  const fl = c.createRadialGradient(S / 2, 960, 40, S / 2, 960, 460);
  fl.addColorStop(0, '#00000022');
  fl.addColorStop(1, '#00000000');
  c.fillStyle = fl;
  c.fillRect(0, 700, S, 400);
  // the photo (white backgrounds melt into the page with «multiply»)
  const k = Math.min(BOX / img.width, BOX / img.height);
  const pw = img.width * k;
  const ph = img.height * k;
  const px = (S - pw) / 2;
  const py = 290 + (BOX - ph) / 2 - 20;
  c.globalCompositeOperation = 'multiply';
  c.drawImage(img, px, py, pw, ph);
  c.globalCompositeOperation = 'source-over';
  if (opts.mode === 'auto') {
    if (opts.w.trim()) dim(c, { x: px, y: py - 40 }, { x: px + pw, y: py - 40 }, `${opts.w.trim()} سم`, 1);
    if (opts.h.trim()) dim(c, { x: px + pw + 50, y: py }, { x: px + pw + 50, y: py + ph }, `${opts.h.trim()} سم`, 1);
    if (opts.d.trim()) {
      // depth can't be drawn on a flat photo: a clear tag under it instead
      const t = `العمق ${opts.d.trim()} سم`;
      c.font = FONT;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const w = c.measureText(t).width + 40;
      const y = py + ph + 70;
      c.fillStyle = '#fffffff0';
      c.beginPath();
      c.roundRect(S / 2 - w / 2, y - 30, w, 60, 16);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = INK;
      c.fillText(t, S / 2, y + 2);
    }
  } else {
    // marks are stored in photo coordinates (0..1) and mapped here
    for (const m of opts.marks) {
      const m2 = (p: Pt): Pt => ({ x: px + p.x * pw, y: py + p.y * ph });
      dim(c, m2(m.a), m2(m.b), m.label, 1);
    }
  }
  c.fillStyle = '#6b5a45';
  c.font = '700 30px Cairo, Tahoma, Arial, sans-serif';
  c.textAlign = 'center';
  c.fillText(opts.brand, S / 2, S - 50);
  return cv;
}

export function DimImageMaker({ images, specs, onAdd, onClose, brand = 'ميكانيزم — MEKANIZM' }: { images: string[]; specs: [string, string][]; onAdd: (url: string) => void; onClose: () => void; brand?: string }) {
  const toast = useToast();
  const [src, setSrc] = useState(images[0] ?? '');
  const [mode, setMode] = useState<'auto' | 'hand'>('auto');
  const guess = useMemo(() => {
    const num = (re: RegExp) => (specs.find(([k]) => re.test(k))?.[1] ?? '').match(/[\d.,٠-٩]+/)?.[0] ?? '';
    return { w: num(/عرض|طول|width|length/i), h: num(/ارتفاع|height/i), d: num(/عمق|سمك|depth/i) };
  }, [specs]);
  const [w, setW] = useState(guess.w);
  const [h, setH] = useState(guess.h);
  const [d, setD] = useState(guess.d);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [pend, setPend] = useState<Pt | null>(null);
  const [busy, setBusy] = useState(false);
  const view = useRef<HTMLCanvasElement>(null);
  const geo = useRef({ px: 0, py: 0, pw: 1, ph: 1 });

  useEffect(() => {
    if (!src) return;
    let dead = false;
    void render(src, { w, h, d, marks, mode, brand })
      .then((cv) => {
        if (dead || !view.current) return;
        const o = view.current;
        o.width = 600;
        o.height = 600;
        o.getContext('2d')!.drawImage(cv, 0, 0, 600, 600);
      })
      .catch((e) => toast(errorMessage(e), 'bad'));
    return () => {
      dead = true;
    };
  }, [src, w, h, d, marks, mode, brand, toast]);

  // the photo's place inside the picture, to turn a tap into a spot on the photo
  useEffect(() => {
    if (!src) return;
    void loadImg(src).then((img) => {
      const k = Math.min(BOX / img.width, BOX / img.height);
      const pw = img.width * k;
      const ph = img.height * k;
      geo.current = { px: (S - pw) / 2, py: 290 + (BOX - ph) / 2 - 20, pw, ph };
    });
  }, [src]);

  const tap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'hand') return;
    const r = e.currentTarget.getBoundingClientRect();
    const X = ((e.clientX - r.left) / r.width) * S;
    const Y = ((e.clientY - r.top) / r.height) * S;
    const { px, py, pw, ph } = geo.current;
    const p = { x: Math.min(1, Math.max(0, (X - px) / pw)), y: Math.min(1, Math.max(0, (Y - py) / ph)) };
    if (!pend) return setPend(p);
    const label = window.prompt('المسافة دي كام سم؟ (اكتب الرقم)');
    setPend(null);
    if (!label || !label.trim()) return;
    setMarks((m) => [...m, { a: pend, b: p, label: `${label.trim()} سم` }]);
  };

  const save = async () => {
    if (!src) return;
    if (mode === 'auto' && !(w.trim() || h.trim() || d.trim())) return toast('اكتب مقاس واحد على الأقل', 'bad');
    if (mode === 'hand' && !marks.length) return toast('علّم مسافة واحدة على الأقل على الصورة', 'bad');
    setBusy(true);
    try {
      const cv = await render(src, { w, h, d, marks, mode, brand });
      const data = cv.toDataURL('image/jpeg', 0.9);
      const url = (await api.post<{ url: string }>('/work/files', { data, ext: 'jpg' })).url;
      onAdd(url);
      toast('✔ صورة المقاسات اتضافت (التانية في الصور)');
      onClose();
    } catch (e) {
      toast(errorMessage(e), 'bad');
      setBusy(false);
    }
  };

  const field = (label: string, v: string, set: (x: string) => void) => (
    <label style={{ flex: '1 1 90px' }}>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label} (سم)</span>
      <input value={v} onChange={(e) => set(e.target.value)} inputMode="decimal" style={{ width: '100%' }} />
    </label>
  );

  return (
    <Modal title="📐 صورة المقاسات" onClose={onClose} wide>
      {!images.length ? (
        <p>ضيف صورة للمنتج الأول، وبعدين اعمل صورة المقاسات منها.</p>
      ) : (
        <>
          <p style={{ margin: '0 0 8px', color: 'var(--muted)', fontSize: 13 }}>الصورة بتتحط على خلفية نضيفة وعليها أسهم المقاسات، زي صور الموردين. بتتضاف كتاني صورة للمنتج.</p>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
            {images.map((u) => (
              <button key={u} type="button" onClick={() => setSrc(u)} style={{ border: u === src ? '3px solid #087f8c' : '2px solid var(--border)', borderRadius: 10, padding: 0, background: '#fff', flex: 'none' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
            <button type="button" className={mode === 'auto' ? 'primary' : 'secondary'} onClick={() => setMode('auto')}>
              من المقاسات
            </button>
            <button type="button" className={mode === 'hand' ? 'primary' : 'secondary'} onClick={() => setMode('hand')}>
              علّم على الصورة (فيها متر)
            </button>
          </div>
          {mode === 'auto' ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {field('العرض', w, setW)}
              {field('الارتفاع', h, setH)}
              {field('العمق', d, setD)}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13 }}>
              {pend ? '📍 دوس على الطرف التاني للمسافة' : '📍 دوس على بداية المسافة اللي عايز تقيسها على الصورة، وبعدين على نهايتها، واكتب قيمتها.'}
              {marks.length > 0 && (
                <button type="button" className="secondary" style={{ marginInlineStart: 8 }} onClick={() => setMarks((m) => m.slice(0, -1))}>
                  ↩️ شيل آخر مسافة
                </button>
              )}
            </p>
          )}
          <canvas ref={view} onClick={tap} style={{ width: '100%', maxWidth: 520, aspectRatio: '1', borderRadius: 12, border: '1px solid var(--border)', marginTop: 8, cursor: mode === 'hand' ? 'crosshair' : 'default', display: 'block', marginInline: 'auto' }} />
          <div className="modal-foot">
            <button type="button" className="primary" disabled={busy} onClick={() => void save()}>
              {busy ? '⏳ بحفظ…' : '✔ ضيفها لصور المنتج'}
            </button>
            <button type="button" className="secondary" onClick={onClose}>
              إلغاء
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
