'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errorMessage } from '@/lib/api';
import { setCtMode } from '@/lib/ct-mode';
import { money } from '@/lib/format';
import { invoiceA4Html, printHtml, receiptHtml } from '@/lib/print';
import { useSettings } from '@/lib/queries';
import { useAllContacts, useInvNotes, useInvoice, useSaveInvNote } from '@/lib/trade-queries';
import { Modal } from '../ui/modal';
import { Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useModal } from './modal-host';

export type ContactToolSpec = { kind: 'ctChooser' } | { kind: 'missing' } | { kind: 'invNotes'; no: string; id: string } | { kind: 'printAsk'; id: string };

/** The sidebar's «العملاء والموردين»: one icon, two screens (old mkCtChooser). */
function Chooser() {
  const { close } = useModal();
  const router = useRouter();
  const customers = useAllContacts('CUSTOMER').data;
  const suppliers = useAllContacts('SUPPLIER').data;
  const card = (t: 'CUSTOMER' | 'SUPPLIER', ic: string, title: string, sub: string, list: typeof customers) => {
    const owed = (list ?? []).reduce((a, c) => a + Math.max(0, c.balance), 0);
    return (
      <button
        type="button"
        onClick={() => {
          setCtMode(t);
          close();
          router.push('/contacts');
        }}
        style={{ padding: '16px 10px', border: '2px solid var(--border)', borderRadius: 16, background: 'var(--card,#fff)', textAlign: 'center', minHeight: 140, color: 'inherit', font: 'inherit' }}
      >
        <div style={{ fontSize: 38 }}>{ic}</div>
        <b style={{ fontSize: 19 }}>{title}</b>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          {list ? list.length : '…'} — {t === 'CUSTOMER' ? 'عليهم' : 'علينا'} {money(owed)}
        </div>
        <small style={{ display: 'block', color: 'var(--muted)', marginTop: 4 }}>{sub}</small>
      </button>
    );
  };
  return (
    <Modal title="👥 العملاء والموردين" onClose={close}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {card('CUSTOMER', '👥', 'العملاء', 'رصيد الآجل، كشف حساب، تحصيل، فواتير البيع', customers)}
        {card('SUPPLIER', '🏭', 'الموردين', 'اللي علينا، كشف حساب، سداد، فواتير الشراء', suppliers)}
      </div>
    </Modal>
  );
}

/** 📦 البضاعة الفاضلة لكل العملاء: العملاء اللي فاضل لهم بضاعة + الفواتير. */
function Missing() {
  const { close } = useModal();
  const notes = useInvNotes({ missing: true });
  const rows = notes.data;
  const byPerson = new Map<string, NonNullable<typeof rows>>();
  (rows ?? []).forEach((r) => byPerson.set(r.person, [...(byPerson.get(r.person) ?? []), r]));
  const phones = useAllContacts('CUSTOMER').data;
  return (
    <Modal title={`📦 البضاعة الفاضلة (${rows ? byPerson.size : '…'} عميل)`} onClose={close}>
      {!rows ? (
        <Loading />
      ) : byPerson.size ? (
        [...byPerson.entries()].map(([name, F]) => {
          const ph = phones?.find((c) => c.name === name)?.phone;
          return (
            <div key={name} className="card" style={{ marginBottom: 8, padding: 10, lineHeight: 1.8 }}>
              <b style={{ fontSize: 16 }}>{name}</b>
              {ph ? (
                <>
                  {' '}
                  <small dir="ltr">{ph}</small>
                </>
              ) : null}
              {F.map((f) => (
                <div key={f.no} style={{ borderTop: '1px dashed var(--border)', paddingTop: 4, marginTop: 4 }}>
                  {f.no} — {f.date} — <span style={{ color: '#b3261e' }}>فاضل: {f.miss}</span>
                </div>
              ))}
            </div>
          );
        })
      ) : (
        <div className="empty">مفيش بضاعة فاضلة عند أي عميل 👌</div>
      )}
    </Modal>
  );
}

/** 📦 استلام وناقص — فاتورة: تاريخ الاستلام، الناقص، تاريخ تسليم الناقص، اللي اتسلّم. */
function InvNotes({ no, id }: { no: string; id: string }) {
  const { open } = useModal();
  const toast = useToast();
  const all = useInvNotes({});
  const save = useSaveInvNote();
  const [f, setF] = useState<{ recv: string; miss: string; gotDate: string; got: string } | null>(null);
  const cur = all.data?.find((x) => x.no === no);
  const v = f ?? { recv: cur?.recv ?? '', miss: cur?.miss ?? '', gotDate: cur?.gotDate ?? '', got: cur?.got ?? '' };
  const back = () => open({ kind: 'invoice', id });
  if (all.isPending)
    return (
      <Modal title="📦 استلام وناقص — فاتورة" onClose={back}>
        <Loading />
      </Modal>
    );
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setF({ ...v, [k]: e.target.value });
  const go = async () => {
    try {
      await save.mutateAsync({ no, note: { recv: v.recv.trim(), miss: v.miss.trim(), gotDate: v.gotDate.trim(), got: v.got.trim() } });
      toast('✔ اتحفظ');
      back();
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
  return (
    <Modal title="📦 استلام وناقص — فاتورة" onClose={back}>
      <div className="form">
        <div className="field">
          <label>تاريخ الاستلام</label>
          <input type="date" value={v.recv} onChange={set('recv')} />
        </div>
        <div className="field">
          <label>الناقص يوم الاستلام (سطر لكل صنف)</label>
          <textarea rows={5} style={{ minHeight: 130 }} value={v.miss} onChange={set('miss')} />
        </div>
        <div className="field">
          <label>تاريخ تسليم الناقص</label>
          <input type="date" value={v.gotDate} onChange={set('gotDate')} />
        </div>
        <div className="field">
          <label>اللي اتسلّم بعد كده (سطر لكل صنف)</label>
          <textarea rows={5} style={{ minHeight: 130 }} value={v.got} onChange={set('got')} />
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>ده بيظهر للعميل في صفحته.</div>
        <button type="button" className="primary" style={{ width: '100%', padding: 16, marginTop: 10 }} disabled={save.isPending} onClick={() => void go()}>
          حفظ
        </button>
      </div>
    </Modal>
  );
}

/** 🖨️ نوع الطباعة: إيصال حراري 80 مم أو فاتورة A4، ويفتكر اختيارك على الجهاز. */
const PTK = 'mk_prtype';
function PrintAsk({ id }: { id: string }) {
  const { close } = useModal();
  const inv = useInvoice(id);
  const settings = useSettings().data;
  const [remember, setRemember] = useState(true);
  let d = '';
  try {
    d = localStorage.getItem(PTK) || '';
  } catch {
    /* private mode */
  }
  const go = (k: 'rcpt' | 'a4') => {
    if (!inv.data || !settings) return;
    try {
      if (remember) localStorage.setItem(PTK, k);
    } catch {
      /* private mode */
    }
    close();
    const r = inv.data;
    setTimeout(() => printHtml(k === 'a4' ? invoiceA4Html(r, settings) : receiptHtml(r, settings)), 50);
  };
  const dis = !inv.data || !settings;
  return (
    <Modal title="🖨️ نوع الطباعة" onClose={close}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" className={d === 'rcpt' ? 'primary' : 'secondary'} style={{ minHeight: 64, fontSize: 18, fontWeight: 800 }} disabled={dis} onClick={() => go('rcpt')}>
          🧾 إيصال حراري (80 مم)
        </button>
        <button type="button" className={d === 'a4' ? 'primary' : 'secondary'} style={{ minHeight: 64, fontSize: 18, fontWeight: 800 }} disabled={dis} onClick={() => go('a4')}>
          📄 فاتورة A4
        </button>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, fontSize: 15 }}>
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 24, height: 24 }} /> افتكر اختياري على الجهاز ده
      </label>
    </Modal>
  );
}

export function ContactToolModal({ spec }: { spec: ContactToolSpec }) {
  switch (spec.kind) {
    case 'printAsk':
      return <PrintAsk id={spec.id} />;
    case 'ctChooser':
      return <Chooser />;
    case 'missing':
      return <Missing />;
    case 'invNotes':
      return <InvNotes no={spec.no} id={spec.id} />;
  }
}
