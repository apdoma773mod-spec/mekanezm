'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FieldLine, FieldOrderDto, LineState, ProductDto } from '@mk/shared';
import { useModal } from '../modals/modal-host';
import { useToast } from '../ui/toast';
import { errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useCreateFieldOrder, useFieldCancel, useFieldInvoice, useFieldOrders, useFieldReply, useIdent, useLineState, useVan } from '@/lib/hy-queries';
import { useAddWanted } from '@/lib/phase4-queries';
import { printHtml } from '@/lib/print';
import { useContacts, useInvoices, useProducts } from '@/lib/trade-queries';
import { code128Svg } from '@/lib/code128';
import { ago, Btn, Card, Chip, csvSave, Field, IN, KV, Label, nq, num, Pills, Sheet, waNum } from './ui';

const LST: Record<LineState, [string, string]> = {
  new: ['جديد', '#2563eb'],
  prep: ['بيتجهز', '#d97706'],
  short: ['ناقص / بيتطلب', '#dc2626'],
  ready: ['جاهز', '#7c3aed'],
  sent: ['اتبعت للعميل', '#0891b2'],
  done: ['اتسلم', '#15803d'],
  hold: ['مؤجل', '#6b7280'],
  cancel: ['اتلغى', '#9ca3af'],
};
const LORD: LineState[] = ['new', 'prep', 'ready', 'sent', 'done'];
const PRI = { urgent: ['🔴 عاجل', '#dc2626'], today: ['🟠 النهارده', '#d97706'], normal: ['⚪ عادي', '#6b7280'] } as const;
const OST = { new: ['جديد', '#2563eb'], doing: ['جاري', '#d97706'], done: ['اتنفذ', '#15803d'], cancel: ['ملغي', '#9ca3af'] } as const;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
const ACT = (l: FieldLine) => l.r > 0 && l.st !== 'done' && l.st !== 'cancel';
const lateOf = (o: FieldOrderDto) => {
  const h = (Date.now() - Date.parse(o.sentAt || o.createdAt)) / 36e5;
  return (o.lines.some((l) => l.pri === 'urgent') && h > 4) || (o.lines.some((l) => l.pri === 'today') && h > 10) || h > 48;
};

export function waText(o: FieldOrderDto) {
  const L = o.lines.map((l) => `• ${l.n} × ${l.q}${l.r > 0 ? (l.st === 'done' ? ' ✔ اتسلم' : ' (مطلوب من المخزن)') : l.s > 0 ? ' ✔ متاح' : ''}`).join('\n');
  return `أوردر رقم ${o.no} — هيدرولك\nالعميل: ${o.customer}\n${L}${o.total ? `\nالإجمالي: ${money(o.total)}` : ''}${o.eta ? `\nميعاد التوصيل: ${o.eta}` : ''}${o.note ? `\nملاحظة: ${o.note}` : ''}\nشكرًا لتعاملكم معانا`;
}
const waOpen = (o: FieldOrderDto) => window.open(`https://wa.me/${waNum(o.phone)}?text=${encodeURIComponent(waText(o))}`, '_blank');

/** The old ordLabel(): a 100×150 mm label for the order, in Hydrolek's colour. */
function useLabel() {
  const ident = useIdent().data?.HY;
  return (o: FieldOrderDto) => {
    const I = ident ?? { name: 'هيدرولك', color: '#d97706', phone: '', foot: '' };
    const L = o.lines.filter((l) => l.st !== 'cancel');
    const tot = o.total || L.reduce((a, l) => a + l.q * l.pr, 0);
    const e = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    printHtml(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>ملصق ${e(o.no)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;800&display=swap"><style>@page{size:100mm 150mm;margin:0}body{margin:0}*{box-sizing:border-box;font-family:Cairo,Tahoma,sans-serif;color:#000}.t{width:100mm;min-height:150mm;padding:5mm;border-top:3mm solid ${e(I.color)}}.h{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:13pt}.c{font-size:17pt;font-weight:800;margin:3mm 0 1mm}.m{font-size:11pt;line-height:1.6}table{width:100%;border-collapse:collapse;margin-top:3mm;font-size:11pt}td{border-bottom:1px dashed #000;padding:1.2mm 0}.q{text-align:left;font-weight:800;width:18mm}.f{margin-top:3mm;font-size:10pt}.bc svg{width:100%;height:18mm;display:block;margin-top:3mm}</style></head><body><div class="t"><div class="h"><span style="color:${e(I.color)}">${e(I.name)}</span><span>${e(o.no)}</span></div><div class="c">${e(o.customer)}</div><div class="m">${o.phone ? `📞 <span dir="ltr">${e(o.phone)}</span><br>` : ''}${o.addr ? `📍 ${e(o.addr)}<br>` : ''}${o.eta ? `🕒 التسليم: ${e(o.eta)}<br>` : ''}${o.rep ? `🛵 المندوب: ${e(o.rep)}<br>` : ''}</div><table>${L.map((l) => `<tr><td>${e(l.n)}</td><td class="q">${e(l.q)}</td></tr>`).join('')}</table>${tot ? `<div class="f"><b>الإجمالي: ${e(money(tot))}</b></div>` : ''}${o.note ? `<div class="f">📝 ${e(o.note)}</div>` : ''}${I.phone ? `<div class="f">${e(I.phone)}</div>` : ''}${I.foot ? `<div class="f">${e(I.foot)}</div>` : ''}<div class="bc">${code128Svg(o.no)}</div></div></body></html>`);
  };
}

const lineChips = (l: FieldLine) => (
  <div style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
    <b>
      {l.nw ? '🆕 ' : ''}
      {l.n}
    </b>{' '}
    <small style={{ color: 'var(--muted)' }}>× {l.q}</small>
    <div>
      {l.s > 0 && <Chip t={`${l.sd ? '✔ اتباع ' : '✅ يتباع '}${l.s}`} c="#15803d" />}
      {l.r > 0 && <Chip t={`📥 ${l.r} — ${LST[l.st][0]}`} c={LST[l.st][1]} />}
      {l.pri && l.pri !== 'normal' && l.r > 0 && <Chip t={PRI[l.pri][0]} c={PRI[l.pri][1]} />}
    </div>
  </div>
);

interface DraftLine {
  pid: string;
  n: string;
  q: number;
  pr: number;
  wh: 'MK' | 'HY' | '';
  nw?: boolean;
  d?: string;
  img?: string;
  pri: 'urgent' | 'today' | 'normal';
}
interface Draft {
  c: string;
  ph: string;
  addr: string;
  eta: '' | 'today' | 'tom' | 'after' | 'date';
  etaD: string;
  pay: 'credit' | 'cash' | 'part';
  paid: string;
  note: string;
  lines: DraftLine[];
}
const EMPTY: Draft = { c: '', ph: '', addr: '', eta: '', etaD: '', pay: 'credit', paid: '', note: '', lines: [] };
const DKEY = 'mk_fq_draft';

function etaTxt(d: Draft) {
  const z = (n: number) => String(n).padStart(2, '0');
  const f = (x: Date) => `${x.getFullYear()}-${z(x.getMonth() + 1)}-${z(x.getDate())}`;
  const x = new Date();
  if (d.eta === 'today') return `النهارده ${f(x)}`;
  if (d.eta === 'tom') return x.setDate(x.getDate() + 1), `بكرة ${f(x)}`;
  if (d.eta === 'after') return x.setDate(x.getDate() + 2), `بعد بكرة ${f(x)}`;
  if (d.eta === 'date' && d.etaD) return d.etaD;
  return '';
}

const thumbOf = (f: File) =>
  new Promise<string>((ok, no) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 360 / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * k);
        c.height = Math.round(im.height * k);
        c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', 0.7));
      };
      im.onerror = no;
      im.src = String(r.result);
    };
    r.onerror = no;
    r.readAsDataURL(f);
  });

/** «⚡ أوردر ميداني سريع». */
function QuickOrder({ orders, onClose }: { orders: FieldOrderDto[]; onClose: () => void }) {
  const toast = useToast();
  const [D, setD] = useState<Draft>(EMPTY);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [nw, setNw] = useState<{ on: boolean; n: string; d: string; img: string }>({ on: false, n: '', d: '', img: '' });
  const create = useCreateFieldOrder();
  const van = useVan().data;
  const hyTiles = useProducts({ company: 'HY', category: cat || undefined, pageSize: 36 });
  const found = useProducts({ q: q.trim(), pageSize: 12 }, q.trim().length >= 2);
  const cats = useMemo(() => [...new Set((hyTiles.data?.items ?? []).map((p) => p.category).filter(Boolean))].slice(0, 12), [hyTiles.data]);
  const cust = useContacts({ type: 'CUSTOMER', q: D.c.trim() || undefined, pageSize: 20 });
  const c = cust.data?.items.find((x) => x.name === D.c.trim());
  const hist = orders.filter((o) => o.customer === D.c.trim() && o.lines.length);
  const vanOn = (van?.stock.length ?? 0) > 0;
  const onVan = (pid: string) => (van?.stock ?? []).filter((x) => x.productId === pid).reduce((a, x) => a + x.qty, 0);

  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DKEY) || 'null') as Draft | null;
      if (d && (d.c || d.lines?.length)) {
        setD({ ...EMPTY, ...d });
        toast('📝 رجّعت المسودة اللي كنت بتكتبها');
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (D.c || D.lines.length) localStorage.setItem(DKEY, JSON.stringify(D));
      else localStorage.removeItem(DKEY);
    } catch {
      /* ignore */
    }
  }, [D]);

  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const add = (p: ProductDto) =>
    setD((x) => {
      const ex = x.lines.find((l) => l.pid === p.id);
      if (ex) return { ...x, lines: x.lines.map((l) => (l === ex ? { ...l, q: l.q + 1 } : l)) };
      return { ...x, lines: [...x.lines, { pid: p.id, n: p.name, q: 1, pr: p.price || 0, wh: p.company, pri: 'normal' }] };
    });
  const split = (l: DraftLine) => {
    if (l.nw || l.wh !== 'HY') return { s: 0, r: l.q };
    const have = vanOn ? onVan(l.pid) : (hyTiles.data?.items.find((p) => p.id === l.pid)?.qty ?? 0);
    const s = Math.min(l.q, Math.max(0, have));
    return { s, r: l.q - s };
  };
  const tot = D.lines.reduce((a, l) => a + l.q * l.pr, 0);
  const sold = D.lines.reduce((a, l) => a + split(l).s * l.pr, 0);

  const send = async () => {
    if (!D.c.trim()) return toast('⚠️ اكتب اسم العميل', 'bad');
    const L = D.lines.filter((l) => l.q > 0);
    if (!L.length) return toast('⚠️ ضيف صنف', 'bad');
    try {
      await create.mutateAsync({
        customer: D.c.trim(),
        phone: D.ph.trim(),
        addr: D.addr.trim(),
        eta: etaTxt(D),
        pay: D.pay,
        paid: D.pay === 'part' ? num(D.paid) : 0,
        note: D.note.trim(),
        lines: L.map((l) => ({ productId: l.pid, name: l.n, qty: l.q, price: l.pr, nw: !!l.nw, d: l.d ?? '', img: l.img ?? '', pri: l.pri })),
      });
      setD(EMPTY);
      toast('📤 اتبعت — تقدر تفتح أوردر تاني');
      onClose();
    } catch (e) {
      toast(`⚠️ ${errorMessage(e)}`, 'bad');
    }
  };

  return (
    <Sheet title="⚡ أوردر ميداني سريع" onClose={onClose}>
      <Field label="اسم العميل / الورشة" value={D.c} onChange={(v) => set({ c: v, ...(cust.data?.items.find((x) => x.name === v)?.phone && !D.ph ? { ph: cust.data!.items.find((x) => x.name === v)!.phone } : {}) })} list="fqCl" autoComplete="off" />
      <datalist id="fqCl">{cust.data?.items.map((x) => <option key={x.id} value={x.name} />)}</datalist>
      <Field label="التليفون (اختياري)" type="tel" value={D.ph} onChange={(v) => set({ ph: v })} />
      <Field label="العنوان / الورشة / الموقع (اختياري)" value={D.addr} onChange={(v) => set({ addr: v })} />
      {c && (
        <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 12, background: 'var(--card,#fff)', border: '1px solid var(--border)' }}>
          <b>{c.name}</b> <span style={{ color: c.balance > 0 ? 'var(--danger)' : 'var(--green)', fontWeight: 800 }}>— {c.balance > 0 ? `عليه ${money(c.balance)}` : 'خالص'}</span>
          {hist.length > 0 && (
            <>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                {hist.length} أوردر قبل كده — آخرهم {ago(hist[0]!.createdAt)}
              </div>
              <Btn
                onClick={() => {
                  const L = hist[0]!.lines.filter((l) => !l.nw && l.pid).map((l) => ({ pid: l.pid, n: l.n, q: l.q, pr: l.pr, wh: l.wh, pri: 'normal' as const }));
                  set({ lines: L });
                  toast(L.length ? '🔁 اتنقل آخر أوردر — راجع الكميات' : 'الأوردر الأخير كله أصناف جديدة');
                }}
              >
                🔁 كرّر آخر أوردر ({hist[0]!.lines.length} صنف)
              </Btn>
            </>
          )}
        </div>
      )}
      <Label>اختار بالضغط (كل ضغطة = قطعة)</Label>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '6px 0' }}>
        {['', ...cats].map((k) => (
          <button
            key={k || 'all'}
            type="button"
            onClick={() => setCat(k)}
            style={{ flex: 'none', padding: '10px 14px', minHeight: 44, borderRadius: 99, fontWeight: 800, whiteSpace: 'nowrap', border: `1.5px solid ${cat === k ? 'var(--blue)' : 'var(--border)'}`, background: cat === k ? 'var(--blue)' : 'var(--card,#fff)', color: cat === k ? '#fff' : 'inherit' }}
          >
            {k || 'الكل'}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
        {(hyTiles.data?.items ?? []).map((p) => {
          const ex = D.lines.find((l) => l.pid === p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => add(p)}
              style={{ position: 'relative', textAlign: 'right', padding: 12, minHeight: 76, borderRadius: 14, border: `1.5px solid ${ex ? 'var(--green)' : 'var(--border)'}`, background: 'var(--card,#fff)', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              <b style={{ fontSize: 14, lineHeight: 1.4 }}>{p.name}</b>
              <small style={{ color: 'var(--muted)' }}>
                {p.price ? money(p.price) : ''}
                {p.qty > 0 ? ` — رصيد ${nq(p.qty)}` : ' — خلصان'}
              </small>
              {ex && (
                <span style={{ position: 'absolute', top: 6, left: 6, minWidth: 26, height: 26, borderRadius: 13, background: 'var(--green)', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{ex.q}</span>
              )}
            </button>
          );
        })}
        {!hyTiles.data?.items.length && <div className="empty">مفيش أصناف هيدرولك.</div>}
      </div>
      <input placeholder="🔍 أو دوّر باسم الصنف أو الكود..." autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} style={IN} />
      {q.trim().length >= 2 && (
        <div>
          {[...(found.data?.items ?? [])]
            .sort((a, b) => (a.company === 'HY' ? -1 : 1) - (b.company === 'HY' ? -1 : 1))
            .map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  add(p);
                  setQ('');
                }}
                style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 12, marginTop: 6, background: 'var(--card,#fff)', cursor: 'pointer' }}
              >
                <b>{p.name}</b>
                <br />
                <small style={{ color: 'var(--muted)' }}>
                  {p.company === 'HY' ? `🚚 على العربية ${nq(vanOn ? onVan(p.id) : p.qty)}` : `🏬 ميكانيزم ${nq(p.qty)}`} — سعر {money(p.price)}
                </small>
              </div>
            ))}
          {!found.data?.items.length && <div style={{ padding: 10, color: 'var(--muted)' }}>مفيش — استخدم «صنف مش في القائمة»</div>}
        </div>
      )}
      <button
        type="button"
        onClick={() => setNw({ ...nw, on: !nw.on })}
        style={{ width: '100%', padding: 14, borderRadius: 12, fontWeight: 800, fontSize: 16, marginTop: 10, background: 'transparent', border: '1.5px dashed var(--blue)', color: 'inherit' }}
      >
        🆕 صنف مش في القائمة
      </button>
      {nw.on && (
        <div style={{ border: '1.5px dashed var(--blue)', borderRadius: 14, padding: 12, marginTop: 8 }}>
          <Field label="اسم الصنف الجديد" value={nw.n} onChange={(v) => setNw({ ...nw, n: v })} />
          <Label>وصف / مقاس / لون (اختياري)</Label>
          <textarea rows={3} value={nw.d} onChange={(e) => setNw({ ...nw, d: e.target.value })} style={IN} />
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, padding: 14, borderRadius: 12, border: '1.5px solid var(--border)', fontWeight: 800, background: 'var(--card,#fff)' }}>
            {nw.img ? (
              <>
                <img src={nw.img} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }} /> ✔ اتصورت — غيّرها
              </>
            ) : (
              '📷 صورة (اختياري)'
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  setNw({ ...nw, img: await thumbOf(f) });
                } catch {
                  toast('الصورة ماتقريتش', 'bad');
                }
              }}
            />
          </label>
          <Btn
            pri
            onClick={() => {
              if (!nw.n.trim()) return toast('اكتب اسم الصنف', 'bad');
              set({ lines: [...D.lines, { pid: '', n: nw.n.trim(), d: nw.d.trim(), img: nw.img, q: 1, pr: 0, wh: '', nw: true, pri: 'normal' }] });
              setNw({ on: false, n: '', d: '', img: '' });
            }}
          >
            ＋ ضيف الصنف الجديد
          </Btn>
        </div>
      )}
      {D.lines.map((l, i) => {
        const sp = split(l);
        const setL = (p: Partial<DraftLine>) => set({ lines: D.lines.map((x, k) => (k === i ? { ...x, ...p } : x)) });
        return (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 12, marginTop: 12, background: 'var(--card,#fff)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <b>
                {l.nw ? '🆕 ' : ''}
                {l.n}
              </b>
              <button type="button" onClick={() => set({ lines: D.lines.filter((_, k) => k !== i) })} style={{ border: 0, background: 'transparent', fontSize: 24, color: 'var(--danger)', padding: '0 6px' }}>
                ✕
              </button>
            </div>
            {l.nw ? (
              <div style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>
                {l.img && <img src={l.img} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, float: 'left', marginRight: 8 }} />}
                {l.d}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                على العربية: {l.wh === 'HY' ? nq(vanOn ? onVan(l.pid) : sp.s) : 0}
                {l.wh !== 'HY' ? ' (الصنف في مخزن ميكانيزم)' : ''}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => setL({ q: Math.max(1, l.q - 1) })} style={{ flex: 'none', width: 58, height: 58, borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'inherit', fontSize: 28, fontWeight: 800 }}>
                −
              </button>
              <input inputMode="decimal" value={l.q} onChange={(e) => setL({ q: num(e.target.value) })} style={{ ...IN, margin: 0, textAlign: 'center', fontSize: 22, fontWeight: 800, flex: 1, minWidth: 0 }} />
              <button type="button" onClick={() => setL({ q: l.q + 1 })} style={{ flex: 'none', width: 58, height: 58, borderRadius: 14, border: 0, background: 'var(--blue)', color: '#fff', fontSize: 28, fontWeight: 800 }}>
                +
              </button>
            </div>
            {!l.nw && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)', flex: 'none' }}>سعر الوحدة</span>
                <input inputMode="decimal" value={l.pr || ''} onChange={(e) => setL({ pr: num(e.target.value) })} style={{ ...IN, margin: 0, flex: 1, minWidth: 0 }} />
              </div>
            )}
            <div>
              {sp.s > 0 && <Chip t={`✅ يتباع دلوقتي ${sp.s}`} c="#15803d" />}
              {sp.r > 0 && <Chip t={`${l.nw ? '🆕 صنف جديد — ' : '📥 مطلوب من ميكانيزم '}${sp.r}`} c={l.nw ? '#dc2626' : '#d97706'} />}
            </div>
            {sp.r > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {(Object.keys(PRI) as (keyof typeof PRI)[]).map((k) => (
                  <button key={k} type="button" onClick={() => setL({ pri: k })} style={{ flex: 1, padding: '12px 4px', borderRadius: 12, fontWeight: 800, fontSize: 14, border: `2px solid ${l.pri === k ? PRI[k][1] : 'var(--border)'}`, background: l.pri === k ? PRI[k][1] : 'transparent', color: l.pri === k ? '#fff' : 'inherit' }}>
                    {PRI[k][0]}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {D.lines.length > 0 && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: 'var(--card,#fff)', border: '1px solid var(--border)' }}>
          <KV l="يتباع دلوقتي" v={money(sold)} />
          <KV l="إجمالي الأوردر" v={money(tot)} />
        </div>
      )}
      {D.lines.some((l) => split(l).r > 0) && (
        <>
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>ميعاد التوصيل المطلوب</div>
          <Pills
            flex
            value={D.eta}
            onChange={(v) => set({ eta: v })}
            options={[
              ['', 'مفيش'],
              ['today', 'النهارده'],
              ['tom', 'بكرة'],
              ['after', 'بعد بكرة'],
              ['date', 'تاريخ'],
            ]}
          />
          {D.eta === 'date' && <Field label="التاريخ" type="date" value={D.etaD} onChange={(v) => set({ etaD: v })} />}
        </>
      )}
      {sold > 0 && (
        <>
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>الدفع (على اللي بيتباع دلوقتي)</div>
          <Pills
            flex
            value={D.pay}
            onChange={(v) => set({ pay: v, ...(v !== 'part' ? { paid: '' } : {}) })}
            options={[
              ['credit', 'آجل'],
              ['cash', 'كاش كله'],
              ['part', 'جزء'],
            ]}
          />
          {D.pay === 'part' && <Field label="المدفوع دلوقتي" inputMode="decimal" value={D.paid} onChange={(v) => set({ paid: v })} />}
        </>
      )}
      <Field label="ملاحظة للمخزن (اختياري)" value={D.note} onChange={(v) => set({ note: v })} />
      <button
        type="button"
        disabled={create.isPending}
        onClick={send}
        style={{ width: '100%', padding: 18, borderRadius: 14, fontWeight: 800, fontSize: 19, marginTop: 16, background: 'var(--green,#15803d)', color: '#fff', border: 0 }}
      >
        {create.isPending ? '⏳' : '📤 ابعت للمخزن'}
      </button>
    </Sheet>
  );
}

export function FqTab() {
  const toast = useToast();
  const { open } = useModal();
  const orders = useFieldOrders();
  const cancel = useFieldCancel();
  const label = useLabel();
  const [sheet, setSheet] = useState(false);
  const [tab, setTab] = useState<'open' | 'done' | 'cancel' | 'all'>('all');
  const [q, setQ] = useState('');
  const invs = useInvoices({ company: 'HY', pageSize: 100 });
  const all = (orders.data ?? []).filter((o) => o.lines.length);
  const words = q.trim().split(/\s+/).filter(Boolean);
  const L = all
    .filter((o) => (tab === 'open' ? o.status === 'new' || o.status === 'doing' : tab === 'all' ? true : o.status === tab))
    .filter((o) => !words.length || words.every((w) => [o.no, o.customer, o.phone, ...o.lines.map((l) => l.n)].join(' ').includes(w)))
    .slice(0, 40);
  const invId = (no: string) => invs.data?.items.find((x) => x.no === no)?.id;
  return (
    <>
      <button type="button" onClick={() => setSheet(true)} style={{ width: '100%', padding: 24, borderRadius: 18, fontWeight: 800, fontSize: 22, marginTop: 10, background: 'var(--blue)', color: '#fff', border: 0 }}>
        ⚡ أوردر ميداني جديد
      </button>
      <Pills
        flex
        value={tab}
        onChange={setTab}
        options={[
          ['open', 'مفتوحة'],
          ['done', 'اتنفذت'],
          ['cancel', 'ملغية'],
          ['all', 'الكل'],
        ]}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input placeholder="🔍 عميل / رقم / صنف..." value={q} onChange={(e) => setQ(e.target.value)} style={{ ...IN, margin: 0, flex: 1, minWidth: 0 }} />
        <button
          type="button"
          onClick={() =>
            csvSave(`field-orders-${today()}.csv`, ['الرقم', 'التاريخ', 'العميل', 'التليفون', 'الأصناف', 'الإجمالي', 'الحالة', 'المندوب', 'ميعاد التوصيل', 'فواتير'], L.map((o) => [o.no, o.date, o.customer, o.phone, o.lines.map((l) => `${l.n} × ${l.q}`).join(' | '), o.total, o.status, o.rep, o.eta, o.invoiceNo]))
          }
          style={{ flex: 'none', padding: '0 14px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--card,#fff)', color: 'inherit', fontWeight: 800 }}
        >
          ⬇️ تصدير
        </button>
      </div>
      {L.length ? (
        L.map((o) => (
          <Card key={o.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <b>
                {o.no} — {o.customer}
              </b>
              <small style={{ color: 'var(--muted)' }}>{ago(o.sentAt || o.createdAt)}</small>
            </div>
            <div>
              <Chip t={OST[o.status][0]} c={OST[o.status][1]} />
              {o.sentAt && (o.status === 'new' || o.status === 'doing') && lateOf(o) && <Chip t="⏰ متأخر" c="#dc2626" />}
            </div>
            {o.lines.map((l, i) => (
              <div key={i}>{lineChips(l)}</div>
            ))}
            {o.eta && <KV l="🕒 ميعاد التوصيل" v={o.eta} />}
            {o.addr && <KV l="📍 العنوان" v={o.addr} />}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button type="button" onClick={() => label(o)} style={{ flex: 'none', padding: 14, borderRadius: 12, fontWeight: 800, border: '1.5px solid var(--border)', background: 'transparent', color: 'inherit' }}>
                🏷️ ملصق
              </button>
              <button type="button" onClick={() => waOpen(o)} style={{ flex: 1, padding: '12px 6px', borderRadius: 12, fontWeight: 800, border: '1.5px solid #15803d', background: 'transparent', color: '#15803d' }}>
                📲 واتساب للعميل
              </button>
              {(o.status === 'new' || o.status === 'doing') && !o.invoiceNo && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm('تلغي الأوردر ده؟')) return;
                    try {
                      await cancel.mutateAsync(o.id);
                      toast('اتلغى');
                    } catch (e) {
                      toast(`⚠️ ${errorMessage(e)}`, 'bad');
                    }
                  }}
                  style={{ flex: 'none', padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontWeight: 800 }}
                >
                  ✖ إلغاء
                </button>
              )}
            </div>
            {o.note && <div style={{ marginTop: 6, fontSize: 14 }}>📝 {o.note}</div>}
            {o.invoiceNo && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {o.invoiceNo.split(' / ').map((no) => (
                  <button
                    key={no}
                    type="button"
                    className="secondary"
                    onClick={() => {
                      const id = invId(no);
                      if (id) open({ kind: 'invoice', id });
                      else toast('الفاتورة لسه بتتحمّل — جرّب كمان شوية');
                    }}
                  >
                    🧾 {no}
                  </button>
                ))}
              </div>
            )}
          </Card>
        ))
      ) : (
        <Card>
          <div className="empty">مفيش أوردرات هنا.</div>
        </Card>
      )}
      {sheet && <QuickOrder orders={all} onClose={() => setSheet(false)} />}
    </>
  );
}

/** «📦 مطلوب من الميدان» — the Mekanizm team's list of what reps asked for. */
export function ReqTab() {
  const toast = useToast();
  const orders = useFieldOrders();
  const setLine = useLineState();
  const reply = useFieldReply();
  const invoice = useFieldInvoice();
  const wanted = useAddWanted();
  const label = useLabel();
  const [st, setSt] = useState('open');
  const [pri, setPri] = useState('');
  const [rep, setRep] = useState('');
  const [stock, setStock] = useState('');
  const [sort, setSort] = useState('old');
  const [d, setDay] = useState('');
  const [q, setQ] = useState('');
  const [bw, setBw] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<{ id: string; idx: number } | null>(null);
  const [replies, setReplies] = useState<Record<string, { eta: string; note: string; paid: string }>>({});
  const all = (orders.data ?? []).filter((o) => o.sentAt && o.lines.some((l) => l.r > 0));
  const openReq = all.filter((o) => o.status === 'new' || o.status === 'doing');
  const reps = [...new Set(all.map((o) => o.rep).filter(Boolean))];
  const urOf = (o: FieldOrderDto) => (o.lines.some((l) => l.pri === 'urgent' && ACT(l)) ? 0 : o.lines.some((l) => l.pri === 'today' && ACT(l)) ? 1 : 2);
  const words = q.trim().split(/\s+/).filter(Boolean);
  const L = all
    .filter((o) => {
      if (st === 'open' && !(o.status === 'new' || o.status === 'doing')) return false;
      if (st === 'hold' && !o.lines.some((l) => l.st === 'hold')) return false;
      if (st === 'done' && o.status !== 'done') return false;
      if (st === 'cancel' && o.status !== 'cancel') return false;
      if (rep && o.rep !== rep) return false;
      if (d && (o.date || '').slice(0, 10) !== d) return false;
      if (pri && !o.lines.some((l) => l.pri === pri && l.r > 0)) return false;
      if (stock) {
        const ok = o.lines.filter((l) => l.r > 0).every((l) => l.ms !== undefined && l.ms >= l.r);
        if (stock === 'in' && !ok) return false;
        if (stock === 'out' && ok) return false;
      }
      if (words.length && !words.every((w) => [o.no, o.customer, o.phone, o.rep, ...o.lines.map((l) => l.n)].join(' ').includes(w))) return false;
      return true;
    })
    .sort((a, b) =>
      sort === 'urgent' ? urOf(a) - urOf(b) || Date.parse(a.sentAt!) - Date.parse(b.sentAt!) : sort === 'new' ? Date.parse(b.sentAt!) - Date.parse(a.sentAt!) : Date.parse(a.sentAt!) - Date.parse(b.sentAt!),
    );
  const buy = (() => {
    const m = new Map<string, { k: string; n: string; nw?: boolean; sh: number; need: number; cs: string[] }>();
    for (const o of openReq)
      for (const l of o.lines.filter(ACT)) {
        if (l.st === 'ready' || l.st === 'sent' || l.st === 'hold') continue;
        const sh = l.nw || l.st === 'short' ? l.r : l.ms === undefined ? 0 : Math.max(0, l.r - l.ms);
        if (sh <= 0) continue;
        const k = l.nw ? `N:${l.n}` : l.pid || l.n;
        const e = m.get(k) ?? { k, n: l.n, nw: l.nw, sh: 0, need: 0, cs: [] };
        e.sh += sh;
        e.need += l.r;
        e.cs.push(`${o.customer} ×${l.r}`);
        m.set(k, e);
      }
    return [...m.values()];
  })();
  const openCount = openReq.reduce((a, o) => a + o.lines.filter(ACT).length, 0);
  const run = async (f: () => Promise<unknown>, ok?: string) => {
    try {
      await f();
      if (ok) toast(ok);
    } catch (e) {
      toast(`⚠️ ${errorMessage(e)}`, 'bad');
    }
  };
  const wantAdd = (E: typeof buy) =>
    run(async () => {
      for (const e of E) {
        await wanted.mutateAsync({ descr: `${e.n} × ${e.sh}${e.nw ? ' (صنف جديد)' : ''} — مطلوب لـ: ${e.cs.join('، ')}`, source: 'الميدان', phone: '' });
        setBw((x) => ({ ...x, [e.k]: true }));
      }
    }, 'اتضاف للنواقص');
  const sel = (v: string, on: (v: string) => void, opts: [string, string][]) => (
    <select value={v} onChange={(e) => on(e.target.value)} style={{ ...IN, margin: 0, flex: 1, minWidth: '46%' }}>
      {opts.map(([k, t]) => (
        <option key={k} value={k}>
          {t}
        </option>
      ))}
    </select>
  );
  return (
    <>
      <Card>
        <b>📦 مطلوب من الميدان</b>{' '}
        <small style={{ color: 'var(--muted)' }}>
          ({openCount} بند مفتوح — {L.length} أوردر في العرض)
        </small>
      </Card>
      {buy.length > 0 && (
        <Card>
          <b>🛒 لازم يتشترى ({buy.length} صنف)</b>
          {buy.map((e) => (
            <div key={e.k} style={{ padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
              <b>
                {e.nw ? '🆕 ' : ''}
                {e.n}
              </b>{' '}
              <b style={{ color: '#dc2626' }}>ناقص {e.sh}</b> <small style={{ color: 'var(--muted)' }}>من {e.need} مطلوب</small>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>العملاء: {e.cs.join('، ')}</div>
              <button type="button" disabled={!!bw[e.k]} onClick={() => wantAdd([e])} style={{ width: '100%', padding: 11, borderRadius: 12, fontWeight: 800, marginTop: 6, border: '1.5px solid var(--blue)', background: 'transparent', color: 'inherit' }}>
                {bw[e.k] ? '✔ اتضاف للنواقص' : '📋 ضيفه للنواقص'}
              </button>
            </div>
          ))}
          <Btn pri onClick={() => wantAdd(buy.filter((e) => !bw[e.k]))}>
            📋 ضيف الكل للنواقص
          </Btn>
        </Card>
      )}
      <Card>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sel(st, setSt, [
            ['open', '🟢 مفتوح'],
            ['hold', '⏸ فيه مؤجل'],
            ['done', '✔ اتسلم'],
            ['cancel', '✖ ملغي'],
            ['all', 'الكل'],
          ])}
          {sel(pri, setPri, [
            ['', 'كل الأولويات'],
            ['urgent', '🔴 عاجل بس'],
            ['today', '🟠 النهارده'],
          ])}
          {sel(rep, setRep, [['', 'كل المناديب'], ...reps.map((r) => [r, r] as [string, string])])}
          {sel(stock, setStock, [
            ['', 'المخزن: الكل'],
            ['in', 'موجود في ميكانيزم'],
            ['out', 'مش موجود / ناقص'],
          ])}
          {sel(sort, setSort, [
            ['old', 'الأقدم أول'],
            ['urgent', 'الأعجل أول'],
            ['new', 'الأحدث أول'],
          ])}
          <input type="date" value={d} onChange={(e) => setDay(e.target.value)} style={{ ...IN, margin: 0, flex: 1, minWidth: '46%' }} />
        </div>
        <input placeholder="🔍 عميل / رقم أوردر / صنف..." value={q} onChange={(e) => setQ(e.target.value)} style={IN} />
        <Btn
          onClick={() =>
            csvSave(
              `field-requests-${today()}.csv`,
              ['الأوردر', 'العميل', 'التليفون', 'المندوب', 'الصنف', 'المطلوب', 'الحالة', 'الأولوية', 'ميعاد التوصيل', 'وقت الإرسال'],
              L.flatMap((o) => o.lines.filter((l) => l.r > 0).map((l) => [o.no, o.customer, o.phone, o.rep, l.n, l.r, LST[l.st][0], l.pri ? PRI[l.pri][0] : '', o.eta, (o.sentAt ?? '').slice(0, 16).replace('T', ' ')])),
            )
          }
        >
          ⬇️ تصدير القايمة (Excel / CSV)
        </Btn>
      </Card>
      {L.length ? (
        L.map((o) => {
          const live = o.status === 'new' || o.status === 'doing';
          const inv = o.lines.some((l) => l.r > 0 && l.st === 'done' && !l.inv);
          const R = replies[o.id] ?? { eta: o.eta, note: o.note, paid: '' };
          const setR = (p: Partial<typeof R>) => setReplies({ ...replies, [o.id]: { ...R, ...p } });
          const bs = { flex: 'none', padding: '13px 12px', borderRadius: 12, fontWeight: 800, background: 'transparent' } as const;
          return (
            <Card key={o.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b>
                  {o.no} — {o.customer}
                </b>
                <small style={{ color: 'var(--muted)' }}>{ago(o.sentAt)}</small>
              </div>
              <div>
                {live && lateOf(o) && <Chip t="⏰ متأخر" c="#dc2626" />}
                {urOf(o) === 0 ? <Chip t={PRI.urgent[0]} c={PRI.urgent[1]} /> : urOf(o) === 1 ? <Chip t={PRI.today[0]} c={PRI.today[1]} /> : null}
                {o.eta && <Chip t={`🕒 ${o.eta}`} c="#0891b2" />}
                {o.status === 'cancel' ? <Chip t="ملغي" c="#9ca3af" /> : o.status === 'done' ? <Chip t="اتسلم" c="#15803d" /> : null}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                🚚 المندوب: {o.rep || '—'}
                {o.phone && (
                  <>
                    {' — '}
                    <a href={`tel:${o.phone}`} dir="ltr">
                      {o.phone}
                    </a>
                  </>
                )}
                {o.addr && (
                  <>
                    <br />📍 {o.addr}
                  </>
                )}
              </div>
              {o.lines.map((l, i) => {
                if (!(l.r > 0)) return null;
                const s = l.st;
                const ix = LORD.indexOf(s);
                const nx: LineState = s === 'short' ? 'ready' : s === 'hold' ? 'new' : LORD[Math.min(ix + 1, LORD.length - 1)]!;
                const fin = s === 'done' || s === 'cancel';
                const hl = l.h?.[l.h.length - 1];
                const go = (to: LineState) => (to === 'sent' ? setSent({ id: o.id, idx: i }) : run(() => setLine.mutateAsync({ id: o.id, idx: i, st: to })));
                return (
                  <div key={i} style={{ padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
                    <b>
                      {l.nw ? '🆕 ' : ''}
                      {l.n}
                    </b>{' '}
                    <b style={{ color: '#d97706' }}>× {l.r}</b>
                    {l.pri && l.pri !== 'normal' && <Chip t={PRI[l.pri][0]} c={PRI[l.pri][1]} />}
                    {l.nw && (l.d || l.img) && (
                      <div style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>
                        {l.img && <img src={l.img} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, display: 'block', margin: '4px 0' }} />}
                        {l.d}
                      </div>
                    )}
                    <div>
                      <Chip t={`${LST[s][0]}${s === 'prep' ? ' — محجوز' : ''}`} c={LST[s][1]} />
                      {l.nw ? (
                        <Chip t="صنف جديد — يتطلب من السوق" c="#dc2626" />
                      ) : l.ms === undefined ? null : l.ms >= l.r ? (
                        <Chip t={`في مخزن ميكانيزم: ${nq(l.ms)} ✔`} c="#15803d" />
                      ) : (
                        <Chip t={`في مخزن ميكانيزم: ${nq(l.ms)} (مش كفاية)`} c="#dc2626" />
                      )}
                      {l.s > 0 && <Chip t={`اتباع من العربية ${l.s}`} c="#6b7280" />}
                      {l.inv && <Chip t="اتفوتر" c="#6b7280" />}
                      {l.dm && <Chip t={`🚚 ${l.dm}${l.dd ? ` ${l.dd}` : ''}`} c="#0891b2" />}
                    </div>
                    {hl && (
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        آخر تغيير: {hl.by} — {ago(hl.at)}
                      </div>
                    )}
                    {!fin && (
                      <>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button type="button" onClick={() => go(nx)} style={{ flex: 1, padding: '15px 6px', borderRadius: 12, fontWeight: 800, fontSize: 16, border: 0, background: LST[nx][1], color: '#fff' }}>
                            {s === 'sent' ? 'تم التسليم ✔' : s === 'hold' ? '▶ استئناف' : nx === 'sent' ? '← اتبعت للعميل' : `← ${LST[nx][0]}`}
                          </button>
                          {(s === 'new' || s === 'prep') && (
                            <button type="button" onClick={() => go('short')} style={{ ...bs, border: '1.5px solid #dc2626', color: '#dc2626' }}>
                              ناقص
                            </button>
                          )}
                          {ix > 0 && s !== 'short' && s !== 'hold' && (
                            <button type="button" onClick={() => go(LORD[ix - 1]!)} style={{ ...bs, border: '1.5px solid var(--border)', color: 'inherit' }}>
                              ↩
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          {s !== 'hold' && (
                            <button type="button" onClick={() => go('hold')} style={{ ...bs, flex: 1, border: '1.5px solid #6b7280', color: '#6b7280' }}>
                              ⏸ أجّل
                            </button>
                          )}
                          <button type="button" onClick={() => window.confirm('تلغي البند ده؟') && run(() => setLine.mutateAsync({ id: o.id, idx: i, st: 'cancel' }), 'اتلغى البند')} style={{ ...bs, flex: 1, border: '1.5px solid #9ca3af', color: '#9ca3af' }}>
                            ✖ الغي البند
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              <Field label="ميعاد / وقت التوصيل (يظهر للمندوب)" value={R.eta} onChange={(v) => setR({ eta: v })} />
              <Field label="رد للمندوب: سعر جديد / ملاحظة" value={R.note} onChange={(v) => setR({ note: v })} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" onClick={() => run(() => reply.mutateAsync({ id: o.id, eta: R.eta, note: R.note }), 'اتحفظت')} style={{ flex: 1, padding: 14, borderRadius: 12, fontWeight: 800, border: '1.5px solid var(--blue)', background: 'transparent', color: 'inherit' }}>
                  💾 حفظ الرد
                </button>
                <button type="button" onClick={() => label(o)} style={{ flex: 'none', padding: 14, borderRadius: 12, fontWeight: 800, border: '1.5px solid var(--border)', background: 'transparent', color: 'inherit' }}>
                  🏷️ ملصق
                </button>
                <button type="button" onClick={() => waOpen(o)} style={{ flex: 'none', padding: 14, borderRadius: 12, fontWeight: 800, border: '1.5px solid #15803d', background: 'transparent', color: '#15803d' }}>
                  📲 واتساب للعميل
                </button>
              </div>
              {inv && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                  <input inputMode="decimal" placeholder="المدفوع (فاضي = آجل)" value={R.paid} onChange={(e) => setR({ paid: e.target.value })} style={{ ...IN, margin: 0, flex: 1, minWidth: 0 }} />
                  <button
                    type="button"
                    disabled={invoice.isPending}
                    onClick={() => run(() => invoice.mutateAsync({ id: o.id, paid: num(R.paid) }), 'اتعملت الفاتورة')}
                    style={{ flex: 'none', padding: '15px 14px', borderRadius: 12, fontWeight: 800, border: 0, background: 'var(--green,#15803d)', color: '#fff' }}
                  >
                    🧾 فاتورة المسلَّم
                  </button>
                </div>
              )}
            </Card>
          );
        })
      ) : (
        <Card>
          <div className="empty">مفيش طلبات بالفلتر ده. ✔</div>
        </Card>
      )}
      {sent && <SentSheet onClose={() => setSent(null)} onPick={(dm, dd) => run(() => setLine.mutateAsync({ id: sent.id, idx: sent.idx, st: 'sent', dm, dd })).then(() => setSent(null))} />}
    </>
  );
}

function SentSheet({ onClose, onPick }: { onClose: () => void; onPick: (dm: string, dd: string) => void }) {
  const [dd, setDd] = useState(today());
  return (
    <Sheet title="🚚 اتبعت إزاي؟" onClose={onClose}>
      {['مندوب', 'عربية بكرة', 'شحن', 'العميل استلم من المخزن'].map((m) => (
        <button key={m} type="button" onClick={() => onPick(m, dd)} style={{ width: '100%', padding: 18, borderRadius: 14, fontWeight: 800, fontSize: 17, marginTop: 10, border: '1.5px solid var(--border)', background: 'var(--card,#fff)', color: 'inherit' }}>
          {m}
        </button>
      ))}
      <Field label="تاريخ الإرسال" type="date" value={dd} onChange={setDd} />
    </Sheet>
  );
}
