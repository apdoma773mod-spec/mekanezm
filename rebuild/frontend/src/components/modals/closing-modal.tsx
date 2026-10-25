'use client';

import { useState } from 'react';
import { Modal } from '../ui/modal';
import { ErrorBox, Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useIsAdmin } from '../use-role';
import { useModal } from './modal-host';
import { errorMessage } from '@/lib/api';
import { arDate, money, todayYmd } from '@/lib/format';
import { useMe, useSettings } from '@/lib/queries';
import { useClosings, useDaybookPost, useDaySummary, useSaveClosing } from '@/lib/trade-queries';

const r2 = (n: number) => Math.round(n * 100) / 100;

function Row({ t, v, c }: { t: string; v: number; c?: string }) {
  return (
    <tr>
      <td>{t}</td>
      <td style={c ? { color: c } : undefined}>{money(v)}</td>
    </tr>
  );
}

/** «🔒 تقفيل اليومية»: the day's numbers, the counted drawer and the difference, then WhatsApp to the owner. */
export function ClosingModal({ day: day0 }: { day?: string }) {
  const { close, open } = useModal();
  const toast = useToast();
  const admin = useIsAdmin();
  const me = useMe().data;
  const settings = useSettings().data;
  const [day, setDay] = useState(day0 ?? todayYmd());
  const [cash, setCash] = useState('');
  const [note, setNote] = useState('');
  const summary = useDaySummary(day);
  const save = useSaveClosing();
  const post = useDaybookPost();
  const s = summary.data;

  const d = s && cash !== '' ? r2(Number(cash) - s.cashExpected) : null;

  const msg = () => {
    if (!s) return '';
    const name = me?.name ?? '';
    return (
      `🔒 تقفيل يومية ${settings?.store.name || 'ميكانيزم'}\n📅 ${s.day}${name ? ` — ${name}` : ''}\n\n` +
      `🧾 فواتير البيع: ${s.salesCount}\n💵 المبيعات: ${money(s.salesTotal)}\n✅ اتحصّل: ${money(s.salesPaid)}` +
      (s.instapay ? `\n📱 منهم إنستاباي: ${money(s.instapay)}` : '') +
      (s.transfer ? `\n🏦 منهم تحويل: ${money(s.transfer)}` : '') +
      `\n⏳ آجل: ${money(s.salesCredit)}\n➕ تحصيل: ${money(s.collections)}\n➖ موردين: ${money(s.purchasesPaid + s.supplierPayments)}` +
      `\n➖ مصروفات: ${money(s.expenses)}\n➖ مرتجعات: ${money(s.returnsSale)}\n\n💰 المفروض في الدرج: ${money(s.cashExpected)}` +
      (cash !== '' && d !== null
        ? `\n💼 الموجود فعلاً: ${money(Number(cash))}\n${d < 0 ? '🔴 عجز' : d > 0 ? '🟢 زيادة' : '✔ مظبوط'}: ${money(Math.abs(d))}`
        : '') +
      (note.trim() ? `\n📝 ${note.trim()}` : '')
    );
  };

  const wa = () => {
    let ph = String(settings?.store.ownerPhone ?? '').replace(/\D/g, '');
    if (ph.startsWith('0')) ph = `20${ph.slice(1)}`;
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg())}`, '_blank');
  };

  const onSave = async () => {
    if (!s) return;
    try {
      await save.mutateAsync({ day: s.day, cashActual: cash === '' ? null : Number(cash), note: note.trim() });
      toast('✔ التقفيل اتحفظ');
      wa();
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  const postFirst = async () => {
    try {
      const out = await post.mutateAsync({ day });
      toast(`✔ اليومية اتصفّت: ${out.invoices.map((x) => x.no).join('، ')}`);
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  return (
    <Modal title="🔒 تقفيل اليومية" onClose={close}>
      <div className="form">
        <div className="field">
          <label htmlFor="clDay">اليوم</label>
          <input id="clDay" type="date" value={day} onChange={(e) => setDay(e.target.value || todayYmd())} />
        </div>
        <div className="field">
          <label htmlFor="clCash">الفلوس اللي في الدرج فعلاً</label>
          <input id="clCash" inputMode="decimal" placeholder="عدّ الدرج واكتب المبلغ" value={cash} onChange={(e) => setCash(e.target.value)} />
        </div>
      </div>
      {summary.isPending ? (
        <Loading />
      ) : summary.isError ? (
        <ErrorBox message={errorMessage(summary.error)} onRetry={() => summary.refetch()} />
      ) : s ? (
        <>
          {s.daybookOpen > 0 && (
            <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: '#fff4e5', color: '#8a4b00' }}>
              📒 في <b>{s.daybookOpen}</b> سطر في يومية المحل لسه متصفّوش — مش داخلين في الحساب.
              <div className="btnrow" style={{ marginTop: 8 }}>
                <button type="button" className="primary" disabled={post.isPending} onClick={postFirst}>
                  🧮 صفّي اليومية الأول
                </button>
              </div>
            </div>
          )}
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="table cl-t" style={{ minWidth: 0 }}>
              <tbody>
                <tr>
                  <td>عدد فواتير البيع</td>
                  <td>{s.salesCount}</td>
                </tr>
                <Row t="إجمالي المبيعات" v={s.salesTotal} />
                <Row t="اتحصّل من المبيعات" v={s.salesPaid} c="var(--green)" />
                {s.instapay > 0 && <Row t="📱 منهم إنستاباي (مش في الدرج)" v={s.instapay} c="#5b3aa6" />}
                {s.transfer > 0 && <Row t="🏦 منهم تحويل (مش في الدرج)" v={s.transfer} c="#1d5fb3" />}
                <Row t="آجل على العملاء" v={s.salesCredit} c="var(--danger)" />
                <Row t="تحصيل من عملاء (دفعات)" v={s.collections} c="var(--green)" />
                <Row t="مدفوع للموردين في فواتير الشراء" v={s.purchasesPaid} c="var(--danger)" />
                <Row t="سداد لموردين" v={s.supplierPayments} c="var(--danger)" />
                <Row t="مصروفات" v={s.expenses} c="var(--danger)" />
                <Row t="مرتجعات بيع (فلوس رجعت للعملاء)" v={s.returnsSale} c="var(--danger)" />
                {s.returnsPurchase > 0 && <Row t="مرتجعات شراء" v={s.returnsPurchase} c="var(--green)" />}
                <tr style={{ background: 'var(--tint2)', fontSize: 17 }}>
                  <td>
                    <b>المفروض في الدرج (حركة اليوم)</b>
                  </td>
                  <td>
                    <b>{money(s.cashExpected)}</b>
                  </td>
                </tr>
                {d !== null && (
                  <tr>
                    <td>
                      <b>الفرق</b>
                    </td>
                    <td>
                      <b style={{ color: d < 0 ? 'var(--danger)' : d > 0 ? 'var(--green)' : 'inherit' }}>
                        {d > 0 ? '+' : ''}
                        {money(d)}
                        {d < 0 ? ' (عجز)' : d > 0 ? ' (زيادة)' : ' ✔'}
                      </b>
                    </td>
                  </tr>
                )}
                {s.profit !== undefined && (
                  <tr>
                    <td>💰 ربح اليوم</td>
                    <td style={{ color: 'var(--green)' }}>{money(s.profit)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {s.topItems.length > 0 && (
            <>
              <h3 style={{ margin: '14px 0 6px' }}>أكتر الأصناف مبيعاً</h3>
              <div style={{ fontSize: 14, lineHeight: 1.9 }}>
                {s.topItems.map((x) => (
                  <div key={x.name}>
                    {x.name} × {x.qty} = {money(x.total)}
                  </div>
                ))}
              </div>
            </>
          )}
          {s.byUser.length > 1 && (
            <>
              <h3 style={{ margin: '14px 0 6px' }}>حسب الموظف</h3>
              <div style={{ fontSize: 14, lineHeight: 1.9 }}>
                {s.byUser.map((x) => (
                  <div key={x.name}>
                    {x.name || '—'}: {x.count} فاتورة — {money(x.total)}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : null}
      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="clNote">ملاحظة (اختياري)</label>
        <input id="clNote" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={!s || save.isPending} onClick={onSave}>
          حفظ التقفيل وإرساله للمالك
        </button>
        <button type="button" className="secondary" disabled={!s} onClick={wa}>
          💬 إرسال على الواتساب بس
        </button>
        {admin && (
          <button type="button" className="secondary" onClick={() => open({ kind: 'closingHistory' })}>
            السجل
          </button>
        )}
      </div>
    </Modal>
  );
}

export function ClosingHistory() {
  const { close } = useModal();
  const list = useClosings();
  const L = list.data?.items ?? [];
  return (
    <Modal title="سجل تقفيل اليومية" onClose={close} wide>
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorBox message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>اليوم</th>
                <th>المبيعات</th>
                <th>المفروض</th>
                <th>الموجود</th>
                <th>الفرق</th>
                <th>بواسطة</th>
              </tr>
            </thead>
            <tbody>
              {L.length ? (
                L.map((c) => (
                  <tr key={c.id}>
                    <td>{arDate(c.day)}</td>
                    <td>{money(c.data?.salesTotal)}</td>
                    <td>{money(c.cashExpected)}</td>
                    <td>{c.cashActual === null ? '—' : money(c.cashActual)}</td>
                    <td style={{ color: (c.cashDiff ?? 0) < 0 ? 'var(--danger)' : 'inherit' }}>{c.cashDiff === null ? '—' : money(c.cashDiff)}</td>
                    <td>{c.createdBy ?? ''}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">لسه مفيش</div>
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
