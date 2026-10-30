'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { InvoiceDto, Paginated } from '@mk/shared';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { waNum } from '@/components/hy/ui';
import { useModal } from '@/components/modals/modal-host';
import { Modal } from '@/components/ui/modal';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useAllProducts } from '@/lib/trade-queries';
import { usePatchWebCustom, usePatchWebOrder, usePatchWebRequest, useWebCustom, useWebOrders, useWebRequests, type WebCustomRow, type WebOrderRow, type WebRequestRow } from '@/lib/web-queries';

/** 🛒 طلبات الموقع: الطلبات اللي العملاء بعتوها من الموقع — حوّلها لفاتورة بضغطة. */
const ETAS = ['النهارده', 'بكره إن شاء الله', 'بعد يومين', 'خلال 3 لـ 5 أيام', 'أول ما المنتج يوصلنا هنكلمك'];
type Tab = 'new' | 'done' | 'other';

const waLink = (phone: string, text: string) => {
  const n = waNum(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : '';
};

function EtaModal({ o, names, onClose }: { o: WebOrderRow; names: (code: string) => string; onClose: () => void }) {
  const toast = useToast();
  const patch = usePatchWebOrder();
  const back = o.items.some((x) => x.backorder);
  const [pick, setPick] = useState(back ? '4' : '1');
  const [custom, setCustom] = useState('');
  const [extra, setExtra] = useState('');
  const sid = o.id.slice(0, 8);

  const go = async () => {
    const t = pick === 'c' ? custom.trim() : ETAS[+pick];
    if (!t) return toast('اختار أو اكتب الميعاد', 'bad');
    const lines = o.items.map((x) => `${names(x.code)} × ${x.qty}`).join('\n');
    const msg = `أهلاً ${o.customerName} 👋\nطلبك رقم ${sid} من ميكانيزم اتأكد ✅\n\n${lines}\n\n📅 الاستلام: ${t}${extra.trim() ? `\n${extra.trim()}` : ''}\n\nلو عندك أي سؤال ردّ علينا هنا.`;
    const wa = o.phone ? waLink(o.phone, msg) : '';
    // open WhatsApp first so the browser doesn't block the window, then save the answer on the order
    const win = wa ? window.open(wa, '_blank') : null;
    try {
      await patch.mutateAsync({ id: o.id, eta: t });
    } catch (e) {
      toast(`الميعاد ماتسجلش: ${errorMessage(e)}`, 'bad');
    }
    onClose();
    if (wa) {
      if (!win) window.location.href = wa;
    } else {
      try {
        await navigator.clipboard.writeText(msg);
        toast('العميل مالوش رقم — الرسالة اتنسخت');
      } catch {
        toast('العميل مالوش رقم موبايل', 'bad');
      }
    }
  };

  return (
    <Modal title={`📅 ميعاد الاستلام لـ ${o.customerName}`} onClose={onClose}>
      {back && <p style={{ marginTop: 0, color: 'var(--danger)' }}>⏳ الطلب فيه أصناف مش متوفرة دلوقتي.</p>}
      <div style={{ display: 'grid', gap: 8 }}>
        {ETAS.map((t, i) => (
          <label key={t} className="chk" style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
            <input type="radio" name="eta" checked={pick === String(i)} onChange={() => setPick(String(i))} /> {t}
          </label>
        ))}
        <label className="chk" style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
          <input type="radio" name="eta" checked={pick === 'c'} onChange={() => setPick('c')} /> ميعاد تاني:{' '}
          <input
            value={custom}
            placeholder="مثلاً: يوم الخميس"
            style={{ flex: 1, minWidth: 0 }}
            onChange={(e) => {
              setCustom(e.target.value);
              setPick('c');
            }}
          />
        </label>
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label>رسالة إضافية (اختياري)</label>
        <input value={extra} placeholder="مثلاً: التوصيل 50 ج.م" onChange={(e) => setExtra(e.target.value)} />
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={patch.isPending} onClick={go}>
          💬 ابعت للعميل على الواتساب
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

type Found = { id: string; name: string; qty: number; price: number };

function OrderCard({ o, prod, onEta }: { o: WebOrderRow; prod: (code: string) => Found | undefined; onEta: () => void }) {
  const { open } = useModal();
  const toast = useToast();
  const patch = usePatchWebOrder();
  const sid = o.id.slice(0, 8);
  const rows = o.items.map((x) => ({ x, p: prod(x.code) }));
  const est = rows.reduce((s, r) => s + (r.p ? r.p.price * r.x.qty : 0), 0);
  const wa = o.phone ? waLink(o.phone, `أهلاً ${o.customerName}، بخصوص طلبك رقم ${sid} من موقع ميكانيزم`) : '';

  const invoice = () => {
    const missing = rows.filter((r) => !r.p).map((r) => r.x.code);
    if (missing.length) toast(`أكواد مش موجودة في السيستم: ${missing.join('، ')}`, 'bad');
    open({
      kind: 'transaction',
      type: 'SALE',
      preset: {
        person: o.customerName,
        phone: o.phone,
        note: `من طلب الموقع ${sid}`,
        online: true,
        onlineFrom: 'SITE',
        lines: rows.flatMap((r) => (r.p ? [{ productId: r.p.id, name: r.p.name, qty: r.x.qty, price: r.p.price }] : [])),
        onSaved: async (inv) => {
          await patch.mutateAsync({ id: o.id, status: 'done', invoiceNo: inv.no });
        },
      },
    });
  };

  const cancel = async () => {
    if (!window.confirm(`رفض طلب ${o.customerName}؟\nالكميات المحجوزة للطلب ده هترجع متاحة في الموقع.`)) return;
    try {
      await patch.mutateAsync({ id: o.id, status: 'cancelled' });
      toast('تم رفض الطلب');
    } catch (e) {
      toast(`تعذر رفض الطلب: ${errorMessage(e)}`, 'bad');
    }
  };

  const openInvoice = async () => {
    try {
      const r = await api.get<Paginated<InvoiceDto>>('/invoices', { kind: 'SALE', q: o.invoiceNo ?? '', pageSize: 5 });
      const inv = r.items.find((i) => i.no === o.invoiceNo);
      if (inv) open({ kind: 'invoice', id: inv.id });
      else toast('الفاتورة مش لاقيها (يمكن اتلغت)', 'bad');
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <b style={{ fontSize: 18 }}>{o.customerName}</b>
          {o.phone ? (
            <>
              {' — '}
              <span dir="ltr">{o.phone}</span>
            </>
          ) : null}
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>
            طلب رقم {sid} • {new Date(o.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        </div>
        {o.status === 'done' ? <span className="badge green">اتعملها فاتورة</span> : o.status === 'new' ? <span className="badge red">جديد</span> : <span className="badge">ملغي</span>}
      </div>
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table className="table" style={{ minWidth: 380 }}>
          <thead>
            <tr>
              <th>الصنف</th>
              <th>المطلوب</th>
              <th>في المخزن</th>
              <th>سعر البيع</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ x, p }, i) => (
              <tr key={i}>
                <td>
                  {p ? p.name : <span style={{ color: 'var(--danger)' }}>كود {x.code} مش موجود في السيستم</span>}
                  {x.backorder ? <span className="badge red"> ⏳ حجز — مش متوفر</span> : null}
                </td>
                <td>
                  <b>{x.qty}</b>
                </td>
                <td style={{ color: p && p.qty >= x.qty ? 'inherit' : 'var(--danger)' }}>{p ? p.qty : '—'}</td>
                <td>{p ? money(p.price) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ margin: '8px 0' }}>
        الإجمالي التقريبي: <b>{money(est)}</b>
      </div>
      {o.eta ? <div style={{ margin: '0 0 8px', color: 'var(--green)', fontWeight: 700 }}>📅 العميل اتبلّغ: {o.eta}</div> : null}
      <div className="btnrow">
        {o.status === 'new' && (
          <>
            <button type="button" className="primary" onClick={invoice}>
              🧾 تحويل لفاتورة بيع
            </button>
            <button type="button" className="secondary" onClick={onEta}>
              📅 رد بالميعاد
            </button>
            <button type="button" className="secondary danger" disabled={patch.isPending} onClick={cancel}>
              رفض الطلب
            </button>
          </>
        )}
        {o.status === 'done' && o.invoiceNo ? (
          <button type="button" className="secondary" onClick={openInvoice}>
            فتح الفاتورة {o.invoiceNo}
          </button>
        ) : null}
        {wa ? (
          <a className="secondary" style={{ textDecoration: 'none', padding: '10px 14px' }} target="_blank" rel="noopener" href={wa}>
            💬 واتساب العميل
          </a>
        ) : null}
      </div>
    </div>
  );
}

function OrdersList() {
  const [tab, setTab] = useState<Tab>('new');
  const [eta, setEta] = useState<WebOrderRow | null>(null);
  const [purging, setPurging] = useState(false);
  const toast = useToast();
  const list = useWebOrders();
  const products = useAllProducts({}, !!list.data?.length).data;
  const byCode = useMemo(() => new Map((products ?? []).map((p) => [String(p.code), p])), [products]);
  const prod = (code: string): Found | undefined => {
    const p = byCode.get(String(code));
    return p ? { id: p.id, name: p.name, qty: p.qty, price: p.price } : undefined;
  };
  const rows = (list.data ?? []).filter((o) => (tab === 'new' ? o.status === 'new' : tab === 'done' ? o.status === 'done' : o.status === 'cancelled'));
  const tabs: [Tab, string][] = [
    ['new', 'جديدة'],
    ['done', 'اتعملها فاتورة'],
    ['other', 'ملغية'],
  ];
  return (
    <>
      <div className="toolbar" id="woTabs">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" className={tab === k ? 'primary' : 'secondary'} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '-4px 0 10px' }}>
        <button
          type="button"
          className="secondary"
          style={{ color: 'var(--danger,#c0392b)' }}
          disabled={purging}
          onClick={async () => {
            if (!window.confirm('مسح كل الطلبات الملغية من «طلبات الموقع» نهائياً؟\nالطلبات الجديدة واللي اتعملها فاتورة مش هتتلمس، والفواتير نفسها مش هتتمسح.')) return;
            setPurging(true);
            try {
              const r = await api.post<{ count: number }>('/web/orders/purge-cancelled', {});
              toast(`🗑️ اتمسح ${r.count} طلب ملغي`);
              void list.refetch();
            } catch (e) {
              toast(errorMessage(e), 'bad');
            } finally {
              setPurging(false);
            }
          }}
        >
          🗑️ مسح الملغي
        </button>
      </div>
      {list.isPending && <Loading />}
      {list.isError && <ErrorBox message={errorMessage(list.error)} onRetry={() => list.refetch()} />}
      {list.data && !rows.length && (
        <div className="card">
          <div className="empty">{tab === 'new' ? 'مفيش طلبات جديدة.' : 'مفيش طلبات هنا.'}</div>
        </div>
      )}
      {rows.map((o) => (
        <OrderCard key={o.id} o={o} prod={prod} onEta={() => setEta(o)} />
      ))}
      {eta && <EtaModal o={eta} names={(c) => byCode.get(String(c))?.name ?? `كود ${c}`} onClose={() => setEta(null)} />}
    </>
  );
}

// ───────────────────────── 📷 طلبات بالصور
const RQ_OPTS: [string, string][] = [
  ['ok', '✅ متوفر عندنا — تقدر تطلبه أو تيجي تاخده'],
  ['will', '📦 هنوفّر لك'],
  ['no', '❌ للأسف مش متاح عندنا حالياً'],
  ['c', '✍️ رد تاني'],
];

function ReplyModal({ r, onClose }: { r: WebRequestRow; onClose: () => void }) {
  const toast = useToast();
  const patch = usePatchWebRequest();
  const [k, setK] = useState('will');
  const [when, setWhen] = useState('');
  const [txt, setTxt] = useState('');
  const [extra, setExtra] = useState('');
  const go = async () => {
    let t = '';
    if (k === 'ok') t = 'المنتج ده متوفر عندنا ✅ — تقدر تطلبه أو تيجي تاخده';
    else if (k === 'will') {
      if (!when.trim()) return toast('اكتب الميعاد', 'bad');
      t = `هنوفّرلك المنتج ده 📦 — هيبقى جاهز ${when.trim()}`;
    } else if (k === 'no') t = 'للأسف المنتج ده مش متاح عندنا حالياً 🙏';
    else {
      if (!txt.trim()) return toast('اكتب الرد', 'bad');
      t = txt.trim();
    }
    const msg = `أهلاً ${r.name} 👋\nبخصوص المنتج اللي بعتلنا ${r.imgs.length ? 'صورته' : 'تفاصيله'} على موقع ميكانيزم${r.note ? ` (${r.note.slice(0, 80)})` : ''}:\n\n${t}${extra.trim() ? `\n${extra.trim()}` : ''}\n\nلو عندك أي سؤال ردّ علينا هنا.`;
    const wa = r.phone ? waLink(r.phone, msg) : '';
    const win = wa ? window.open(wa, '_blank') : null; // open WhatsApp first so the browser does not block it
    try {
      await patch.mutateAsync({ id: r.id, reply: t });
    } catch (e) {
      toast(`الرد ماتسجلش: ${errorMessage(e)}`, 'bad');
    }
    onClose();
    if (wa && !win) window.location.href = wa;
    if (!wa) toast('العميل مالوش رقم موبايل', 'bad');
  };
  return (
    <Modal title={`💬 الرد على ${r.name}`} onClose={onClose}>
      {r.imgs[0] && <img src={r.imgs[0]} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 12, background: '#f3f5f6' }} />}
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {RQ_OPTS.map(([v, t]) => (
          <label key={v} className="chk" style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
            <input type="radio" name="rqo" checked={k === v} onChange={() => setK(v)} /> {t}
          </label>
        ))}
      </div>
      <div className="form" style={{ marginTop: 10 }}>
        <div className="field">
          <label>الميعاد (لو هنوفّره)</label>
          <input value={when} placeholder="مثلاً: خلال 3 أيام" onChange={(e) => setWhen(e.target.value)} />
        </div>
        <div className="field">
          <label>الرد اللي هتكتبه (لو اخترت «رد تاني»)</label>
          <input value={txt} onChange={(e) => setTxt(e.target.value)} />
        </div>
        <div className="field full">
          <label>ملاحظة إضافية (اختياري)</label>
          <input value={extra} placeholder="مثلاً: تقدر تعدي على المحل في أي وقت" onChange={(e) => setExtra(e.target.value)} />
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={patch.isPending} onClick={go}>
          💬 ابعت على الواتساب
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

function Requests() {
  const toast = useToast();
  const list = useWebRequests();
  const patch = usePatchWebRequest();
  const [all, setAll] = useState(false);
  const [reply, setReply] = useState<WebRequestRow | null>(null);
  const L = (list.data ?? []).filter((r) => all || r.status === 'new');
  const n = (list.data ?? []).filter((r) => r.status === 'new').length;
  return (
    <div id="rqBody">
      <h2 style={{ margin: '22px 0 10px' }}>
        📷 طلبات بالصور {n > 0 && <span className="badge red">{n}</span>}
      </h2>
      <p style={{ color: 'var(--muted)', margin: '-4px 0 10px', fontSize: 13 }}>منتجات العملاء بعتوا صورها لأنهم مالقوهاش في الموقع</p>
      {list.isError && <ErrorBox message={errorMessage(list.error)} onRetry={() => list.refetch()} />}
      {L.length ? (
        L.map((r) => (
          <div key={r.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <b style={{ fontSize: 17 }}>{r.name}</b> — <span dir="ltr">{r.phone}</span>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(r.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</div>
              </div>
              {r.status === 'new' ? <span className="badge red">جديد</span> : r.status === 'replied' ? <span className="badge green">اترد عليه</span> : <span className="badge">مقفول</span>}
            </div>
            {r.imgs.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {r.imgs.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noopener">
                    <img src={u} alt="" loading="lazy" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' }} />
                  </a>
                ))}
              </div>
            )}
            {r.note && <p style={{ margin: '10px 0 0', whiteSpace: 'pre-line' }}>📝 {r.note}</p>}
            {r.reply && (
              <p style={{ margin: '8px 0 0', color: 'var(--green)' }}>
                💬 الرد: {r.reply}
                {r.repliedBy ? ` — ${r.repliedBy}` : ''}
              </p>
            )}
            <div className="btnrow" style={{ marginTop: 10 }}>
              <button type="button" className="primary" onClick={() => setReply(r)}>
                💬 رد على العميل
              </button>
              {r.status !== 'closed' && (
                <button type="button" className="secondary" disabled={patch.isPending} onClick={() => patch.mutate({ id: r.id, status: 'closed' }, { onSuccess: () => toast('اتقفل') })}>
                  ✔ اقفل
                </button>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="card">
          <div className="empty">مفيش طلبات بالصور{all ? '' : ' جديدة'}</div>
        </div>
      )}
      <button type="button" className="secondary" style={{ marginTop: 4 }} onClick={() => setAll(!all)}>
        {all ? 'اعرض الجديد بس' : 'اعرض كل الطلبات (اللي اترد عليها كمان)'}
      </button>
      {reply && <ReplyModal r={reply} onClose={() => setReply(null)} />}
    </div>
  );
}

// ───────────────────────── 🛠️ طلبات تجهيز من الموقع
const CUS_K: Record<string, string> = { steel: '🔩 استانلس', bamboo: '🎍 بامبو', delf: '🚪 دلفة' };

function Custom() {
  const toast = useToast();
  const router = useRouter();
  const list = useWebCustom();
  const patch = usePatchWebCustom();
  const [all, setAll] = useState(false);
  const L = (list.data ?? []).filter((r) => all || r.status === 'new');
  const n = (list.data ?? []).filter((r) => r.status === 'new').length;
  const openAsOrder = async (r: WebCustomRow) => {
    // the work-systems screen reads this on open and fills its order form from the request
    try {
      sessionStorage.setItem('mk_open_web', JSON.stringify(r));
    } catch {
      return toast('المتصفح مش سامح — جرّب تاني', 'bad');
    }
    await patch.mutateAsync({ id: r.id, status: 'opened' }).catch(() => undefined);
    router.push('/work?k=ord');
  };
  return (
    <div id="cuBody">
      <h2 style={{ margin: '22px 0 10px' }}>
        🛠️ طلبات تجهيز من الموقع {n > 0 && <span className="badge red">{n}</span>}
      </h2>
      <p style={{ color: 'var(--muted)', margin: '-4px 0 10px', fontSize: 13 }}>عملاء حدّدوا مقاسات استانلس أو بامبو أو دلفة من الموقع</p>
      {list.isError && <ErrorBox message={errorMessage(list.error)} onRetry={() => list.refetch()} />}
      {L.length ? (
        L.map((r) => (
          <div key={r.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <b style={{ fontSize: 17 }}>{r.name}</b> — <span dir="ltr">{r.phone}</span>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(r.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</div>
              </div>
              <span className={`badge${r.status === 'new' ? ' red' : ''}`}>{r.status === 'new' ? 'جديد' : r.status === 'opened' ? 'اتفتح كأوردر' : r.status === 'closed' ? 'اتقفل' : r.status}</span>
            </div>
            <div style={{ marginTop: 8, fontWeight: 700 }}>{CUS_K[r.kind] ?? r.kind}</div>
            {r.summary && <p style={{ margin: '6px 0 0', whiteSpace: 'pre-line' }}>{r.summary}</p>}
            {r.note && <p style={{ margin: '6px 0 0', whiteSpace: 'pre-line' }}>📝 {r.note}</p>}
            {r.img && (
              <a href={r.img} target="_blank" rel="noopener">
                <img src={r.img} alt="" loading="lazy" style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain', marginTop: 10, borderRadius: 12, border: '1px solid var(--border)', background: '#fff' }} />
              </a>
            )}
            <div className="btnrow" style={{ marginTop: 10 }}>
              {(r.status === 'new' || r.status === 'closed') && (
                <button type="button" className="primary" onClick={() => openAsOrder(r)}>
                  🛠️ افتح كأوردر
                </button>
              )}
              {r.status === 'new' && (
                <button type="button" className="secondary" disabled={patch.isPending} onClick={() => patch.mutate({ id: r.id, status: 'closed' }, { onSuccess: () => toast('اتقفل') })}>
                  ✔ اقفل بدون أوردر
                </button>
              )}
              {r.phone && (
                <a className="secondary" style={{ padding: '10px 14px', borderRadius: 10, textDecoration: 'none' }} href={`https://wa.me/${waNum(r.phone)}`} target="_blank" rel="noopener">
                  💬 واتساب
                </a>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="card">
          <div className="empty">مفيش طلبات تجهيز{all ? '' : ' جديدة'}</div>
        </div>
      )}
      <button type="button" className="secondary" style={{ marginTop: 4 }} onClick={() => setAll(!all)}>
        {all ? 'اعرض الجديد بس' : 'اعرض كل الطلبات'}
      </button>
    </div>
  );
}

export default function WebOrdersPage() {
  return (
    <AdminOnly>
      <PageHeader title="طلبات الموقع" subtitle="الطلبات اللي العملاء بعتوها من الموقع — حوّلها لفاتورة بضغطة" />
      <OrdersList />
      <Requests />
      <Custom />
    </AdminOnly>
  );
}
