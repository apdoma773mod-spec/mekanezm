'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ContactDto, InvoiceListResult, ProductDto } from '@mk/shared';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { vn as VN } from '@/lib/import-daily';
import { useAllContacts, useAllProducts } from '@/lib/trade-queries';
import { useCompany } from '../company';
import { Modal } from '../ui/modal';
import { useToast } from '../ui/toast';
import { useModal } from './modal-host';

/**
 * 🎤 أمر صوتي (openVoice القديمة بآخر شكل ليها): بتسمع أو بتقرا الأمر، وتفتح النموذج متعبّي.
 * فوقها طبقة «فاتورة بيع المهندس رضا / كشف حساب أحمد / تحصيل من علي / سداد السبتية» بكلمات بتتعدّل (voice_cmds).
 */

// ───────── أرقام بالكلام والكلمات اللي مالهاش لازمة (زي القديم بالظبط)
const NW: Record<string, number> = { صفر: 0, واحد: 1, واحده: 1, اتنين: 2, اثنين: 2, تنين: 2, تلاته: 3, ثلاثه: 3, اربعه: 4, خمسه: 5, سته: 6, سبعه: 7, تمانيه: 8, ثمانيه: 8, تسعه: 9, عشره: 10, احداشر: 11, اطناشر: 12, تلتاشر: 13, اربعتاشر: 14, خمستاشر: 15, عشرين: 20, تلاتين: 30, ثلاثين: 30, اربعين: 40, خمسين: 50, ستين: 60, سبعين: 70, تمانين: 80, ثمانين: 80, تسعين: 90, ميه: 100, مايه: 100, مائه: 100, ميتين: 200, مئتين: 200, تلتميه: 300, ثلاثمائه: 300, اربعميه: 400, خمسميه: 500, ستميه: 600, سبعميه: 700, تمنميه: 800, تسعميه: 900, الف: 1000, الفين: 2000 };
const VSTOP = new Set('فاتوره بيع بيعت بعت شراء اشتريت اشتري مشتريات مبيعات مرتجع اعمل عمل ضيف اضيف اضافه لو سمحت من الي ده دي عايز عاوز محتاج سجل جديده جديد للعميل عميل مورد للمورد باسم بسعر سعر كميه عدد دفع مدفوع دفعت قطعه قطع كرتونه كراتين متر طقم علي في و ب ل جنيه'.split(' '));

interface Tok {
  t: string;
  n: number | null;
}
function vToks(ws: string[]): Tok[] {
  const o: Tok[] = [];
  let i = 0;
  while (i < ws.length) {
    const w = ws[i]!;
    if (/^\d+(\.\d+)?$/.test(w)) {
      o.push({ t: w, n: +w });
      i++;
      continue;
    }
    if (NW[w] != null) {
      let sum = 0;
      let cur = 0;
      let j = i;
      while (j < ws.length) {
        const x = ws[j]!;
        const v = NW[x] != null ? NW[x]! : j > i ? NW[x.replace(/^و/, '')] : undefined;
        if (v == null) break;
        if (v >= 1000) {
          sum += v === 2000 ? 2000 : (cur || 1) * 1000;
          cur = 0;
        } else cur += v;
        j++;
      }
      o.push({ t: ws.slice(i, j).join(' '), n: sum + cur });
      i = j;
      continue;
    }
    o.push({ t: w, n: null });
    i++;
  }
  return o;
}

type Intent = 'sale' | 'purchase' | 'return' | 'expense' | 'product' | 'contact';
interface Parsed {
  intent: Intent;
  rt?: 'sale' | 'purchase';
  qty: number | null;
  price: number | null;
  paid: number | null;
  person: string;
  amount?: number | '';
  note?: string;
  name?: string;
  cost?: string;
  pp?: string;
  pq?: string;
  code?: string;
  ctype?: 'عميل' | 'مورد';
  phone?: string;
  cands: ProductDto[];
}

/** voiceParse القديمة: بتطلّع نوع العملية والجهة والكمية والسعر والمدفوع وأقرب ٥ أصناف. */
function baseParse(raw: string, contacts: ContactDto[], prods: ProductDto[]): Parsed | null {
  const toks = vToks(VN(raw).split(' '));
  const txt = toks.map((x) => (x.n != null ? x.n : x.t)).join(' ');
  const has = (r: RegExp) => r.test(txt);
  const X: Parsed = { intent: 'sale', qty: null, price: null, paid: null, person: '', cands: [] };
  const num = (i: number) => (toks[i] && toks[i]!.n != null ? toks[i]!.n : null);
  if (has(/مرتجع/)) {
    X.intent = 'return';
    X.rt = has(/شراء|مورد|رجعت/) ? 'purchase' : 'sale';
  } else if (has(/مصروف|مصاريف/)) X.intent = 'expense';
  else if (has(/(ضيف|اضافه|اعمل|جديد).*(صنف|منتج)|(صنف|منتج).*جديد/)) X.intent = 'product';
  else if (has(/(عميل|مورد)/) && has(/ضيف|اضافه|جديد|سجل/) && !has(/فاتوره|بيع|شراء/)) X.intent = 'contact';
  else if (has(/شراء|اشتريت|اشتري|مشتريات/)) X.intent = 'purchase';
  else if (has(/بيع|بعت|فاتوره|مبيعات/)) X.intent = 'sale';
  else return null;
  const used = new Set<number>();
  toks.forEach((x, i) => {
    const t = x.t;
    const nx = toks[i + 1];
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^ب(\d+(\.\d+)?)$/))) {
      X.price = +m[1]!;
      used.add(i);
    } else if (['بسعر', 'سعر'].includes(t) && num(i + 1) != null && X.price == null) {
      X.price = num(i + 1);
      used.add(i).add(i + 1);
    } else if (['دفع', 'مدفوع', 'دفعت', 'مقدم', 'عربون', 'واصل'].includes(t) && num(i + 1) != null) {
      X.paid = num(i + 1);
      used.add(i).add(i + 1);
    } else if (['كميه', 'عدد'].includes(t) && num(i + 1) != null) {
      X.qty = num(i + 1);
      used.add(i).add(i + 1);
    } else if (x.n != null && nx && /^(قطعه|قطع|كرتونه|كراتين|متر|طقم|اطقم)$/.test(nx.t) && X.qty == null) {
      X.qty = x.n;
      used.add(i);
    } else if (/^(للعميل|عميل|باسم|للمورد|مورد|عند)$/.test(t) && nx && nx.n == null && X.intent !== 'contact') {
      X.person = nx.t;
      used.add(i).add(i + 1);
    } else if (t === 'من' && X.intent === 'purchase' && nx && nx.n == null && !X.person) {
      X.person = nx.t;
      used.add(i).add(i + 1);
    }
  });
  if (!X.person) {
    const c = contacts.find((c) => (VN(c.name).length > 1 && ` ${txt} `.includes(` ${VN(c.name)} `)) || ` ${txt} `.includes(` ل${VN(c.name)} `));
    if (c) X.person = c.name;
  } else {
    const c = contacts.find((c) => VN(c.name).startsWith(X.person));
    if (c) X.person = c.name;
  }
  if (!X.person && X.intent === 'sale') {
    const m = toks.findIndex((x, i) => !used.has(i) && x.n == null && /^ل.{2,}$/.test(x.t) && !VSTOP.has(x.t) && i < 3);
    if (m >= 0) {
      X.person = toks[m]!.t.slice(1);
      used.add(m);
    }
  }
  if (X.intent === 'expense') {
    X.amount = toks.find((x) => x.n != null)?.n || '';
    X.note = toks
      .filter((x) => x.n == null && !/^(مصروف|مصاريف|سجل|ضيف|جنيه)$/.test(x.t))
      .map((x) => x.t)
      .join(' ');
  }
  if (X.intent === 'product') {
    const g = (r: RegExp) => (txt.match(r) || [])[1];
    X.name = (g(/(?:اسمه|اسم|صنف|منتج)\s+(.+?)(?=\s(?:سعر|شراء|بيع|تكلفه|كميه|عدد|كود)(?=\s|$)|$)/) || '').replace(/^(جديد|اسمه)\s+/, '');
    X.cost = g(/(?:سعر الشراء|شراء|تكلفه)\s+(\d+(?:\.\d+)?)/);
    X.pp = g(/(?:سعر البيع|بيع)\s+(\d+(?:\.\d+)?)/);
    X.pq = g(/(?:كميه|عدد)\s+(\d+(?:\.\d+)?)/);
    X.code = g(/كود\s+(\S+)/);
  }
  if (X.intent === 'contact') {
    const m = txt.match(/(?:عميل|مورد)\s+(?:جديد\s+)?(?:اسمه\s+)?(.+)/);
    X.name = m ? m[1]!.replace(/\d{8,}/, '').trim() : '';
    X.ctype = has(/مورد/) ? 'مورد' : 'عميل';
    X.phone = (txt.match(/\d{10,}/) || [''])[0];
  }
  if (X.intent === 'sale' || X.intent === 'purchase' || X.intent === 'return') {
    const first = toks.findIndex((x, i) => !VSTOP.has(x.t) && !used.has(i));
    if (X.qty == null && first >= 0 && toks[first]!.n != null) {
      X.qty = toks[first]!.n;
      used.add(first);
    }
    const q = toks.filter((x, i) => !used.has(i) && !VSTOP.has(x.t)).map((x) => x.t);
    const P = prods.map((p) => {
      const tk = VN(p.name).split(' ');
      let s = 0;
      let mt = 0;
      q.forEach((w) => {
        let b = 0;
        tk.forEach((k) => {
          const a = k.replace(/^ال/, '');
          const c = w.replace(/^ال/, '');
          if (k === w) b = Math.max(b, /\d/.test(w) ? 1.4 : 1);
          else if (a.length > 2 && c.length > 2 && (a.startsWith(c) || c.startsWith(a))) b = Math.max(b, 0.6);
        });
        if (b) mt++;
        s += b;
      });
      return { p, s: s - 0.07 * Math.max(0, tk.length - mt) };
    });
    X.cands = P.filter((o) => o.s > 0.5)
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map((o) => o.p);
  }
  return X;
}

// ───────── طبقة الأوامر بالأسماء (⚙️ كلمات الأوامر)
type CmdKey = 'sale' | 'purchase' | 'stmt' | 'payin' | 'payout';
type Cmds = Record<CmdKey, string[]>;
const DEF: Cmds = {
  sale: ['فاتورة بيع', 'فاتوره بيع', 'بيع', 'بعت'],
  purchase: ['فاتورة شراء', 'فاتوره شراء', 'شراء', 'اشتريت'],
  stmt: ['كشف حساب', 'كشف'],
  payin: ['تحصيل', 'حصل', 'دفعة من'],
  payout: ['سداد', 'دفعة ل'],
};
const LAB: Record<CmdKey, string> = { sale: 'فاتورة بيع (عميل)', purchase: 'فاتورة شراء (مورد)', stmt: 'كشف حساب عميل', payin: 'تحصيل دفعة من عميل', payout: 'سداد دفعة لمورد' };
const FILL = new Set('ل لل للعميل العميل عميل للمورد المورد مورد بتاع بتاعه بتاعت باسم اسم افتح افتحلي اعمل اعملي عايز عاوز لو سمحت من الي ده دي يا'.split(' '));
const norm = (t: string) =>
  VN(t)
    .split(' ')
    .map((w) => w.replace(/^ال(?=..)/, ''))
    .join(' ');
function lev(a: string, b: string) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 1; j <= n; j++) d[0]![j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m]![n]!;
}
function sim(q: string, name: string) {
  const qt = norm(q).split(' ').filter(Boolean);
  const nt = norm(name).split(' ').filter(Boolean);
  if (!qt.length || !nt.length) return 0;
  const s =
    qt.reduce(
      (a, w) => a + Math.max(...nt.map((k) => (k === w ? 1 : w.length > 2 && k.length > 2 && (k.startsWith(w) || w.startsWith(k)) ? 0.85 : Math.max(0, 1 - lev(w, k) / Math.max(w.length, k.length))))),
      0,
    ) / qt.length;
  return s - 0.04 * Math.max(0, nt.length - qt.length);
}
function findCmd(cmd: Cmds, txt: string) {
  let best: { k: CmdKey; p: string } | null = null;
  (Object.keys(cmd) as CmdKey[]).forEach((k) =>
    cmd[k].forEach((ph) => {
      const p = VN(ph);
      if (!p) return;
      const re = new RegExp(`(^| )${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?= |$)`);
      if (re.test(txt) && (!best || p.length > best.p.length)) best = { k, p };
    }),
  );
  return best as { k: CmdKey; p: string } | null;
}
const ctypeOf = (k: CmdKey) => (k === 'purchase' || k === 'payout' ? 'SUPPLIER' : 'CUSTOMER');

const useVoiceCmds = () =>
  useQuery({
    queryKey: ['kv', 'voice_cmds'],
    queryFn: ({ signal }) =>
      api
        .get<{ value: Partial<Cmds> | null }>('/work/kv/voice_cmds', undefined, signal)
        .then((r) => {
          const v = r.value;
          const out: Cmds = JSON.parse(JSON.stringify(DEF));
          if (v && typeof v === 'object') (Object.keys(DEF) as CmdKey[]).forEach((k) => Array.isArray(v[k]) && v[k]!.length && (out[k] = v[k]!));
          return out;
        })
        .catch(() => DEF),
    staleTime: 300_000,
  });

type SR = {
  lang: string;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
const getSR = () => {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
};

export function VoiceModal() {
  const { open, close } = useModal();
  const { co } = useCompany();
  const customers = useAllContacts('CUSTOMER').data ?? [];
  const suppliers = useAllContacts('SUPPLIER').data ?? [];
  const prods = useAllProducts({ company: co }).data ?? [];
  const cmds = useVoiceCmds().data ?? DEF;
  const qc = useQueryClient();
  const [txt, setTxt] = useState('');
  const [res, setRes] = useState<ReactNode>(null);
  const [listening, setListening] = useState(false);
  const rec = useRef<SR | null>(null);
  const txtRef = useRef('');
  txtRef.current = txt;
  const runRef = useRef<() => void>(() => {});

  const stop = () => {
    if (rec.current) {
      try {
        rec.current.abort();
      } catch {
        /* already stopped */
      }
      rec.current = null;
    }
  };
  const bye = () => {
    stop();
    close();
  };
  const vstat = (t: string, bad?: boolean) => setRes(<p style={{ color: bad ? 'var(--danger)' : 'inherit' }}>{t}</p>);

  const toggle = () => {
    const S = getSR();
    if (!S) return vstat('المتصفح ده مش بيدعم التعرف على الصوت داخل الصفحة. اضغط جوه الخانة واستخدم ميكروفون الكيبورد 🎤 (جنب مسطرة المسافة).', true);
    if (rec.current) return rec.current.stop();
    let got = false;
    let failed = false;
    const r = new S();
    r.lang = 'ar-EG';
    r.interimResults = true;
    r.onstart = () => vstat('بسمعك... اتكلم دلوقتي');
    r.onresult = (e) => {
      got = true;
      setTxt(
        Array.from(e.results)
          .map((x) => x[0]!.transcript)
          .join(' '),
      );
    };
    r.onerror = (e) => {
      got = true;
      failed = true;
      rec.current = null;
      setListening(false);
      vstat(`الميكروفون مش شغال هنا (${e.error}). ${/not-allowed|service/.test(e.error) ? 'المتصفح أو الصفحة بتمنع الميكروفون. ' : ''}استخدم ميكروفون الكيبورد في الخانة.`, true);
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
      if (got && txtRef.current.trim() && !failed) setTimeout(() => runRef.current(), 0);
      else if (!got) vstat('ما سمعتش حاجة، أو المتصفح قفل الميكروفون من غير رسالة. جرّب تاني أو استخدم ميكروفون الكيبورد في الخانة.', true);
    };
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch (e) {
      rec.current = null;
      setListening(false);
      vstat(`تعذّر تشغيل الميكروفون: ${(e as Error)?.message || e}`, true);
    }
  };

  useEffect(() => {
    toggle(); // the old window started listening as soon as it opened
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTx = (k: 'sale' | 'purchase', c?: ContactDto) => {
    stop();
    open({ kind: 'transaction', type: k === 'purchase' ? 'PURCHASE' : 'SALE', person: c?.name, contactId: c?.id });
  };

  const go = async (k: CmdKey, c: ContactDto) => {
    stop();
    if (k === 'stmt') return open({ kind: 'contactFile', id: c.id });
    if (k === 'payin' || k === 'payout') return open({ kind: 'payment', contactId: c.id });
    const sale = k === 'sale';
    setRes(<p>…</p>);
    let L: InvoiceListResult['items'] = [];
    try {
      L = (await qc.fetchQuery({
        queryKey: ['invoices', { kind: sale ? 'SALE' : 'PURCHASE', contactId: c.id, pageSize: 50 }],
        queryFn: () => api.get<InvoiceListResult>('/invoices', { kind: sale ? 'SALE' : 'PURCHASE', contactId: c.id, pageSize: 50 }),
      })).items.filter((r) => r.status !== 'VOID');
    } catch (e) {
      return vstat(errorMessage(e), true);
    }
    if (L.length === 1) return open({ kind: 'invoice', id: L[0]!.id });
    if (!L.length)
      return setRes(
        <>
          <div style={{ background: 'var(--tint2)', padding: 10, borderRadius: 12 }}>
            <b>{c.name}</b> مالوش فواتير {sale ? 'بيع' : 'شراء'}.
          </div>
          <p>
            تفتح فاتورة {sale ? 'بيع' : 'شراء'} جديدة {sale ? 'للعميل' : 'للمورد'} ده؟
          </p>
          <button type="button" className="primary" style={{ width: '100%' }} onClick={() => openTx(k, c)}>
            ✔ أيوه، فاتورة جديدة
          </button>
        </>,
      );
    setRes(
      <>
        <p style={{ margin: '6px 0' }}>
          <b>{c.name}</b> ليه {L.length} فاتورة — اختار:
        </p>
        {L.slice(0, 8).map((g) => (
          <button
            key={g.id}
            type="button"
            className="secondary"
            style={{ width: '100%', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}
            onClick={() => open({ kind: 'invoice', id: g.id })}
          >
            <span>
              {g.no} — {g.date}
            </span>
            <b>{money(g.total)}</b>
          </button>
        ))}
        <button type="button" className="primary" style={{ width: '100%' }} onClick={() => openTx(k, c)}>
          ➕ فاتورة جديدة
        </button>
      </>,
    );
  };

  const voiceGo = (X: Parsed, p: ProductDto | null) => {
    stop();
    if (X.intent === 'sale' || X.intent === 'purchase') {
      const sale = X.intent === 'sale';
      const c = (sale ? customers : suppliers).find((x) => x.name === X.person);
      return open({
        kind: 'transaction',
        type: sale ? 'SALE' : 'PURCHASE',
        person: X.person || undefined,
        contactId: c?.id,
        preset: {
          person: X.person || undefined,
          paid: sale && X.paid != null ? X.paid : undefined,
          lines: p ? [{ productId: p.id, name: p.name, qty: X.qty ?? 1, price: X.price ?? (sale ? p.price : (p.cost ?? 0)) }] : [],
        },
      });
    }
    if (X.intent === 'return')
      return open({ kind: 'return', type: X.rt === 'purchase' ? 'PURCHASE' : 'SALE', preset: { product: p ?? undefined, person: X.person || undefined, qty: X.qty ?? undefined, price: X.price ?? undefined } });
    if (X.intent === 'expense') return open({ kind: 'expense', preset: { note: X.note, amount: X.amount ? +X.amount : undefined } });
    if (X.intent === 'product')
      return open({ kind: 'product', preset: { name: X.name, cost: X.cost ? +X.cost : undefined, price: X.pp ? +X.pp : undefined, qty: X.pq ? +X.pq : undefined, code: X.code } });
    open({ kind: 'contact', type: X.ctype === 'مورد' ? 'SUPPLIER' : 'CUSTOMER', preset: { name: X.name, phone: X.phone } });
  };

  const showBase = () => {
    const X = baseParse(txtRef.current, [...customers, ...suppliers], prods);
    if (!X) return setRes(<p>مفهمتش الأمر. جرّب تبدأ بـ: بيع، شراء، مصروف، مرتجع، صنف جديد، عميل جديد.</p>);
    const L = { sale: 'فاتورة بيع', purchase: 'فاتورة شراء', return: `مرتجع ${X.rt === 'purchase' ? 'شراء' : 'بيع'}`, expense: 'مصروف', product: 'صنف جديد', contact: 'عميل/مورد' }[X.intent];
    const info = [
      X.person && `الجهة: ${X.person}`,
      X.qty != null && `الكمية: ${X.qty}`,
      X.price != null && `السعر: ${X.price}`,
      X.paid != null && `المدفوع: ${X.paid}`,
      X.amount && `المبلغ: ${X.amount}`,
      X.name && `الاسم: ${X.name}`,
    ]
      .filter(Boolean)
      .join(' • ');
    const trade = X.intent === 'sale' || X.intent === 'purchase' || X.intent === 'return';
    setRes(
      <>
        <div style={{ background: 'var(--tint2)', padding: 10, borderRadius: 12 }}>
          <b>{L}</b>
          <div style={{ fontSize: 13, marginTop: 4 }}>{info || '—'}</div>
        </div>
        {X.cands.length ? (
          <>
            <p style={{ margin: '6px 0' }}>اختار الصنف:</p>
            {X.cands.map((p) => (
              <button key={p.id} type="button" className="secondary" style={{ width: '100%', marginBottom: 6, textAlign: 'right' }} onClick={() => voiceGo(X, p)}>
                {p.name}{' '}
                <small>
                  ({p.qty} {p.unit})
                </small>
              </button>
            ))}
          </>
        ) : trade ? (
          <>
            <p style={{ color: 'var(--danger)' }}>مالقيتش صنف مطابق — عدّل الكلام أو افتح النموذج واختار بإيدك.</p>
            <button type="button" className="secondary" style={{ width: '100%' }} onClick={() => voiceGo(X, null)}>
              افتح النموذج
            </button>
          </>
        ) : (
          <button type="button" className="primary" style={{ width: '100%' }} onClick={() => voiceGo(X, null)}>
            افتح النموذج
          </button>
        )}
        <p style={{ fontSize: 12, color: '#7a8a8f' }}>هيفتحلك النموذج متعبّي، راجعه واضغط حفظ.</p>
      </>,
    );
  };

  /** voiceParse بآخر شكل: الأوامر بالأسماء الأول، ولو فيه أرقام أو أصناف يرجع للطريقة القديمة. */
  const run = () => {
    const raw = txtRef.current;
    if (!raw.trim()) return;
    const t = VN(raw);
    const hit = findCmd(cmds, t);
    if (!hit) return showBase();
    const rest = ` ${t} `
      .replace(` ${hit.p} `, ' ')
      .trim()
      .split(' ')
      .filter((w) => w && !FILL.has(w))
      .join(' ');
    if (/\d/.test(rest)) return showBase(); // فيه أرقام = أمر مفصّل بالأصناف → الطريقة القديمة
    const k = hit.k;
    const T = ctypeOf(k);
    if (!rest) {
      if (k === 'sale' || k === 'purchase') return openTx(k);
      return setRes(
        <p>
          قول الاسم كمان: «{hit.p} + اسم {T === 'CUSTOMER' ? 'العميل' : 'المورد'}»
        </p>,
      );
    }
    const C = (T === 'CUSTOMER' ? customers : suppliers)
      .map((c) => ({ c, s: sim(rest, c.name) }))
      .filter((x) => x.s >= 0.55)
      .sort((a, b) => b.s - a.s);
    if (!C.length) {
      if ((k === 'sale' || k === 'purchase') && prods.some((p) => sim(rest, p.name) >= 0.7)) return showBase();
      return setRes(
        <>
          <p style={{ color: 'var(--danger)' }}>
            مالقيتش {T === 'CUSTOMER' ? 'عميل' : 'مورد'} اسمه «{rest}».
          </p>
          {(k === 'sale' || k === 'purchase') && (
            <button type="button" className="secondary" style={{ width: '100%' }} onClick={() => openTx(k)}>
              افتح فاتورة جديدة
            </button>
          )}
        </>,
      );
    }
    const ex = C.filter((x) => norm(x.c.name) === norm(rest));
    if (ex.length === 1) return void go(k, ex[0]!.c);
    if (C.length === 1 || (C[0]!.s >= 0.8 && C[0]!.s - C[1]!.s >= 0.15)) return void go(k, C[0]!.c);
    setRes(
      <>
        <div style={{ background: 'var(--tint2)', padding: 10, borderRadius: 12 }}>
          <b>{LAB[k]}</b> — مين تقصد؟
        </div>
        {C.slice(0, 6).map((x) => (
          <button key={x.c.id} type="button" className="secondary" style={{ width: '100%', marginTop: 6, textAlign: 'right' }} onClick={() => void go(k, x.c)}>
            {x.c.name}
            {x.c.phone && (
              <>
                {' '}
                <small dir="ltr">{x.c.phone}</small>
              </>
            )}
          </button>
        ))}
      </>,
    );
  };
  runRef.current = run;

  return (
    <Modal title="أمر صوتي" onClose={bye}>
      <textarea
        id="vtxt"
        rows={3}
        style={{ width: '100%', padding: 10, border: '1px solid var(--border)', borderRadius: 12 }}
        placeholder="اتكلم أو اكتب الأمر هنا"
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
        <button type="button" id="vmic" className="primary" style={{ flex: 1 }} onClick={toggle}>
          {listening ? '⏹ إيقاف' : '🎤 ابدأ الكلام'}
        </button>
        <button type="button" className="secondary" onClick={run}>
          نفّذ
        </button>
      </div>
      <div id="vres">{res}</div>
      <button
        type="button"
        id="vcBtn"
        className="secondary"
        style={{ width: '100%', marginTop: 6 }}
        onClick={() => {
          stop();
          open({ kind: 'voiceCfg' });
        }}
      >
        ⚙️ كلمات الأوامر
      </button>
      <p style={{ fontSize: 12, color: '#7a8a8f' }}>جديد: «فاتورة بيع المهندس رضا» بتفتح فاتورته، «كشف حساب أحمد»، «تحصيل من علي»، «سداد السبتية».</p>
      <p style={{ fontSize: 12, color: '#7a8a8f' }}>
        أمثلة: «فاتورة بيع لعلاء ٣ سفلي دانكو بسعر ٢٦٠ ودفع ٥٠٠» — «شراء من الديب ١٠ سفلي دانكو بسعر ٢٥٠» — «مصروف كهرباء ٣٠٠» — «مرتجع بيع ٢ سفلي دانكو» — «ضيف صنف اسمه كذا سعر الشراء ٥٠ سعر البيع ٧٠» — «عميل جديد محمد»
      </p>
    </Modal>
  );
}

/** ⚙️ كلمات الأوامر الصوتية (mkVoiceCfg). */
export function VoiceCfg() {
  const { close } = useModal();
  const toast = useToast();
  const qc = useQueryClient();
  const cmds = useVoiceCmds();
  const [v, setV] = useState<Record<CmdKey, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const cur = v ?? (cmds.data ? (Object.fromEntries((Object.keys(DEF) as CmdKey[]).map((k) => [k, cmds.data![k].join(' / ')])) as Record<CmdKey, string>) : null);
  const save = async () => {
    if (!cur) return;
    const out = {} as Cmds;
    (Object.keys(DEF) as CmdKey[]).forEach((k) => {
      const w = cur[k]
        .split('/')
        .map((x) => x.trim())
        .filter(Boolean);
      out[k] = w.length ? w : DEF[k];
    });
    setSaving(true);
    try {
      await api.put('/work/kv/voice_cmds', { value: out });
      qc.setQueryData(['kv', 'voice_cmds'], out);
      close();
      toast('✔ اتحفظت كلمات الأوامر');
    } catch (e) {
      setSaving(false);
      toast(`ماتحفظش: ${errorMessage(e)}`, 'bad');
    }
  };
  return (
    <Modal title="⚙️ كلمات الأوامر الصوتية" onClose={close}>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 8px' }}>لكل أمر اكتب الكلمات اللي تفتحه، وبينها شرطة مايلة / . بعد الكلمة قول اسم العميل أو المورد. (مفيش أسماء عملاء هنا)</p>
      {cur &&
        (Object.keys(DEF) as CmdKey[]).map((k) => (
          <div key={k} className="field full" style={{ marginBottom: 8 }}>
            <label>{LAB[k]}</label>
            <input value={cur[k]} onChange={(e) => setV({ ...cur, [k]: e.target.value })} />
          </div>
        ))}
      <div className="modal-foot">
        <button type="button" className="primary" disabled={saving || !cur} onClick={save}>
          {saving ? 'جاري الحفظ...' : '💾 حفظ'}
        </button>
        <button type="button" className="secondary" onClick={() => setV(Object.fromEntries((Object.keys(DEF) as CmdKey[]).map((k) => [k, DEF[k].join(' / ')])) as Record<CmdKey, string>)}>
          رجّع الافتراضي
        </button>
      </div>
    </Modal>
  );
}
