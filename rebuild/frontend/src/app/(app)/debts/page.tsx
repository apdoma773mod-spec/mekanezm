'use client';

import { useState } from 'react';
import type { DebtorDto } from '@mk/shared';
import { AdminOnly } from '@/components/app-shell';
import { useModal } from '@/components/modals/modal-host';
import { Modal } from '@/components/ui/modal';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { money, todayYmd } from '@/lib/format';
import { useSettings } from '@/lib/queries';
import { useDebts, useRemind, useSaveDebtTemplate } from '@/lib/trade-queries';

const daysAgo = (iso: string | null | undefined) =>
  iso ? Math.max(0, Math.round((Date.parse(`${todayYmd()}T00:00:00Z`) - Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)) / 86_400_000)) : null;
const arDay = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : '');
const agoTxt = (n: number | null) =>
  n === null ? '' : n === 0 ? 'النهارده' : n === 1 ? 'إمبارح' : n === 2 ? 'من يومين' : n <= 10 ? `من ${n} أيام` : `من ${n} يوم`;
const norm = (s: string) => s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const aged = (x: DebtorDto, n: number) => x.old || (x.days ?? 0) >= n;

function msgFor(tpl: string, shop: string, x: DebtorDto, withInv: boolean) {
  let t = tpl
    .replace(/\{الاسم\}/g, x.name)
    .replace(/\{المحل\}/g, shop)
    .replace(/\{المبلغ\}/g, money(x.balance))
    .replace(/\{من\}/g, x.since ? ` من ${arDay(x.since)}` : '');
  if (withInv && x.open.length)
    t += `\n\nالفواتير:\n${[...x.open]
      .reverse()
      .map((g) => `• ${g.no} — ${arDay(g.date)} — ${money(g.remaining)}`)
      .join('\n')}`;
  return t;
}

function RemindModal({ x, tpl, onClose }: { x: DebtorDto; tpl: string; onClose: () => void }) {
  const toast = useToast();
  const shop = useSettings().data?.store.name || 'ميكانيزم';
  const [withInv, setWithInv] = useState(x.open.length > 0);
  const [text, setText] = useState(() => msgFor(tpl, shop, x, x.open.length > 0));
  const remind = useRemind();
  const saveTpl = useSaveDebtTemplate();
  const r = x.reminder;

  const asTemplate = async () => {
    // Turn the edited message back into a template with the placeholders.
    let t = text.split(x.name).join('{الاسم}').split(money(x.balance)).join('{المبلغ}').split(shop).join('{المحل}');
    if (x.since) t = t.split(` من ${arDay(x.since)}`).join('{من}');
    t = t.replace(/\n\nالفواتير:[\s\S]*$/, '');
    try {
      await saveTpl.mutateAsync(t);
      toast('✔ اتحفظت كرسالة أساسية لكل العملاء');
    } catch (e) {
      toast(`ماتحفظتش: ${errorMessage(e)}`, 'bad');
    }
  };

  const send = async () => {
    let d = x.phone.replace(/\D/g, '');
    if (d.startsWith('0')) d = `20${d.slice(1)}`;
    if (d) window.open(`https://wa.me/${d}?text=${encodeURIComponent(text)}`, '_blank');
    else {
      try {
        await navigator.clipboard.writeText(text);
        toast('الرسالة اتنسخت');
      } catch {
        /* clipboard blocked */
      }
    }
    try {
      await remind.mutateAsync(x.id);
    } catch (e) {
      toast(`التذكير ماتسجلش: ${errorMessage(e)}`, 'bad');
    }
    onClose();
  };

  return (
    <Modal title={`💬 تذكير ${x.name}`} onClose={onClose}>
      <p style={{ marginTop: 0 }}>
        عليه <b style={{ color: 'var(--danger)' }}>{money(x.balance)}</b>
        {x.since ? ` من ${arDay(x.since)} (${agoTxt(x.days)})` : ''}
        {r && (
          <>
            <br />
            <small style={{ color: 'var(--muted)' }}>
              آخر تذكير: {agoTxt(daysAgo(r.at))}
              {r.by ? ` — ${r.by}` : ''}
            </small>
          </>
        )}
      </p>
      {!x.phone && <p style={{ color: 'var(--danger)' }}>⚠️ العميل مالوش رقم — الرسالة هتتنسخ وتبعتها انت</p>}
      <label className="chk">
        <input
          type="checkbox"
          checked={withInv}
          onChange={(e) => {
            setWithInv(e.target.checked);
            setText(msgFor(tpl, shop, x, e.target.checked));
          }}
        />{' '}
        ضيف أرقام الفواتير
      </label>
      <textarea
        rows={9}
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ width: '100%', marginTop: 8, padding: 11, border: '1px solid var(--border)', borderRadius: 12, font: 'inherit', lineHeight: 1.7, boxSizing: 'border-box' }}
      />
      <div className="modal-foot">
        <button type="button" className="primary" onClick={send}>
          💬 ابعت على الواتساب
        </button>
        <button type="button" className="secondary" disabled={saveTpl.isPending} onClick={asTemplate}>
          💾 خلّيها الرسالة الأساسية
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

function DebtsScreen() {
  const { open } = useModal();
  const data = useDebts();
  const [f, setF] = useState<'all' | '30' | '60' | 'norem'>('all');
  const [sort, setSort] = useState<'amount' | 'age'>('amount');
  const [q, setQ] = useState('');
  const [remind, setRemind] = useState<DebtorDto | null>(null);
  const L = data.data?.debtors ?? [];
  const sumBal = (a: DebtorDto[]) => Math.round(a.reduce((s, x) => s + x.balance, 0) * 100) / 100;
  const o30 = L.filter((x) => aged(x, 30));
  const o60 = L.filter((x) => aged(x, 60));
  const nq = norm(q.trim());
  const F = L.filter(
    (x) => f === 'all' || (f === '30' && aged(x, 30)) || (f === '60' && aged(x, 60)) || (f === 'norem' && (!x.reminder || (daysAgo(x.reminder.at) ?? 0) >= 7)),
  )
    .filter((x) => !nq || norm(`${x.name} ${x.phone}`).includes(nq))
    .sort((a, b) => (sort === 'age' ? (b.old ? 1e6 : (b.days ?? 0)) - (a.old ? 1e6 : (a.days ?? 0)) : b.balance - a.balance));

  return (
    <section id="debts">
      <div className="title-row">
        <div className="title">
          <h1>💰 الديون والتذكير</h1>
          <p>العملاء اللي عليهم فلوس — ذكّرهم برسالة واتساب جاهزة</p>
        </div>
      </div>
      <div className="toolbar">
        {(
          [
            ['all', 'الكل'],
            ['30', 'أكتر من 30 يوم'],
            ['60', 'أكتر من 60 يوم'],
            ['norem', 'مااتفكّروش من أسبوع'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" className={f === k ? 'primary' : 'secondary'} onClick={() => setF(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <input className="search" placeholder="ابحث بالاسم أو التليفون..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="search" style={{ maxWidth: 170 }} value={sort} onChange={(e) => setSort(e.target.value as 'amount' | 'age')}>
          <option value="amount">الأكبر مبلغ</option>
          <option value="age">الأقدم</option>
        </select>
      </div>
      {data.isPending ? (
        <Loading />
      ) : data.isError ? (
        <ErrorBox message={errorMessage(data.error)} onRetry={() => data.refetch()} />
      ) : (
        <div>
          <div className="dtsum">
            <div>
              <small>إجمالي الديون عند العملاء</small>
              <b style={{ color: 'var(--danger)' }}>{money(sumBal(L))}</b>
            </div>
            <div>
              <small>عدد العملاء</small>
              <b>{L.length}</b>
            </div>
            <div>
              <small>أقدم من 30 يوم</small>
              <b>{money(sumBal(o30))}</b> <small>{o30.length} عميل</small>
            </div>
            <div>
              <small>أقدم من 60 يوم</small>
              <b>{money(sumBal(o60))}</b> <small>{o60.length} عميل</small>
            </div>
          </div>
          {F.length ? (
            F.map((x) => {
              const r = x.reminder;
              const cls = aged(x, 60) ? 'a60' : (x.days ?? 0) >= 30 ? 'a30' : '';
              return (
                <div key={x.id} className="card" style={{ marginBottom: 10 }}>
                  <div className="dtc">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <b style={{ fontSize: 17 }}>{x.name}</b>
                      {x.phone && (
                        <>
                          {' — '}
                          <a href={`tel:${x.phone}`} dir="ltr">
                            {x.phone}
                          </a>
                        </>
                      )}
                      <div className="meta">
                        {x.since ? (
                          <>
                            <span className={`dtage ${cls}`}>⏳ عليه {agoTxt(x.days)}</span> ({arDay(x.since)}){x.old ? ' + رصيد قديم' : ''}
                          </>
                        ) : (
                          <span className="dtage a60">رصيد قديم</span>
                        )}
                        {x.open.length ? ` • ${x.open.length} فاتورة` : ''}
                        <br />
                        {x.lastPay ? `آخر دفعة: ${money(x.lastPay.amount)} ${agoTxt(daysAgo(x.lastPay.date))}` : 'مفيش دفعات متسجلة'}
                        {r ? ` • 💬 اتفكّر ${agoTxt(daysAgo(r.at))}` : ''}
                      </div>
                    </div>
                    <div className="amt">{money(x.balance)}</div>
                  </div>
                  <div className="btnrow" style={{ marginTop: 8 }}>
                    <button type="button" className="primary" onClick={() => setRemind(x)}>
                      💬 ذكّره
                    </button>
                    <button type="button" className="secondary" onClick={() => open({ kind: 'payment', contactId: x.id })}>
                      💵 سجّل دفعة
                    </button>
                    <button type="button" className="secondary" onClick={() => open({ kind: 'contactFile', id: x.id })}>
                      📄 كشف الحساب
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="card">
              <div className="empty">{L.length ? 'مفيش عملاء هنا' : 'مفيش ديون على العملاء 👌'}</div>
            </div>
          )}
        </div>
      )}
      {remind && data.data && <RemindModal x={remind} tpl={data.data.template} onClose={() => setRemind(null)} />}
    </section>
  );
}

export default function DebtsPage() {
  return (
    <AdminOnly>
      <DebtsScreen />
    </AdminOnly>
  );
}
