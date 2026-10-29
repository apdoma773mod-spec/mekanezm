'use client';

import { useMemo, useState } from 'react';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useApplySms, useSmsPending, useSmsStatus, type SmsPending } from '@/lib/inbox-queries';
import { useContacts } from '@/lib/trade-queries';

/** 📲 فلوس فودافون كاش: مابتتسجلش على حساب غير لما انت تقول لمين. */
function SmsCard({ x, names }: { x: SmsPending; names: Map<string, { id: string; name: string; type: string; phone: string }> }) {
  const toast = useToast();
  const apply = useApplySms();
  const status = useSmsStatus();
  const [pick, setPick] = useState('');
  const who = [...names.values()].find((c) => c.name === pick);
  const outgoing = x.direction === 'out';
  const busy = apply.isPending || status.isPending;

  const submit = () => {
    if (!who) return toast('اختار الحساب من القايمة الأول', 'bad');
    const note = `${outgoing ? 'حوّلت' : 'وصلت'} فودافون كاش — رقم ${x.phone ?? '؟'}`;
    apply.mutate(
      { smsId: x.id, contactId: who.id, amount: x.amount, note },
      {
        onSuccess: () => toast(`✔ اتسجل ${money(x.amount)} على حساب ${who.name}`),
        onError: (e) => toast(`ماتسجلش: ${errorMessage(e)}`, 'bad'),
      },
    );
  };

  return (
    <div className="card" style={{ marginBottom: 10, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <b style={{ fontSize: 19 }}>
          {outgoing ? '📤 بعتّ' : '📥 استلمت'} {money(x.amount)}
        </b>
        <small style={{ color: 'var(--muted)' }}>{new Date(x.receivedAt).toLocaleString('ar-EG')}</small>
      </div>
      <div style={{ fontSize: 13, margin: '4px 0 8px' }}>
        الرقم: {x.phone ? <span dir="ltr" style={{ fontWeight: 700 }}>{x.phone}</span> : <span style={{ color: 'var(--muted)' }}>من غير رقم ظاهر</span>}
      </div>
      <input
        list="vfContacts"
        value={pick}
        onChange={(e) => setPick(e.target.value)}
        placeholder="🔍 اختار اسم العميل أو المورد"
        style={{ width: '100%' }}
        autoComplete="off"
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" className="primary" disabled={busy || !who} onClick={submit}>
          ✔ سجّلها على الحساب
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={() => status.mutate({ id: x.id, status: 'ignored' })}>
          🚫 مش فلوس شغل
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={() => status.mutate({ id: x.id, status: 'used' })}>
          💸 اقفلها من غير حساب
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{x.note}</div>
    </div>
  );
}

function VodafoneList() {
  const pending = useSmsPending();
  const contacts = useContacts({ pageSize: 200, sort: 'name' });
  const names = useMemo(() => {
    const m = new Map<string, { id: string; name: string; type: string; phone: string }>();
    for (const c of contacts.data?.items ?? []) m.set(c.id, { id: c.id, name: `${c.name} — ${c.type === 'CUSTOMER' ? 'عميل' : 'مورد'}`, type: c.type, phone: c.phone });
    return m;
  }, [contacts.data]);
  // the datalist shows «name — عميل/مورد», the picker matches on that same text
  const byLabel = useMemo(() => new Map([...names.values()].map((c) => [c.name, c])), [names]);

  if (pending.isPending) return <Loading />;
  if (pending.isError) return <ErrorBox message={errorMessage(pending.error)} onRetry={() => pending.refetch()} />;
  const items = pending.data ?? [];
  return (
    <>
      <datalist id="vfContacts">
        {[...byLabel.keys()].map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>
      {items.length === 0 ? (
        <div className="empty">مفيش فلوس مستنية 👌</div>
      ) : (
        items.map((x) => <SmsCard key={x.id} x={x} names={byLabel} />)
      )}
    </>
  );
}

export default function VodafonePage() {
  return (
    <AdminOnly>
      <PageHeader title="فلوس فودافون كاش" subtitle="فلوس وصلت أو اتبعتت من موبايلك. أنت اللي بتقرر تتسجل على مين — مفيش حاجة بتتسجل لوحدها." />
      <VodafoneList />
    </AdminOnly>
  );
}
