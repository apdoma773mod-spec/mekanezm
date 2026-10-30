'use client';

import { useState } from 'react';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { InboxCard, InboxTabs } from '@/components/inbox/inbox-tabs';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useContacts, useCreatePayment } from '@/lib/trade-queries';
import { useInboxCounts, useWaPhotoStatus, useWaPhotos, type InboxTab, type WaPhotoRow } from '@/lib/inbox-queries';

/** 🖼️ تحويلات الواتساب: صور الإيصالات والتصاميم اللي العملاء بعتوها. */
const LABEL: Record<WaPhotoRow['status'], string> = {
  new: 'جديدة',
  sent: 'اتبعتت',
  paid: 'اتدفعت',
  transfer: 'اتسجلت تحويل',
  missing: 'مش موجودة',
  ignored: 'متجاهلة',
};

interface Tf {
  is_transfer?: boolean;
  confidence?: number;
  amount?: number;
  sender_name?: string;
  sender_account?: string;
}

const l10 = (s: unknown) => String(s ?? '').replace(/\D/g, '').slice(-10);

async function photoB64(src: string): Promise<{ image: string; mt: string }> {
  if (src.startsWith('data:')) return { image: src.replace(/^data:[^,]+,/, ''), mt: (src.match(/^data:([^;]+)/) ?? [])[1] ?? 'image/jpeg' };
  const blob = await fetch(src, { credentials: 'include' }).then((r) => r.blob());
  const url = await new Promise<string>((ok, bad) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = bad;
    r.readAsDataURL(blob);
  });
  return { image: url.replace(/^data:[^,]+,/, ''), mt: blob.type || 'image/jpeg' };
}

/** Old checkTransfer(): is this photo a money transfer? → «💸 تحويل فلوس» and «✔ سجّلها دفعة من …» (kind:'transfer' read). */
function TransferCheck({ p, onPaid }: { p: WaPhotoRow; onPaid: () => void }) {
  const toast = useToast();
  const pay = useCreatePayment();
  const [state, setState] = useState<'idle' | 'busy' | 'no' | Tf>('idle');
  const [pick, setPick] = useState('');
  const tf = typeof state === 'object' ? state : null;
  const people = useContacts({ q: pick.trim() || undefined, pageSize: 20 }, !!tf);
  const byPhone = useContacts({ q: l10(tf?.sender_account) || l10(p.phone) || undefined, pageSize: 5 }, !!tf);
  const known =
    byPhone.data?.items.find((c) => l10(c.phone) && (l10(c.phone) === l10(tf?.sender_account) || l10(c.phone) === l10(p.phone))) ??
    (tf?.sender_name ? people.data?.items.find((c) => c.name.trim() === tf.sender_name!.trim()) : undefined);
  const chosen = known ?? people.data?.items.find((c) => c.name === pick.trim());

  const check = async () => {
    setState('busy');
    try {
      const { image, mt } = await photoB64(p.img);
      const r = await api.post<Tf>('/ai/read-image', { image, media_type: mt, kind: 'transfer' });
      setState(r.is_transfer === false || !(Number(r.confidence ?? 0) >= 0.55) || !(Number(r.amount) > 0) ? 'no' : r);
    } catch (e) {
      setState('idle');
      toast(`✘ ${errorMessage(e)}`, 'bad');
    }
  };
  const apply = async () => {
    if (!tf) return;
    if (!chosen) return toast('اختار اسم العميل أو المورد من القايمة اللي بتظهر وانت بتكتب الأول', 'bad');
    try {
      await pay.mutateAsync({ company: 'MK', contactId: chosen.id, amount: Number(tf.amount), method: 'INSTAPAY', note: `تحويل واتساب${p.phone ? ` من ${p.phone}` : ''}` });
      toast('✔ اتسجلت كدفعة');
      onPaid();
    } catch (e) {
      toast(`✘ ${errorMessage(e)}`, 'bad');
    }
  };

  if (state === 'idle')
    return (
      <button type="button" className="secondary" onClick={() => void check()}>
        💸 تحويل فلوس؟
      </button>
    );
  if (state === 'busy') return <div className="vsseen">⏳ بنشوف هل دي صورة تحويل فلوس ولا لأ…</div>;
  if (state === 'no') return <div className="vsseen">🤔 الصورة دي غالبًا مش تحويل فلوس</div>;
  return (
    <div className="card" style={{ width: '100%', background: '#eef6f7' }}>
      <b>💸 تحويل فلوس</b>
      <div style={{ margin: '6px 0' }}>
        المبلغ: <b>{money(Number(tf!.amount))}</b>
        {tf!.sender_name ? ` — من: ${tf!.sender_name}` : ''}
        {tf!.sender_account ? ` — ${tf!.sender_account}` : ''}
      </div>
      {known ? (
        <>
          <div>
            <b>{known.name}</b> <small style={{ color: 'var(--muted)' }}>— اتعرف عليه من رقمه</small>
          </div>
          <button type="button" className="primary" style={{ marginTop: 8 }} disabled={pay.isPending} onClick={() => void apply()}>
            {pay.isPending ? '⏳ بيتسجّل…' : `✔ سجّلها دفعة من ${known.name}`}
          </button>
        </>
      ) : (
        <>
          <div style={{ background: '#fff6e5', borderRadius: 10, padding: 8 }}>الرقم ده مش مسجّل عندك — اختار تحطها على حساب مين:</div>
          <input list={`tfPL-${p.id}`} placeholder="دوّر على عميل أو مورد..." value={pick} onChange={(e) => setPick(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
          <datalist id={`tfPL-${p.id}`}>{people.data?.items.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          <button type="button" className="primary" style={{ marginTop: 8 }} disabled={pay.isPending} onClick={() => void apply()}>
            {pay.isPending ? '⏳ بيتسجّل…' : '✔ سجّلها دفعة'}
          </button>
        </>
      )}
      <button type="button" className="secondary" style={{ marginTop: 8, marginRight: 6 }} onClick={() => setState('no')}>
        دي مش تحويل
      </button>
    </div>
  );
}

function PhotoCard({ p, tab }: { p: WaPhotoRow; tab: InboxTab }) {
  const toast = useToast();
  const status = useWaPhotoStatus();
  const busy = status.isPending;
  const set = (s: WaPhotoRow['status']) =>
    status.mutate({ id: p.id, status: s }, { onError: (e) => toast(`ماتحفظتش: ${errorMessage(e)}`, 'bad') });
  return (
    <InboxCard tone={tab === 'new' ? 'new' : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <b>{p.name || 'زبون'}</b>
        <small dir="ltr" style={{ color: 'var(--muted)' }}>
          {p.phone} · {new Date(p.createdAt).toLocaleString('ar-EG')}
        </small>
      </div>
      {p.caption && <div style={{ whiteSpace: 'pre-wrap', margin: '6px 0', lineHeight: 1.8 }}>{p.caption}</div>}
      <a href={p.img} target="_blank" rel="noreferrer" style={{ display: 'block', margin: '8px 0' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.img} alt="صورة من الواتساب" style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 12 }} />
      </a>
      {tab !== 'new' && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{LABEL[p.status]}{p.handledBy ? ` — ${p.handledBy}` : ''}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {tab === 'new' && (
          <>
            <button type="button" className="primary" disabled={busy} onClick={() => set('sent')}>
              ✔ اتبعتت
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={() => set('paid')}>
              💰 اتدفعت
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={() => set('missing')}>
              ❌ مش موجودة
            </button>
            <TransferCheck p={p} onPaid={() => set('paid')} />
            <button type="button" className="secondary" disabled={busy} onClick={() => set('ignored')}>
              🙈 تجاهل
            </button>
          </>
        )}
        {tab !== 'new' && (
          <button type="button" className="secondary" disabled={busy} onClick={() => set('new')}>
            ↩️ رجّعها للجديدة
          </button>
        )}
      </div>
    </InboxCard>
  );
}

function PhotosList() {
  const [tab, setTab] = useState<InboxTab>('new');
  const counts = useInboxCounts();
  const list = useWaPhotos(tab);
  return (
    <>
      <InboxTabs value={tab} onChange={setTab} counts={{ new: counts.data?.waPhotos }} />
      {list.isPending && <Loading />}
      {list.isError && <ErrorBox message={errorMessage(list.error)} onRetry={() => list.refetch()} />}
      {list.data && list.data.length === 0 && <div className="empty">مفيش صور هنا 👌</div>}
      {list.data?.map((p) => (
        <PhotoCard key={p.id} p={p} tab={tab} />
      ))}
    </>
  );
}

export default function TransfersPage() {
  return (
    <AdminOnly>
      <PageHeader title="تحويلات الواتساب" subtitle="صور الإيصالات والتصاميم اللي العملاء بعتوها على واتساب المحل" />
      <PhotosList />
    </AdminOnly>
  );
}
