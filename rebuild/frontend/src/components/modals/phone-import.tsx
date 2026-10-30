'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { vn } from '@/lib/import-daily';
import { useAllContacts, useCreateContact } from '@/lib/trade-queries';
import { loadXlsx } from '@/components/daybook/import-daily';

/**
 * 📇 استيراد الأسامي من التليفون (vCard .vcf / Excel / CSV): الأسامي بتتحط في قايمة مراجعة على الجهاز —
 * كل اسم لوحده تعدّله، تختار عميل أو مورد، وتحفظ. القايمة بتفضل لحد ما تخلّصها.
 */
const KEY = 'mk_ct_import';
type Type = 'CUSTOMER' | 'SUPPLIER';
interface Item {
  k: string;
  name: string;
  phone: string;
  phone2: string;
  addr: string;
  note: string;
  t: string;
}
interface Found {
  name: string;
  phones: string[];
  note: string;
  addr: string;
  org?: string;
}

const load = (): Item[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
};
const store = (L: Item[], toast: (m: string, t?: 'bad') => void) => {
  try {
    if (L.length) localStorage.setItem(KEY, JSON.stringify(L));
    else localStorage.removeItem(KEY);
  } catch {
    toast('القايمة كبيرة على الجهاز — احفظ جزء الأول', 'bad');
  }
};
export const phoneImportCount = () => {
  try {
    return load().length;
  } catch {
    return 0;
  }
};

const digits = (s: unknown) => String(s ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d+]/g, '');
function normPhone(p: unknown) {
  let d = digits(p);
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('0020')) d = d.slice(4);
  else if (d.startsWith('20') && d.length === 12) d = d.slice(2);
  if (d.length === 10 && d[0] === '1') d = `0${d}`;
  return d;
}
const tail = (p: unknown) => normPhone(p).slice(-9);

// ---------- reading the files ----------
const qp = (s: string) => s.replace(/=\r?\n/g, '').replace(/(=[0-9A-F]{2})+/gi, (m) => {
  try {
    return decodeURIComponent(m.replace(/=/g, '%'));
  } catch {
    return m;
  }
});
function parseVcf(text: string): Found[] {
  const out: Found[] = [];
  const txt = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  for (const card of txt.split(/BEGIN:VCARD/i).slice(1)) {
    let fn = '';
    let n = '';
    let org = '';
    let note = '';
    let adr = '';
    const tels: string[] = [];
    for (const line of card.split(/\r?\n/)) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const k = line.slice(0, i).toUpperCase();
      let v = line.slice(i + 1);
      if (/QUOTED-PRINTABLE/.test(k)) v = qp(v);
      v = v.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, ' ').trim();
      const key = k.split(';')[0]!.replace(/^ITEM\d+\./, '');
      if (key === 'FN') fn = v;
      else if (key === 'N') n = v.split(';').filter(Boolean).reverse().join(' ');
      else if (key === 'ORG') org = v.replace(/;/g, ' ').trim();
      else if (key === 'TEL' && v) tels.push(v);
      else if (key === 'NOTE') note = v;
      else if (key === 'ADR') adr = v.split(';').filter(Boolean).join('، ');
    }
    const name = (fn || n || org || '').trim();
    if (name || tels.length) out.push({ name: name || tels[0]!, phones: tels, note, addr: adr, org });
  }
  return out;
}
function rowsToContacts(rows: unknown[][]): Found[] {
  if (!rows.length) return [];
  const H = rows[0]!.map((h) => String(h ?? '').trim());
  const find = (re: RegExp) => H.findIndex((h) => re.test(h));
  let iName = find(/^(name|display name|full name|الاسم|اسم)$/i);
  const iFirst = find(/first name|given|الاسم الأول/i);
  const iLast = find(/last name|family|اسم العائلة/i);
  const iOrg = find(/organi[sz]ation|company|شركة/i);
  let iPh = H.map((h, i) => (/phone|mobile|tel|موبايل|تليفون|هاتف|رقم/i.test(h) && !/type|label|نوع/i.test(h) ? i : -1)).filter((i) => i >= 0);
  const iNote = find(/^notes?$|ملاحظ/i);
  const iAddr = find(/address.*(formatted|street)|^address|عنوان/i);
  let body = rows.slice(1);
  if (iName < 0 && iFirst < 0 && !iPh.length) {
    iName = 0; // a file with no headers: the name, then the number
    iPh = [1];
    body = rows;
  }
  return body
    .map((r) => {
      const nm = iName >= 0 ? r[iName] : [r[iFirst], r[iLast]].filter(Boolean).join(' ');
      const phones = iPh
        .flatMap((i) => String(r[i] ?? '').split(/\s*:::\s*|[,;/]/))
        .map((x) => x.trim())
        .filter((x) => digits(x).length >= 7);
      return { name: String(nm || (iOrg >= 0 ? r[iOrg] : '') || '').trim(), phones, note: iNote >= 0 ? String(r[iNote] || '') : '', addr: iAddr >= 0 ? String(r[iAddr] || '') : '' };
    })
    .filter((c) => c.name || c.phones.length);
}
async function readFile(f: File): Promise<Found[]> {
  const nm = f.name.toLowerCase();
  if (nm.endsWith('.vcf') || nm.endsWith('.vcard') || f.type === 'text/vcard' || f.type === 'text/x-vcard') return parseVcf(await f.text());
  if (nm.endsWith('.csv') || nm.endsWith('.txt')) {
    const t = await f.text();
    if (/BEGIN:VCARD/i.test(t)) return parseVcf(t);
    try {
      const X = await loadXlsx();
      const wb = X.read(t, { type: 'string' });
      return rowsToContacts(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]!], { header: 1, raw: false }));
    } catch {
      return rowsToContacts(t.split(/\r?\n/).map((l) => l.split(',')));
    }
  }
  const X = await loadXlsx();
  const wb = X.read(await f.arrayBuffer(), { type: 'array' });
  return rowsToContacts(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]!], { header: 1, raw: false }));
}

// ---------- the window ----------
export function PhoneImport({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const create = useCreateContact();
  const customers = useAllContacts('CUSTOMER').data ?? [];
  const suppliers = useAllContacts('SUPPLIER').data ?? [];
  const [L, setL] = useState<Item[]>(load);
  const [view, setView] = useState<'list' | 'pick'>(() => (load().length ? 'list' : 'pick'));
  const [edit, setEdit] = useState<string | null>(null);
  const [tab, setTab] = useState<'new' | 'dup'>('new');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const have = useMemo(() => new Set([...customers, ...suppliers].map((c) => tail(c.phone)).filter(Boolean)), [customers, suppliers]);
  const names = useMemo(() => ({ CUSTOMER: new Set(customers.map((c) => vn(c.name))), SUPPLIER: new Set(suppliers.map((c) => vn(c.name))) }), [customers, suppliers]);
  const isDup = (x: Item) => !!x.t && have.has(x.t);
  const keep = (next: Item[]) => {
    setL(next);
    store(next, toast);
  };

  const add = (found: Found[]) => {
    const seen = new Set(L.map((x) => x.t).filter(Boolean));
    const next = [...L];
    let n = 0;
    let dup = 0;
    for (const c of found) {
      const ph = normPhone(c.phones[0] ?? '');
      const t = ph.slice(-9);
      if (t && seen.has(t)) continue;
      if (t) seen.add(t);
      if (t && have.has(t)) dup++;
      next.push({ k: Math.random().toString(36).slice(2, 10), name: c.name.replace(/\s+/g, ' ').trim(), phone: ph, phone2: normPhone(c.phones[1] ?? ''), addr: c.addr || '', note: [c.org, c.note].filter(Boolean).join(' — '), t });
      n++;
    }
    keep(next);
    toast(`✔ اتضاف ${n} اسم للقايمة${dup ? ` — منهم ${dup} متسجلين قبل كده` : ''}`);
  };

  const commit = async (items: { k: string; name: string; phone: string; addr: string; note: string }[], type: Type) => {
    setBusy(true);
    const done = new Set<string>();
    const skip: string[] = [];
    let ok = 0;
    for (const it of items) {
      const nm = it.name.trim();
      if (!nm) {
        skip.push('(من غير اسم)');
        continue;
      }
      if (names[type].has(vn(nm))) {
        skip.push(nm);
        continue;
      }
      try {
        await create.mutateAsync({ type, name: nm, phone: it.phone, address: it.addr, note: it.note, openingBalance: 0 });
        names[type].add(vn(nm));
        done.add(it.k);
        ok++;
      } catch (e) {
        skip.push(`${nm} (${errorMessage(e)})`);
      }
    }
    keep(L.filter((x) => !done.has(x.k)));
    setSel((s) => new Set([...s].filter((k) => !done.has(k))));
    setBusy(false);
    if (ok) toast(`✔ اتحفظ ${ok} في ${type === 'SUPPLIER' ? 'الموردين' : 'العملاء'}`);
    if (skip.length) toast(`ما اتحفظوش: ${skip.slice(0, 3).join('، ')}${skip.length > 3 ? '…' : ''}`, 'bad');
    return ok > 0 || !skip.length;
  };
  const asItem = (x: Item) => ({ k: x.k, name: x.name, phone: x.phone, addr: x.addr, note: [x.note, x.phone2 ? `رقم تاني: ${x.phone2}` : ''].filter(Boolean).join(' — ') });
  const drop = (ks: string[]) => {
    if (!ks.length) return toast('حدد أسامي الأول', 'bad');
    const s = new Set(ks);
    const next = L.filter((x) => !s.has(x.k));
    keep(next);
    setSel((o) => new Set([...o].filter((k) => !s.has(k))));
    if (!next.length) onClose();
  };

  if (view === 'pick')
    return (
      <Modal title="📇 استيراد الأسامي من التليفون" onClose={onClose}>
        <div style={{ background: 'var(--tint2,#eef6f7)', borderRadius: 12, padding: '10px 12px', fontSize: 13.5, lineHeight: 1.9, marginBottom: 10 }}>
          <b>📱 آيفون:</b> افتح «جهات الاتصال» ← «القوائم» فوق ← اضغط ضغطة طويلة على «كل جهات الاتصال» ← «تصدير» ← احفظه في «الملفات».
          <br />
          <b>🤖 أندرويد:</b> افتح «جهات الاتصال» ← الإعدادات ← «تصدير» ← هيعمل ملف <span dir="ltr">.vcf</span>.
          <br />
          <b>💻 جوجل:</b> contacts.google.com ← تصدير ← <span dir="ltr">Google CSV</span>. وكمان ينفع شيت إكسيل فيه عمود للاسم وعمود للرقم.
        </div>
        <label className="primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 16, borderRadius: 14, cursor: 'pointer', fontWeight: 800, background: 'var(--blue)', color: '#fff' }}>
          📂 اختار الملف
          <input
            type="file"
            accept=".vcf,.vcard,text/vcard,text/x-vcard,.csv,.txt,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setMsg('⏳ بنقرا الملف...');
              try {
                const found = await readFile(f);
                if (!found.length) return setMsg('مالقيناش أسامي في الملف ده');
                add(found);
                setTab('new');
                setQ('');
                setSel(new Set());
                setMsg('');
                setView('list');
              } catch (x) {
                setMsg(`⚠️ ${errorMessage(x)}`);
              }
            }}
          />
        </label>
        <p style={{ color: 'var(--muted)', textAlign: 'center', margin: '10px 0 0' }}>{msg}</p>
        {L.length > 0 && (
          <div className="modal-foot">
            <button type="button" className="secondary" onClick={() => setView('list')}>
              رجوع للقايمة ({L.length})
            </button>
          </div>
        )}
      </Modal>
    );

  const cur = edit ? L.find((x) => x.k === edit) : null;
  if (cur) return <EditItem x={cur} dup={isDup(cur)} busy={busy} onBack={() => setEdit(null)} onDrop={() => { setEdit(null); drop([cur.k]); }} onSave={async (v, type) => { if (await commit([asItem({ ...cur, ...v })], type)) setEdit(null); }} />;

  const nNew = L.filter((x) => !isDup(x)).length;
  const S = L.filter((x) => (tab === 'dup' ? isDup(x) : !isDup(x))).filter((x) => !q || vn(`${x.name} ${x.phone}`).includes(vn(q)));
  const shown = S.slice(0, 300);
  return (
    <Modal title={`📇 أسامي التليفون (${L.length})`} onClose={onClose} wide>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <button type="button" className={tab === 'new' ? 'primary' : 'secondary'} onClick={() => { setTab('new'); setSel(new Set()); }}>
          جديدة ({nNew})
        </button>
        <button type="button" className={tab === 'dup' ? 'primary' : 'secondary'} onClick={() => { setTab('dup'); setSel(new Set()); }}>
          متسجلة قبل كده ({L.length - nNew})
        </button>
        <input placeholder="🔎 دوّر بالاسم أو الرقم" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 150, padding: 9, border: '1px solid var(--border)', borderRadius: 10 }} />
      </div>
      {shown.length ? (
        shown.map((x) => (
          <div key={x.k} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 8, alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
            <input
              type="checkbox"
              checked={sel.has(x.k)}
              onChange={(e) =>
                setSel((s) => {
                  const n = new Set(s);
                  if (e.target.checked) n.add(x.k);
                  else n.delete(x.k);
                  return n;
                })
              }
            />
            <div onClick={() => setEdit(x.k)} style={{ cursor: 'pointer', minWidth: 0 }}>
              <b>{x.name || '(من غير اسم)'}</b> {isDup(x) && <span className="badge">متسجل</span>}
              <br />
              <small dir="ltr">
                {x.phone || '—'}
                {x.phone2 ? ` • ${x.phone2}` : ''}
              </small>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button type="button" className="secondary" onClick={() => setEdit(x.k)}>
                ✏️ فتح
              </button>
              <button type="button" className="secondary" disabled={busy} onClick={() => commit([asItem(x)], 'CUSTOMER')}>
                👤 عميل
              </button>
              <button type="button" className="secondary" disabled={busy} onClick={() => commit([asItem(x)], 'SUPPLIER')}>
                🏭 مورد
              </button>
              <button type="button" className="secondary" title="شيله من القايمة" onClick={() => drop([x.k])}>
                ✕
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="empty">مفيش أسامي هنا</div>
      )}
      {S.length > 300 && <p style={{ color: 'var(--muted)', textAlign: 'center' }}>بيظهر أول 300 — استخدم البحث</p>}
      <div style={{ position: 'sticky', bottom: 0, background: 'var(--card)', borderTop: '1px solid var(--border)', padding: '10px 4px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={shown.length > 0 && shown.every((x) => sel.has(x.k))}
            onChange={(e) => setSel(e.target.checked ? new Set(shown.map((x) => x.k)) : new Set())}
          />{' '}
          الكل
        </label>
        <span style={{ color: 'var(--muted)' }}>{sel.size ? `${sel.size} محدد` : ''}</span>
        <button type="button" className="primary" disabled={busy} onClick={() => (sel.size ? commit(L.filter((x) => sel.has(x.k)).map(asItem), 'CUSTOMER') : toast('حدد أسامي الأول', 'bad'))}>
          حفظ المحددين عملاء
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={() => (sel.size ? commit(L.filter((x) => sel.has(x.k)).map(asItem), 'SUPPLIER') : toast('حدد أسامي الأول', 'bad'))}>
          موردين
        </button>
        <button type="button" className="secondary" onClick={() => drop([...sel])}>
          شيل المحددين
        </button>
        <button type="button" className="secondary" style={{ marginInlineStart: 'auto' }} onClick={() => setView('pick')}>
          ➕ ملف تاني
        </button>
      </div>
    </Modal>
  );
}

function EditItem({ x, dup, busy, onBack, onDrop, onSave }: { x: Item; dup: boolean; busy: boolean; onBack: () => void; onDrop: () => void; onSave: (v: Partial<Item>, type: Type) => Promise<void> }) {
  const [v, setV] = useState({ name: x.name, phone: x.phone, phone2: x.phone2, addr: x.addr, note: x.note });
  const [type, setType] = useState<Type>('CUSTOMER');
  return (
    <Modal title={`✏️ ${x.name || 'اسم جديد'}`} onClose={onBack}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({ ...v, phone: normPhone(v.phone) }, type);
        }}
      >
        <div className="form">
          <div className="field">
            <label>الاسم</label>
            <input required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </div>
          <div className="field">
            <label>النوع</label>
            <select value={type} onChange={(e) => setType(e.target.value as Type)}>
              <option value="CUSTOMER">عميل</option>
              <option value="SUPPLIER">مورد</option>
            </select>
          </div>
          <div className="field">
            <label>الموبايل</label>
            <input dir="ltr" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
          </div>
          <div className="field">
            <label>رقم تاني</label>
            <input dir="ltr" inputMode="tel" value={v.phone2} onChange={(e) => setV({ ...v, phone2: e.target.value })} />
          </div>
          <div className="field full">
            <label>العنوان</label>
            <input value={v.addr} onChange={(e) => setV({ ...v, addr: e.target.value })} />
          </div>
          <div className="field full">
            <label>ملاحظات</label>
            <input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
          </div>
        </div>
        {dup && <p style={{ color: '#8a4b00', margin: '8px 0 0' }}>⚠️ الرقم ده متسجل عندك قبل كده</p>}
        <div className="modal-foot">
          <button className="primary" disabled={busy}>
            💾 حفظ
          </button>
          <button type="button" className="secondary" onClick={onDrop}>
            شيله
          </button>
          <button type="button" className="secondary" onClick={onBack}>
            رجوع
          </button>
        </div>
      </form>
    </Modal>
  );
}
