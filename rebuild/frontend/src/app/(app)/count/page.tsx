'use client';

import { useEffect, useRef, useState } from 'react';
import { useShowMore } from '@/components/ui/tiles';
import type { ProductDto } from '@mk/shared';
import { AdminOnly } from '@/components/app-shell';
import { useModal } from '@/components/modals/modal-host';
import { Modal } from '@/components/ui/modal';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { serverNowIso, syncServerTime } from '@/lib/server-time';
import { money, qtyText } from '@/lib/format';
import { CameraScanner } from '@/components/scan/camera-scanner';
import { printHtml, reportHtml } from '@/lib/print';
import { useSettings } from '@/lib/queries';
import { vn } from '@/lib/import-daily';
import { lookupProduct, useAllProducts, useCategories, useCounts, useCreateCount, useProducts } from '@/lib/trade-queries';
import { Aka, akaHay } from '../../../components/ui/aka';

/** Same draft key as the old system, so a half-done count survives a reload. */
const CD = 'mk_count_draft';
interface DraftLine {
  v: string;
  name: string;
  code: string;
  cat: string;
  qty: number;
  cost: number;
  /** وقت العدّ بساعة السيرفر — الجرد بيتحسب على رصيد الوقت ده، فالبيع اللي بعده مايتمسحش */
  t?: string;
}
type Draft = Record<string, DraftLine>;

const readDraft = (): Draft => {
  try {
    const d = JSON.parse(localStorage.getItem(CD) || '{}') as Record<string, unknown>;
    // Old-format drafts (id → number) can't be valued without the product, so they are dropped.
    return Object.fromEntries(Object.entries(d).filter(([, v]) => v && typeof v === 'object')) as Draft;
  } catch {
    return {};
  }
};
const writeDraft = (d: Draft) => {
  try {
    localStorage.setItem(CD, JSON.stringify(d));
  } catch {
    /* private mode */
  }
};
const toWestern = (s: string) => s.replace(/[٠-٩]/g, (x) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)));
const r2 = (n: number) => Math.round(n * 100) / 100;
const has = (l: DraftLine | undefined) => !!l && l.v !== '';

function CountHistory({ onClose }: { onClose: () => void }) {
  const { open } = useModal();
  const list = useCounts();
  const L = list.data?.items ?? [];
  return (
    <Modal title="سجل الجرد" onClose={onClose} wide>
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorBox message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الرقم</th>
                <th>التاريخ</th>
                <th>أصناف</th>
                <th>عجز</th>
                <th>زيادة</th>
                <th>بواسطة</th>
              </tr>
            </thead>
            <tbody>
              {L.length ? (
                L.map((c) => (
                  <tr key={c.id} className="prow" onClick={() => open({ kind: 'countResult', count: c })}>
                    <td>
                      <b>{c.no}</b>
                    </td>
                    <td>{c.createdAt.slice(0, 10)}</td>
                    <td>{c.itemCount}</td>
                    <td style={{ color: 'var(--danger)' }}>{money(c.shortValue)}</td>
                    <td style={{ color: 'var(--green)' }}>{money(c.excessValue)}</td>
                    <td>{c.createdBy ?? ''}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">لسه مفيش جرد</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function CountScreen() {
  const toast = useToast();
  const { open } = useModal();
  const [draft, setDraft] = useState<Draft>({});
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [show, setShow] = useState<'all' | 'done' | 'diff'>('all');
  const [hit, setHit] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [scanning, setScanning] = useState(false);
  const settings = useSettings().data;
  const allProducts = useAllProducts({}, false);
  const [history, setHistory] = useState(false);
  const cats = useCategories();
  const products = useProducts({ q: q || undefined, category: cat || undefined, pageSize: 200 }, show === 'all');
  const save = useCreateCount();

  useEffect(() => {
    setDraft(readDraft());
    void syncServerTime();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 150);
    return () => clearTimeout(t);
  }, [text]);

  const update = (next: Draft) => {
    setDraft(next);
    writeDraft(next);
  };
  const setCount = (p: Pick<ProductDto, 'id' | 'name' | 'code' | 'category' | 'qty' | 'cost'>, v: string) =>
    update({ ...draft, [p.id]: { v: toWestern(v), name: p.name, code: p.code, cat: p.category ?? '', qty: p.qty, cost: p.cost ?? 0, t: serverNowIso() } });

  type Line = { id: string; name: string; code: string; cat: string; qty: number; cost: number; aka?: string[] };
  let lines: Line[];
  if (show === 'all') {
    lines = (products.data?.items ?? []).map((p) => ({ id: p.id, name: p.name, code: p.code, cat: p.category ?? '', qty: p.qty, cost: p.cost ?? 0, aka: p.aka }));
  } else {
    const words = q.toLowerCase().split(' ').filter(Boolean);
    lines = Object.entries(draft)
      .filter(([, l]) => has(l) && (show === 'done' || Number(l.v) !== l.qty))
      .filter(([, l]) => (!cat || l.cat === cat) && words.every((w) => `${l.name} ${l.code}`.toLowerCase().includes(w)))
      .map(([id, l]) => ({ id, name: l.name, code: l.code, cat: l.cat, qty: l.qty, cost: l.cost }));
  }
  if (hit) {
    const i = lines.findIndex((l) => l.id === hit);
    if (i > 0) lines.unshift(lines.splice(i, 1)[0]!);
  }
  // ٤٠ صنف في المرة: الشاشة خفيفة على الموبايل، والبحث والباركود شغالين على الكل (الصنف اللي اتمسح بيطلع فوق)
  const { shown: shownLines, more: moreLines } = useShowMore(lines, 40, `${show}|${q}|${cat}`);

  let n = 0;
  let sv = 0;
  let ev = 0;
  for (const l of Object.values(draft)) {
    if (!has(l)) continue;
    n++;
    const df = Number(l.v) - l.qty;
    if (df < 0) sv += -df * l.cost;
    else ev += df * l.cost;
  }

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const onCode = async (raw: string): Promise<boolean | string> => {
    const code = toWestern(raw.trim());
    try {
      const p = await lookupProduct(code);
      const cur = draftRef.current[p.id];
      const v = String((Number(cur?.v) || 0) + 1);
      const next = { ...draftRef.current, [p.id]: { v, name: p.name, code: p.code, cat: p.category ?? '', qty: p.qty, cost: p.cost ?? 0, t: serverNowIso() } };
      draftRef.current = next;
      update(next);
      setHit(p.id);
      return `${p.name} = ${v}`;
    } catch {
      toast(`باركود مش متسجل: ${code}`, 'bad');
      return false;
    }
  };

  /** 🖨️ ورقة جرد فاضية للعدّ باليد (حسب البحث والتصنيف). */
  const printSheet = async () => {
    if (!settings) return;
    const all = await allProducts.refetch();
    const w = vn(q).split(' ').filter(Boolean);
    const L = (all.data ?? []).filter((p) => (!cat || p.category === cat) && w.every((x) => vn(akaHay(p)).includes(x)));
    printHtml(
      reportHtml(
        {
          title: `ورقة جرد${cat ? ` — ${cat}` : ''}`,
          range: 'التاريخ: ........................   القائم بالجرد: ................................',
          sum: [],
          head: ['#', 'الكود', 'الصنف', 'الوحدة', 'في السيستم', 'العدد الفعلي', 'ملاحظات'],
          rows: L.map((p, i) => [String(i + 1), p.code, p.name, p.unit || '', String(p.qty), '☐', '']),
        },
        settings,
      ),
    );
  };

  const onSave = async () => {
    // كل صنف بيتحسب على رصيده وقت ما اتعدّ (لو مفيش وقت = مسودة قديمة: بنستخدم الرصيد اللي كان ظاهر وقتها)
    const items = Object.entries(draft)
      .filter(([, l]) => has(l))
      .map(([productId, l]) => ({ productId, counted: Number(l.v), ...(l.t ? { countedAt: l.t } : { baseline: l.qty }) }));
    if (!items.length) return toast('مفيش أصناف اتعدّت', 'bad');
    if (items.some((i) => !Number.isFinite(i.counted) || i.counted < 0)) return toast('فيه عدد مش مظبوط — راجع الأرقام', 'bad');
    try {
      await syncServerTime();
      const pv = await api.post<{ lines: { name: string; current: number; before: number; counted: number; diff: number; after: number }[]; negative: { name: string; after: number }[] }>('/counts/preview', { items });
      const ch = pv.lines.filter((x) => x.diff !== 0);
      const moved = pv.lines.filter((x) => r2(x.current - x.before) !== 0).length;
      const msg = [
        `حفظ الجرد لـ ${items.length} صنف؟`,
        `• ${ch.length} صنف فيه فرق عن السيستم وقت العد، والباقي مظبوط`,
        moved ? `• ${moved} صنف اتباع أو اتشترى منه بعد ما اتعدّ — الحركة دي محسوبة ومش هتتمسح` : '',
        ...ch.slice(0, 8).map((x) => `- ${x.name}: عددت ${x.counted} والسيستم كان ${x.before} (${x.diff > 0 ? '+' : ''}${x.diff}) ← الرصيد بعد الحفظ ${x.after}`),
        ch.length > 8 ? '...' : '',
        pv.negative.length ? `⚠️ ${pv.negative.length} صنف هيطلع رصيده بالسالب (بيع أكتر من المعدود) — راجعهم: ${pv.negative.slice(0, 4).map((x) => x.name).join('، ')}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      if (!window.confirm(msg)) return;
      const c = await save.mutateAsync({ items, note: note.trim() });
      update({});
      setNote('');
      open({ kind: 'countResult', count: c });
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  return (
    <>
      <div className="title-row">
        <div className="title">
          <h1>🧮 الجرد</h1>
          <p>عدّ الأصناف (أو امسحها بالباركود)، والسيستم يقولك العجز والزيادة ويظبط المخزون</p>
        </div>
        <div className="btnrow">
          <button type="button" className="secondary" onClick={() => open({ kind: 'countSessions' })}>
            🗂️ جلسات الجرد (على أكتر من يوم)
          </button>
          <button type="button" className="secondary" onClick={() => void printSheet()}>
            🖨️ ورقة جرد
          </button>
          <button type="button" className="secondary" onClick={() => setHistory(true)}>
            سجل الجرد
          </button>
          <button type="button" className="primary" onClick={() => setScanning(true)}>
            📷 جرد بالباركود
          </button>
        </div>
      </div>
      <div className="toolbar">
        <input className="search" placeholder="ابحث بالاسم أو الكود..." value={text} onChange={(e) => (setText(e.target.value), setHit(null))} />
        <select className="search" style={{ maxWidth: 180 }} value={cat} onChange={(e) => (setCat(e.target.value), setHit(null))}>
          <option value="">كل التصنيفات</option>
          {cats.data?.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="search" style={{ maxWidth: 160 }} value={show} onChange={(e) => (setShow(e.target.value as typeof show), setHit(null))}>
          <option value="all">كل الأصناف</option>
          <option value="done">اللي اتعدّ بس</option>
          <option value="diff">اللي فيه فرق</option>
        </select>
      </div>
      {scanning && <CameraScanner multi title="جرد بالباركود — كل مسحة = قطعة" onClose={() => setScanning(false)} onCode={onCode} />}
      <div className="card" style={{ padding: 0 }}>
        <div className="cnt-row" style={{ fontSize: 12, color: 'var(--muted)', background: '#fafcfc' }}>
          <div>الصنف</div>
          <div style={{ textAlign: 'center' }}>في السيستم</div>
          <div style={{ textAlign: 'center' }}>العدد الفعلي</div>
          <div style={{ textAlign: 'center' }}>الفرق</div>
        </div>
        <div>
          {show === 'all' && products.isPending ? (
            <Loading />
          ) : show === 'all' && products.isError ? (
            <ErrorBox message={errorMessage(products.error)} onRetry={() => products.refetch()} />
          ) : lines.length ? (
            shownLines.map((p) => {
              const l = draft[p.id];
              const base = has(l) ? l!.qty : p.qty; // رصيد السيستم وقت العد
              const df = has(l) ? r2(Number(l!.v) - base) : null;
              const mv = has(l) ? r2(p.qty - base) : 0; // بيع/شراء حصل بعد العد
              return (
                <div key={p.id} className={`cnt-row${hit === p.id ? ' hit' : ''}`}>
                  <div style={{ minWidth: 0 }}>
                    <b>{p.name}</b>
                    <Aka p={p} />
                    <br />
                    <small style={{ color: 'var(--muted)' }}>
                      {p.code}
                      {p.cat ? ` • ${p.cat}` : ''}
                    </small>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    {qtyText(p.qty)}
                    {mv !== 0 && (
                      <small style={{ display: 'block', color: '#d97706' }} title="بيع أو شراء حصل بعد ما عدّيته — محسوب في الحفظ">
                        اتحرك {mv > 0 ? '+' : ''}
                        {mv} بعد العد
                      </small>
                    )}
                  </div>
                  <input
                    inputMode="decimal"
                    value={l?.v ?? ''}
                    placeholder="العدد"
                    onChange={(e) => setCount({ id: p.id, name: p.name, code: p.code, category: p.cat, qty: p.qty, cost: p.cost }, e.target.value)}
                  />
                  <div
                    style={{
                      textAlign: 'center',
                      fontWeight: 700,
                      color: df === null ? 'inherit' : df < 0 ? 'var(--danger)' : df > 0 ? 'var(--green)' : 'inherit',
                    }}
                  >
                    {df === null ? '' : df > 0 ? `+${df}` : df}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty">مفيش أصناف</div>
          )}
          {moreLines}
          {show === 'all' && (products.data?.total ?? 0) > 200 && (
            <p style={{ color: 'var(--muted)', fontSize: 12, padding: 8 }}>ظاهر أول 200 — استخدم البحث أو التصنيف</p>
          )}
        </div>
        <div className="cnt-foot">
          <div className="cf">
            اتعدّ <b>{n}</b> صنف — عجز <b style={{ color: 'var(--danger)' }}>{money(sv)}</b> — زيادة{' '}
            <b style={{ color: 'var(--green)' }}>{money(ev)}</b>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              placeholder="ملاحظة (اختياري)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ padding: 9, border: '1px solid var(--border)', borderRadius: 10 }}
            />
            <button
              type="button"
              className="secondary danger"
              onClick={() => window.confirm('مسح كل الأعداد اللي كتبتها في الجرد ده؟') && update({})}
            >
              مسح المسودة
            </button>
            <button type="button" className="primary" disabled={save.isPending} onClick={onSave}>
              ✔ حفظ الجرد
            </button>
          </div>
        </div>
      </div>
      {history && <CountHistory onClose={() => setHistory(false)} />}
    </>
  );
}

export default function CountPage() {
  return (
    <AdminOnly>
      <CountScreen />
    </AdminOnly>
  );
}
