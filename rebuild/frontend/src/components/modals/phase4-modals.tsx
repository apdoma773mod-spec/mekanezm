'use client';

import { useState } from 'react';
import { GIFT_KINDS, type ProductDto } from '@mk/shared';
import { errorMessage } from '@/lib/api';
import { money, qtyText } from '@/lib/format';
import { useAddWanted, useAlts, useDeleteWanted, useGift, useGifts, useGrade, useSaveAlts, useWanted, useWantedDone } from '@/lib/phase4-queries';
import { useContacts, useProduct, useProducts } from '@/lib/trade-queries';
import { Modal } from '../ui/modal';
import { ErrorBox, Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useIsAdmin } from '../use-role';
import { useModal } from './modal-host';

export type Phase4Spec =
  | { kind: 'gift'; productId: string }
  | { kind: 'gifts' }
  | { kind: 'grade'; productId: string }
  | { kind: 'alts'; productId: string }
  | { kind: 'wanted' };

const n = (v: string) => Number(String(v).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٬\s]/g, '')) || 0;

function GiftModal({ productId }: { productId: string }) {
  const { close } = useModal();
  const toast = useToast();
  const p = useProduct(productId).data;
  const [qty, setQty] = useState('1');
  const [kind, setKind] = useState<(typeof GIFT_KINDS)[number]>('صنايعي');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const people = useContacts({ q: name.trim() || undefined, pageSize: 20 });
  const gift = useGift();
  if (!p)
    return (
      <Modal title="🎁 هدية" onClose={close}>
        <Loading />
      </Modal>
    );
  const go = async () => {
    const q = n(qty);
    if (q <= 0) return toast('اكتب الكمية', 'bad');
    if (!name.trim()) return toast('اكتب اسم اللي خد الهدية', 'bad');
    if (q > p.qty) return toast(`الرصيد ${qtyText(p.qty)} بس`, 'bad');
    try {
      await gift.mutateAsync({ productId: p.id, qty: q, toName: name.trim(), toPhone: phone.trim(), toKind: kind, note: note.trim() });
      close();
      toast('✔ الهدية اتسجلت واتخصمت من المخزن');
    } catch (e) {
      toast(`ماتسجلتش: ${errorMessage(e)}`, 'bad');
    }
  };
  return (
    <Modal title={`🎁 هدية من «${p.name}»`} onClose={close}>
      <p style={{ margin: '0 0 8px', color: '#6b7c82', fontSize: 13 }}>بتتخصم من المخزن وبتتسجل باسم اللي خدها، وتقدر تشوف كل صنايعي خد هدايا بكام وجابلك شغل بكام.</p>
      <div className="form">
        <div className="field">
          <label>
            الكمية ({p.unit || 'قطعة'}) — الرصيد {qtyText(p.qty)}
          </label>
          <input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="field">
          <label>لمين؟</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {GIFT_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>الاسم</label>
          <input
            list="sxNL"
            placeholder="اسم الصنايعي أو المهندس"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              const c = people.data?.items.find((x) => x.name === e.target.value);
              if (c?.phone && !phone) setPhone(c.phone);
            }}
          />
          <datalist id="sxNL">
            {people.data?.items
              .filter((c) => c.type !== 'SUPPLIER')
              .map((c) => (
                <option key={c.id} value={c.name} />
              ))}
          </datalist>
        </div>
        <div className="field">
          <label>الموبايل (اختياري)</label>
          <input inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field full">
          <label>ملاحظة (اختياري)</label>
          <input placeholder="مثلاً: عشان شغل شقة المعادي" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={gift.isPending} onClick={go}>
          🎁 سجّل الهدية
        </button>
        <button type="button" className="secondary" onClick={close}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

function GiftsModal() {
  const { close } = useModal();
  const admin = useIsAdmin();
  const g = useGifts();
  if (g.isPending)
    return (
      <Modal title="🎁 الهدايا" onClose={close}>
        <div style={{ padding: 24, textAlign: 'center', color: '#8a979c' }}>⏳ بجيب الهدايا…</div>
      </Modal>
    );
  if (g.isError)
    return (
      <Modal title="🎁 الهدايا" onClose={close}>
        <div className="empty">ماقدرتش أجيب الهدايا: {errorMessage(g.error)}</div>
      </Modal>
    );
  const d = g.data;
  const card = (l: string, v: number) => (
    <div className="card" style={{ padding: 10 }}>
      <small>{l}</small>
      <b style={{ display: 'block', fontSize: 18 }}>{money(v)}</b>
    </div>
  );
  return (
    <Modal title="🎁 الهدايا" onClose={close} wide>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, marginBottom: 10 }}>
        {card('كل الهدايا (بسعر البيع)', d.total)}
        {admin && d.totalCost !== undefined && card('تكلفتها عليك', d.totalCost)}
        {card('آخر ٣٠ يوم', d.last30)}
        <div className="card" style={{ padding: 10 }}>
          <small>عدد اللي خدوا</small>
          <b style={{ display: 'block', fontSize: 18 }}>{d.people.length}</b>
        </div>
      </div>
      <h3 style={{ fontSize: 15, margin: '8px 0' }}>مين خد وجابلك شغل بكام؟</h3>
      {d.people.length ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>خد هدايا بـ</th>
                  <th>اشترى منك بـ</th>
                  <th>المقابل</th>
                </tr>
              </thead>
              <tbody>
                {d.people.map((x) => {
                  const r = x.value ? x.bought / x.value : 0;
                  return (
                    <tr key={x.name}>
                      <td>
                        <b>{x.name}</b>
                        <br />
                        <small style={{ color: '#7b8a90' }}>
                          {x.kind}
                          {x.phone ? ` — ${x.phone}` : ''} · {x.count} مرة
                        </small>
                      </td>
                      <td>{money(x.value)}</td>
                      <td>{x.bought ? money(x.bought) : <span style={{ color: '#b33' }}>لسه مفيش</span>}</td>
                      <td>{x.bought ? (r >= 10 ? `🟢 ممتاز ×${Math.round(r)}` : r >= 3 ? `🟡 كويس ×${Math.round(r)}` : '🔴 ضعيف') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: '#7b8a90', margin: '6px 0' }}>«اشترى منك» بيتحسب لو اسمه في الفواتير زي ما هو مكتوب في الهدية.</p>
        </>
      ) : (
        <div className="empty">لسه مفيش هدايا. افتح أي منتج ودوس «🎁 هدية».</div>
      )}
      {d.gifts.length > 0 && (
        <>
          <h3 style={{ fontSize: 15, margin: '14px 0 6px' }}>آخر الهدايا</h3>
          {d.gifts.map((x) => (
            <div key={x.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', marginTop: 6, fontSize: 13, lineHeight: 1.7 }}>
              <b>{x.productName}</b> × {qtyText(x.qty)} — لـ {x.toName} ({x.toKind})
              <div style={{ color: '#7b8a90', fontSize: 12 }}>
                {new Date(x.createdAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })} · {money(x.qty * x.price)}
                {x.createdBy ? ` · سجّلها ${x.createdBy}` : ''}
                {x.note ? ` · ${x.note}` : ''}
              </div>
            </div>
          ))}
        </>
      )}
      <div className="modal-foot">
        <button type="button" className="secondary" onClick={close}>
          إغلاق
        </button>
      </div>
    </Modal>
  );
}

function GradeModal({ productId }: { productId: string }) {
  const { close } = useModal();
  const toast = useToast();
  const p = useProduct(productId).data;
  const ex = useProducts({ q: p ? `${p.name} (درجة تانية)` : '', pageSize: 5 }, !!p).data?.items.find((x) => p && x.name === `${p.name} (درجة تانية)`);
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const grade = useGrade();
  if (!p)
    return (
      <Modal title="⚠️ نقل لدرجة تانية" onClose={close}>
        <Loading />
      </Modal>
    );
  const pr = price ?? String(ex ? ex.price : Math.round(p.price * 0.75));
  const go = async () => {
    const q = n(qty);
    if (q <= 0) return toast('اكتب الكمية', 'bad');
    if (q > p.qty) return toast(`الرصيد ${qtyText(p.qty)} بس`, 'bad');
    try {
      const t = await grade.mutateAsync({ productId: p.id, qty: q, price: n(pr), note: note.trim() });
      close();
      toast(`✔ اتنقلت ${q} لـ «${t.name}» كود ${t.code}`);
    } catch (e) {
      toast(`ماتنقلتش: ${errorMessage(e)}`, 'bad');
    }
  };
  return (
    <Modal title="⚠️ نقل لدرجة تانية" onClose={close}>
      <p style={{ margin: '0 0 8px', color: '#6b7c82', fontSize: 13, lineHeight: 1.8 }}>
        القطع المخربشة أو المتجرحة بتتنقل لصنف «{p.name} (درجة تانية)» {ex ? `(موجود — كوده ${ex.code})` : '(هيتعمل بكود جديد)'} بنفس سعر الشراء وسعر بيع أقل، عشان تبيعها لوحدها والرصيد يفضل مظبوط.
      </p>
      <div className="form">
        <div className="field">
          <label>
            كام {p.unit || 'قطعة'} مخربشة؟ (الرصيد {qtyText(p.qty)})
          </label>
          <input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="field">
          <label>سعر البيع للدرجة التانية</label>
          <input type="number" min="0" step="any" value={pr} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="field full">
          <label>إيه اللي فيها؟ (اختياري)</label>
          <input placeholder="مثلاً: خدش في الوش" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={grade.isPending} onClick={go}>
          ⚠️ انقلها
        </button>
        <button type="button" className="secondary" onClick={close}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

function AltsModal({ productId }: { productId: string }) {
  const { close, open } = useModal();
  const toast = useToast();
  const p = useProduct(productId).data;
  const alts = useAlts();
  const [picked, setPicked] = useState<ProductDto[] | null>(null);
  const [text, setText] = useState('');
  const found = useProducts({ q: text.trim(), pageSize: 10 }, text.trim().length >= 2);
  const curIds = alts.data?.[productId] ?? [];
  const cur = useProducts({ pageSize: 200 }, curIds.length > 0 && picked === null).data?.items.filter((x) => curIds.includes(x.id));
  const list = picked ?? cur ?? [];
  const save = useSaveAlts();
  if (!p)
    return (
      <Modal title="🔁 بدائل" onClose={close}>
        <Loading />
      </Modal>
    );
  return (
    <Modal title={`🔁 بدائل «${p.name}»`} onClose={close}>
      <p style={{ fontSize: 13, color: '#6b7c82', margin: '0 0 8px' }}>لما الصنف ده يخلص، الموظف يشوف البدائل دي في شاشة المنتج ويعرضها على الزبون بدل ما يمشي.</p>
      <div style={{ marginBottom: 8 }}>
        {list.map((x) => (
          <span key={x.id} className="kt-chip">
            {x.code} — {x.name}{' '}
            <a style={{ cursor: 'pointer', color: '#b33' }} onClick={() => setPicked(list.filter((y) => y.id !== x.id))}>
              ✕
            </a>
          </span>
        ))}
      </div>
      <div className="form">
        <div className="field full">
          <label>ضيف كود</label>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب اسم الصنف أو كوده..." />
          {text.trim().length >= 2 && (
            <div className="txbox">
              {found.data?.items
                .filter((x) => x.id !== productId)
                .map((x) => (
                  <div
                    key={x.id}
                    onClick={() => {
                      if (!list.some((y) => y.id === x.id)) setPicked([...list, x]);
                      setText('');
                    }}
                  >
                    {x.code} — {x.name}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
      <div className="modal-foot">
        <button
          type="button"
          className="primary"
          disabled={save.isPending}
          onClick={async () => {
            try {
              await save.mutateAsync({ id: productId, ids: list.map((x) => x.id) });
              toast(`✔ اتحفظت البدائل (${list.length})`);
              open({ kind: 'product', id: productId });
            } catch (e) {
              toast(`ماتحفظش: ${errorMessage(e)}`, 'bad');
            }
          }}
        >
          حفظ
        </button>
        <button type="button" className="secondary" onClick={close}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

/** «🔎 مطلوب ومش عندنا». */
function WantedModal() {
  const { close } = useModal();
  const toast = useToast();
  const admin = useIsAdmin();
  const L = useWanted();
  const add = useAddWanted();
  const done = useWantedDone();
  const del = useDeleteWanted();
  const [descr, setDescr] = useState('');
  const items = L.data ?? [];
  return (
    <Modal title={`🔎 مطلوب ومش عندنا (${items.length})`} onClose={close}>
      <p style={{ margin: '0 0 8px', color: '#7b8a90', fontSize: 13 }}>قطع الناس سألت عليها ومالقيتهاش عندك — دي قايمة الشراء الجاية.</p>
      <div className="btnrow" style={{ marginBottom: 8 }}>
        <input style={{ flex: 1 }} placeholder="اكتب القطعة اللي اتسألت عليها..." value={descr} onChange={(e) => setDescr(e.target.value)} />
        <button
          type="button"
          className="primary"
          disabled={add.isPending}
          onClick={async () => {
            if (!descr.trim()) return;
            try {
              await add.mutateAsync({ descr: descr.trim(), source: 'المحل', phone: '' });
              setDescr('');
              toast('✔ اتسجلت في «مطلوب ومش عندنا»');
            } catch (e) {
              toast(`ماتسجلتش: ${errorMessage(e)}`, 'bad');
            }
          }}
        >
          ＋ سجّلها
        </button>
      </div>
      {L.isPending ? (
        <Loading />
      ) : L.isError ? (
        <ErrorBox message={errorMessage(L.error)} />
      ) : items.length ? (
        items.map((w) => (
          <div key={w.id} style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid #e3e8ea', borderRadius: 12, padding: 8, marginTop: 8 }}>
            {w.thumb && <img src={w.thumb} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, flex: 'none' }} />}
            <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.6 }}>
              {w.descr}
              <br />
              <small style={{ color: '#7b8a90' }}>
                {w.createdAt.slice(0, 10)} · {w.source}
                {w.phone ? ` · ${w.phone}` : ''}
                {w.byName ? ` · ${w.byName}` : ''}
              </small>
            </div>
            {admin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 'none' }}>
                <button type="button" className="secondary" onClick={() => done.mutate(w.id)}>
                  ✔ اتوفر
                </button>
                <button type="button" className="secondary danger" onClick={() => window.confirm('حذف الطلب ده من القايمة؟') && del.mutate(w.id)}>
                  حذف
                </button>
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="empty">مفيش طلبات متسجلة.</div>
      )}
      <div className="modal-foot">
        <button type="button" className="secondary" onClick={close}>
          إغلاق
        </button>
      </div>
    </Modal>
  );
}

export function Phase4Modal({ spec }: { spec: Phase4Spec }) {
  switch (spec.kind) {
    case 'gift':
      return <GiftModal productId={spec.productId} />;
    case 'gifts':
      return <GiftsModal />;
    case 'grade':
      return <GradeModal productId={spec.productId} />;
    case 'alts':
      return <AltsModal productId={spec.productId} />;
    case 'wanted':
      return <WantedModal />;
  }
}
