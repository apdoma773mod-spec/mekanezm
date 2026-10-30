'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProductDto } from '@mk/shared';
import { api, errorMessage } from '@/lib/api';
import { vn } from '@/lib/import-daily';
import { useToast } from '../ui/toast';
import { useModal } from './modal-host';

/** What the old parse-invoice returns for a supplier invoice photo. */
export interface ReadInvoice {
  supplier?: string;
  invoice_no?: string;
  date?: string;
  items: { text?: string; code?: string; qty?: number; unit?: string; price?: number; total?: number }[];
  notes?: string;
  pno?: string;
  _check?: { n?: number; rows?: number; sum?: number; grand_total?: number; discount?: number; ok?: boolean; strips?: number; pages?: number };
}

/** One row of «📥 فواتير للمراجعة» (server queue `/ai/scans`). */
export interface Scan {
  id: string;
  status: 'pending' | 'working' | 'done' | 'failed' | 'used';
  attempts: number;
  nextAt: string;
  supplier: string;
  createdBy: string;
  createdAt: string;
  pages: number;
  result: ReadInvoice | null;
  error: string;
}

/* ---------- preparing the pages on the phone (the old ivShrink / pdfPages / cut) ---------- */
const loadJs = (src: string, ready: () => boolean) =>
  new Promise<void>((ok, bad) => {
    if (ready()) return ok();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => (ready() ? ok() : bad(new Error('مكتبة مااتحملتش — اتأكد من النت')));
    s.onerror = () => bad(new Error('مكتبة مااتحملتش — اتأكد من النت'));
    document.head.appendChild(s);
  });

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((ok, bad) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => bad(new Error('الصورة مش بتتفتح'));
    i.src = src;
  });

/** Part of an image (or all of it) as a JPEG of at most `max` px on its long side. */
function cut(im: HTMLImageElement | HTMLCanvasElement, max: number, y = 0, h = im.height): string {
  const w = im.width;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(im, 0, y, w, h, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.88).split(',')[1]!;
}

/** Full page for the first read + overlapping strips (12%) for the finer read when the first looks incomplete. */
function pageOf(im: HTMLImageElement | HTMLCanvasElement) {
  const W = im.width;
  const H = im.height;
  const n = Math.max(2, Math.min(4, Math.round(H / (W * 0.8))));
  const step = H / n;
  const ov = Math.round(step * 0.12);
  const strips = [...Array(n)].map((_, i) => {
    const y = Math.max(0, Math.round(i * step - ov));
    return cut(im, 1800, y, Math.min(H - y, Math.round(step + 2 * ov)));
  });
  return { full: cut(im, 1600), strips };
}

const isPdf = (f: File) => /pdf/i.test(f.type || '') || /\.pdf$/i.test(f.name || '');

interface PdfJs {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (o: { data: ArrayBuffer }) => {
    promise: Promise<{ numPages: number; getPage: (i: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: unknown) => { promise: Promise<void> } }> }>;
  };
}

async function pdfCanvases(file: File): Promise<HTMLCanvasElement[]> {
  const w = window as unknown as { pdfjsLib?: PdfJs };
  await loadJs('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', () => !!w.pdfjsLib);
  const lib = w.pdfjsLib!;
  lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const out: HTMLCanvasElement[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 6); i++) {
    const pg = await pdf.getPage(i);
    const v1 = pg.getViewport({ scale: 1 });
    const v = pg.getViewport({ scale: Math.min(3, 2200 / Math.max(v1.width, v1.height)) });
    const c = document.createElement('canvas');
    c.width = Math.round(v.width);
    c.height = Math.round(v.height);
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: g, viewport: v }).promise;
    out.push(c);
  }
  return out;
}

export async function preparePages(files: File[]) {
  const pages: { full: string; strips: string[] }[] = [];
  for (const f of files) {
    if (isPdf(f)) for (const c of await pdfCanvases(f)) pages.push(pageOf(c));
    else {
      const url = URL.createObjectURL(f);
      try {
        pages.push(pageOf(await loadImg(url)));
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    if (pages.length >= 8) break;
  }
  if (!pages.length) throw new Error('الملف فاضي');
  return pages.slice(0, 8);
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

/* ---------- 🤖 من Claude (old CL_PROMPT / clParse) ---------- */
export const CL_PROMPT = `اقرا صورة/صور فاتورة الشراء دي (ممكن تكون مطبوعة أو بخط اليد) واكتب كل بنود الأصناف من أول الجدول لآخره — ماتسيبش ولا صف.
اكتب الرد بلوك JSON واحد بس بالشكل ده بالظبط (من غير أي كلام قبله أو بعده):
{"supplier":"اسم المورد","invoice_no":"رقم الفاتورة","date":"YYYY-MM-DD","row_count":عدد_صفوف_الأصناف,"grand_total":الإجمالي_المكتوب,"discount":الخصم_لو_موجود,"items":[{"text":"اسم الصنف زي ما هو مكتوب","code":"كود المورد لو موجود","qty":الكمية,"unit":"الوحدة","price":سعر_الوحدة,"total":إجمالي_البند}]}
قواعد: الأرقام بالإنجليزي. اسم الصنف زي ما هو بالظبط من غير ترجمة. ماتحطش سطور الإجمالي أو الخصم كبنود. لو حاجة مش مقروءة اكتبها في "notes" وماتخمنش. لو الفاتورة كذا صورة اجمعهم في نفس الـ JSON.`;

const en = (t: unknown) =>
  String(t ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',');
const nn = (v: unknown): number => {
  if (typeof v === 'number') return v;
  let t = en(v).replace(/[^0-9.,-]/g, '');
  t = /,\d{3}(\D|$)/.test(t) ? t.replace(/,/g, '') : t.replace(/,/g, '.');
  const x = parseFloat(t);
  return Number.isNaN(x) ? 0 : x;
};

export function clParse(raw: string): ReadInvoice {
  let t = en(raw).trim();
  if (!t) throw new Error('الصق رد Claude الأول');
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m) t = m[1]!;
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) {
    let d: Record<string, unknown>;
    try {
      d = JSON.parse(t.slice(a, b + 1));
    } catch {
      throw new Error('الرد مش كامل — انسخ رد Claude كله تاني (من أول { لآخر })');
    }
    const src = (d.items || d['بنود'] || []) as Record<string, unknown>[];
    const items = src
      .map((x) => ({
        text: String(x.text || x.name || x.product || x['الصنف'] || '').trim(),
        code: String(x.code || '').trim(),
        qty: nn(x.qty != null ? x.qty : x.quantity != null ? x.quantity : x['الكمية']) || 1,
        unit: String(x.unit || ''),
        price: nn(x.price != null ? x.price : x['السعر']),
        total: nn(x.total != null ? x.total : x['الإجمالي']),
      }))
      .filter((x) => x.text);
    return {
      supplier: String(d.supplier || ''),
      invoice_no: String(d.invoice_no || ''),
      date: String(d.date || ''),
      notes: String(d.notes || ''),
      items,
      _check: { rows: nn(d.row_count), grand_total: nn(d.grand_total), discount: nn(d.discount) },
    };
  }
  // fallback: «اسم | كمية | سعر» lines
  const items = t
    .split(/\n+/)
    .map((l) => l.split(/\s*[|\t]\s*/).map((x) => x.trim()).filter(Boolean))
    .filter((c) => c.length >= 2 && /[^\d\s.,]/.test(c[0]!))
    .map((c) => ({ text: c[0]!, qty: nn(c[1]) || 1, price: nn(c[2]), total: nn(c[3]) }));
  if (!items.length) throw new Error('مش لاقي بنود في الرد — اتأكد إنك نسخت رد Claude كله');
  return { supplier: '', items };
}

/* ---------- the queue ---------- */
export function useScans() {
  return useQuery({
    queryKey: ['ai-scans'],
    queryFn: ({ signal }) => api.get<{ items: Scan[]; ai: boolean }>('/ai/scans', undefined, signal),
    refetchInterval: (q) => (q.state.data?.items.some((s) => s.status === 'pending' || s.status === 'working') ? 5000 : 40000),
  });
}

const ago = (t: string) => {
  const m = Math.round((Date.now() - new Date(t).getTime()) / 60000);
  return m < 1 ? 'دلوقتي' : m < 60 ? `من ${m} دقيقة` : m < 1440 ? `من ${Math.round(m / 60)} ساعة` : new Date(t).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
};
const inMin = (t: string) => Math.max(0, Math.ceil((new Date(t).getTime() - Date.now()) / 60000));

/** Same supplier + same invoice number read twice: the later one is marked «♻️ مكررة». */
function dupIds(L: Scan[]) {
  const out = new Set<string>();
  const seen = new Map<string, string>();
  L.slice()
    .reverse()
    .forEach((s) => {
      const r = s.result ?? { items: [] };
      const no = String(r.invoice_no || '').trim();
      if (!no) return;
      const k = `${(r.supplier || s.supplier || '').trim()}|${no}`;
      if (seen.has(k) && s.status !== 'failed') out.add(s.id);
      else seen.set(k, s.id);
    });
  return out;
}

function ScanRow({ s, dupe, onReview }: { s: Scan; dupe: boolean; onReview: (s: Scan) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { open } = useModal();
  const refresh = () => qc.invalidateQueries({ queryKey: ['ai-scans'] });
  const n = s.result?.items.length ?? 0;
  const who = s.result?.supplier || s.supplier;
  const pn = s.result?.pno;
  const used = s.status === 'used';
  const st = used
    ? pn
      ? `🧾 اتعملت فاتورة ${pn}`
      : '🧾 اتحولت لفاتورة'
    : dupe
      ? '♻️ مكررة — نفس المورد ونفس رقم الفاتورة'
      : s.status === 'done'
        ? `✅ اتقرت — ${n} بند`
        : s.status === 'failed'
          ? `❌ ماتقريتش: ${s.error}`
          : s.status === 'working'
            ? '⏳ بتتقري دلوقتي…'
            : `⏳ مستنية${s.attempts ? ` — المحاولة ${s.attempts + 1} ${inMin(s.nextAt) ? `بعد ${inMin(s.nextAt)} دقيقة` : 'دلوقتي'}` : ''}`;
  const openInv = async () => {
    try {
      const r = await api.get<{ items: { id: string }[] }>('/invoices', { kind: 'PURCHASE', q: pn, pageSize: 1 });
      if (r.items[0]) open({ kind: 'invoice', id: r.items[0].id });
      else toast(`الفاتورة ${pn} في المشتريات`);
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
  return (
    <div className={`scl ${s.status}`} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', padding: '8px 0' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <b>
          📄 فاتورة{who ? ` — ${who}` : ''}
          {s.pages > 1 ? ` (${s.pages} صفحات)` : ''}
        </b>
        <small style={{ display: 'block', color: 'var(--muted)' }}>
          {st}
          {s.status === 'pending' && s.error ? <span style={{ color: '#8a4b00' }}> ({s.error.slice(0, 60)})</span> : null}
          <br />
          {ago(s.createdAt)}
          {s.createdBy ? ` • ${s.createdBy}` : ''}
        </small>
      </div>
      <div className="btnrow">
        {used && pn && (
          <button type="button" className="primary" onClick={() => void openInv()}>
            🧾 افتح الفاتورة
          </button>
        )}
        {s.status === 'done' && (
          <button type="button" className="primary" onClick={() => onReview(s)}>
            👀 راجعها
          </button>
        )}
        {(s.status === 'failed' || s.status === 'pending') && (
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              await api.post(`/ai/scans/${s.id}/retry`, {}).catch((e) => toast(errorMessage(e), 'bad'));
              toast('⏳ بحاول تاني…');
              void refresh();
            }}
          >
            🔄 حاول دلوقتي
          </button>
        )}
        <button
          type="button"
          className="secondary danger"
          onClick={async () => {
            if (!window.confirm('حذف الفاتورة دي من الطابور؟')) return;
            await api.delete(`/ai/scans/${s.id}`).catch((e) => toast(errorMessage(e), 'bad'));
            void refresh();
          }}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

/** Opens the purchase window with a read invoice (from the purchases screen or the dashboard banner). */
export function useReviewScan() {
  const { open } = useModal();
  return (s: Scan) => open({ kind: 'transaction', type: 'PURCHASE', preset: { lines: [], person: s.supplier || s.result?.supplier || '', scanId: s.id } });
}

/** «📥 قراءة الفواتير بالصورة» card at the top of the purchases screen, tabs لسه / اتحوّلت / كلها. */
export function ScanQueueCard() {
  const scans = useScans();
  const review = useReviewScan();
  const [tab, setTab] = useState<'wait' | 'used' | 'all'>('wait');
  const SC = scans.data?.items ?? [];
  if (!SC.length) return null;
  const L = SC.filter((s) => s.status !== 'used');
  const nUsed = SC.filter((s) => s.status === 'used').length;
  const nErr = SC.filter((s) => s.status === 'failed').length;
  const LT = tab === 'used' ? SC.filter((s) => s.status === 'used') : tab === 'all' ? SC : L;
  const dups = dupIds(SC);
  const tabs: [typeof tab, string][] = [
    ['wait', `لسه (${L.length}${nErr ? ` • ${nErr} خطأ` : ''})`],
    ['used', `اتحوّلت (${nUsed})`],
    ['all', `كلها (${SC.length})`],
  ];
  return (
    <div className="card" style={{ marginBottom: 12 }} id="scPage">
      <b>📥 قراءة الفواتير بالصورة</b>
      <div style={{ display: 'flex', gap: 6, margin: '8px 0', overflowX: 'auto' }}>
        {tabs.map(([k, l]) => (
          <button key={k} type="button" className={tab === k ? 'primary' : 'secondary'} style={{ flex: 'none', padding: '9px 14px', borderRadius: 99 }} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {LT.length ? LT.map((s) => <ScanRow key={s.id} s={s} dupe={dups.has(s.id)} onReview={review} />) : <div className="empty">مفيش فواتير هنا.</div>}
    </div>
  );
}

/** Dashboard banner: «📥 عندك N فاتورة شراء اتقرت ومستنية مراجعتك». */
export function ScanBanner({ onGo }: { onGo: () => void }) {
  const scans = useScans();
  const L = scans.data?.items ?? [];
  const done = L.filter((s) => s.status === 'done').length;
  const wait = L.filter((s) => s.status === 'pending' || s.status === 'working').length;
  if (!done) return null;
  return (
    <button
      type="button"
      id="scBanner"
      onClick={onGo}
      style={{ width: '100%', marginBottom: 14, background: '#eef6ff', color: '#0b4a8b', border: '1px solid #9cc3ef', borderRadius: 14, padding: 14, fontSize: 16, textAlign: 'right' }}
    >
      📥 عندك <b>{done}</b> فاتورة شراء اتقرت ومستنية مراجعتك{wait ? ` • و${wait} بتتقري` : ''} — اضغط للمراجعة
    </button>
  );
}

/** Small strip at the bottom while a photo is read in the background (does not block anything). */
function Chip({ text }: { text: string }) {
  return (
    <div
      id="ivChip"
      style={{ position: 'fixed', left: 12, right: 12, bottom: 14, zIndex: 9999, background: '#0b4a8b', color: '#fff', borderRadius: 14, padding: '12px 14px', fontSize: 15, textAlign: 'center', pointerEvents: 'none', boxShadow: '0 6px 20px rgba(0,0,0,.25)' }}
    >
      {text}
    </div>
  );
}

/**
 * «📷 صوّر الفاتورة / 🖼️ من الصور / 📄 من الملفات / 🤖 من Claude» in the purchase window (the old ivBtn) + «📥 فواتير للمراجعة».
 * The photo goes to the server queue; when it is read while the window is still open, its lines come down here.
 */
export function InvoicePhotoButtons({
  supplier,
  autoScan,
  onRead,
}: {
  supplier?: string;
  /** Opened from «👀 راجعها»: apply this read invoice at once. */
  autoScan?: string;
  onRead: (r: ReadInvoice, scanId: string | null) => void | Promise<void>;
}) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const fil = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const qc = useQueryClient();
  const scans = useScans();
  const [busy, setBusy] = useState('');
  const [waitId, setWaitId] = useState<string | null>(null);
  const [claude, setClaude] = useState(false);
  const [clText, setClText] = useState('');
  const applied = useRef(new Set<string>());

  const [last, setLast] = useState<string | null>(null);
  const apply = async (s: Scan) => {
    if (!s.result || applied.current.has(s.id)) return;
    applied.current.add(s.id);
    setLast(s.id);
    await onRead(s.result, s.id);
    const c = s.result._check;
    toast(`✔ اتقرا ${s.result.items.length} بند — راجعهم${c && c.ok === false ? ' — ⚠️ ممكن يكون فيه بنود ناقصة أو الإجمالي مش مطابق' : ''}`);
  };

  // the photo we are waiting for got read (or failed) while the window is open
  useEffect(() => {
    const id = waitId ?? autoScan;
    if (!id) return;
    const s = scans.data?.items.find((x) => x.id === id);
    if (!s) return;
    if (s.status === 'done') {
      setWaitId(null);
      void apply(s);
    } else if (s.status === 'failed' && waitId) {
      setWaitId(null);
      toast(`❌ ${s.error}`, 'bad');
    } else if (s.status === 'pending' && s.attempts > 0 && waitId) {
      setWaitId(null);
      toast('⏳ جوجل زحمة دلوقتي — هعيد المحاولة لوحدي وهتلاقيها في «فواتير للمراجعة»');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scans.data, waitId, autoScan]);

  const add = useMutation({
    mutationFn: async (files: File[]) => {
      setBusy('⏳ بجهّز الفاتورة…');
      const pages = await preparePages(files);
      setBusy(pages.length > 1 ? `⏳ برفع ${pages.length} صفحات…` : '⏳ برفع الصورة…');
      return api.post<Scan>('/ai/scans', { pages, supplier: supplier?.trim() ?? '' });
    },
    onSuccess: (s) => {
      setBusy('');
      setWaitId(s.id);
      void qc.invalidateQueries({ queryKey: ['ai-scans'] });
    },
    onError: (e) => {
      setBusy('');
      toast(`❌ ${errorMessage(e)}`, 'bad');
    },
  });

  const pick = (list: FileList | null) => {
    const fs = [...(list ?? [])];
    if (!fs.length) return;
    toast(`📷 وصلت ${fs.length > 1 ? `${fs.length} صور` : 'الصورة'} — بجهّزها…`);
    add.mutate(fs);
  };

  const L = (scans.data?.items ?? []).filter((s) => s.status !== 'used' && s.id !== autoScan);
  const dups = dupIds(scans.data?.items ?? []);
  return (
    <div className="field full" id="ivBtn">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="primary" style={{ flex: 1, minWidth: 120 }} disabled={!!busy} onClick={() => cam.current?.click()}>
          📷 صوّر الفاتورة
        </button>
        <button type="button" className="secondary" style={{ flex: 1, minWidth: 100 }} disabled={!!busy} onClick={() => gal.current?.click()}>
          🖼️ من الصور
        </button>
        <button type="button" className="secondary" style={{ flex: 1, minWidth: 100 }} disabled={!!busy} onClick={() => fil.current?.click()}>
          📄 من الملفات
        </button>
        <button type="button" className="secondary" style={{ flex: 1, minWidth: 100 }} onClick={() => setClaude(!claude)}>
          🤖 من Claude
        </button>
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (pick(e.target.files), (e.target.value = ''))} />
      <input ref={gal} type="file" accept="image/*" multiple hidden onChange={(e) => (pick(e.target.files), (e.target.value = ''))} />
      <input ref={fil} type="file" accept="image/*,application/pdf,.pdf" multiple hidden onChange={(e) => (pick(e.target.files), (e.target.value = ''))} />
      <small style={{ color: 'var(--muted)' }}>
        {busy || 'صورة أو PDF لفاتورة المورد — بتتقري في الخلفية، ولو جوجل زحمة بيعيد المحاولة لوحده، وتلاقيها في «📥 فواتير للمراجعة»'}
      </small>
      {last && !waitId && (
        <button
          type="button"
          className="secondary"
          style={{ width: '100%', marginTop: 6 }}
          onClick={async () => {
            try {
              await api.post(`/ai/scans/${last}/deep`, {});
              // mark it waiting in the cache too, so the old answer is not applied again before the refresh
              qc.setQueryData<{ items: Scan[]; ai: boolean }>(['ai-scans'], (d) =>
                d ? { ...d, items: d.items.map((x) => (x.id === last ? { ...x, status: 'pending', attempts: 0 } : x)) } : d,
              );
              applied.current.delete(last);
              setWaitId(last);
              toast('🔍 بقرا الفاتورة تاني بدقة أعلى… كمّل شغلك');
            } catch (e) {
              toast(`❌ ${errorMessage(e)}`, 'bad');
            }
          }}
        >
          🔍 اقرا تاني بدقة أعلى
        </button>
      )}
      {scans.data && !scans.data.ai &&<small style={{ display: 'block', color: '#8a4b00' }}>⚠️ قراءة الصور محتاجة مفتاح ذكاء اصطناعي على السيرفر — الصور هتستنى في الطابور لحد ما يتحط. «🤖 من Claude» شغال من غيره.</small>}
      {claude && (
        <div className="card" style={{ marginTop: 10 }}>
          <b>🤖 قراءة الفاتورة بـ Claude</b>
          <div style={{ lineHeight: 1.9, margin: '6px 0 10px' }}>
            <b>١)</b> دوس «📋 انسخ التعليمات».
            <br />
            <b>٢)</b> افتح تطبيق Claude، اعمل محادثة جديدة، ابعت صورة/صور الفاتورة والصق التعليمات معاها.
            <br />
            <b>٣)</b> لما يرد، انسخ رده كله وارجع هنا والصقه تحت ودوس «✅ اقرا الرد».
          </div>
          <button
            type="button"
            className="primary"
            style={{ width: '100%', minHeight: 50, marginBottom: 10 }}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(CL_PROMPT);
                toast('✔ التعليمات اتنسخت — الصقها في Claude مع الصور');
              } catch {
                window.prompt('انسخ التعليمات دي:', CL_PROMPT);
              }
            }}
          >
            📋 انسخ التعليمات لـ Claude
          </button>
          <textarea rows={9} style={{ width: '100%', fontSize: 14, direction: 'ltr', textAlign: 'left' }} placeholder="الصق رد Claude هنا..." value={clText} onChange={(e) => setClText(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="secondary"
              style={{ flex: 1 }}
              onClick={async () => {
                try {
                  setClText(await navigator.clipboard.readText());
                } catch {
                  toast('دوس جوه الخانة واختار «لصق»');
                }
              }}
            >
              📥 الصق
            </button>
            <button
              type="button"
              className="primary"
              style={{ flex: 2, minHeight: 50 }}
              onClick={async () => {
                try {
                  const d = clParse(clText);
                  await onRead(d, null);
                  setClaude(false);
                  setClText('');
                  toast(`✔ اتقرا ${d.items.length} بند — راجعهم`);
                } catch (e) {
                  toast(`❌ ${(e as Error).message || e}`, 'bad');
                }
              }}
            >
              ✅ اقرا الرد
            </button>
          </div>
        </div>
      )}
      {L.length > 0 && (
        <div id="ivQ" style={{ marginTop: 6 }}>
          <b>📥 فواتير للمراجعة</b>
          {L.map((s) => (
            <ScanRow key={s.id} s={s} dupe={dups.has(s.id)} onReview={(x) => void apply(x)} />
          ))}
        </div>
      )}
      {waitId && <Chip text="⏳ بقرا الفاتورة في الخلفية… كمّل شغلك، هتفتحلك لوحدها أول ما تخلص" />}
    </div>
  );
}
