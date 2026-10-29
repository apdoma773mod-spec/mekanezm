'use client';

import { useState, type FormEvent } from 'react';
import type { SampleDto } from '@mk/shared';
import { Modal } from '@/components/ui/modal';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useIsAdmin } from '@/components/use-role';
import { errorMessage } from '@/lib/api';
import { arDate, qtyText, todayYmd } from '@/lib/format';
import { useCreateSample, useSampleFlag, useSamples, useSampleStatus } from '@/lib/phase4-queries';
import { useMe } from '@/lib/queries';
import { useProducts } from '@/lib/trade-queries';

const BADGE = { out: '🧪 خارجة', returned: '↩️ رجعت', sold: '✅ اتباعت', lost: '⚠️ خسارة' } as const;

function NewSample({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const me = useMe().data;
  const create = useCreateSample();
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [customer, setCustomer] = useState('');
  const [date, setDate] = useState(todayYmd());
  const [by, setBy] = useState(me?.name ?? '');
  const prods = useProducts({ q: name.trim(), pageSize: 15 }, name.trim().length >= 2);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = prods.data?.items.find((x) => x.name === name.trim());
    try {
      await create.mutateAsync({ productId: p?.id, productName: name.trim(), qty: Number(qty) || 1, customer: customer.trim(), date, givenBy: by.trim() });
      onClose();
      toast('✔ اتسجّلت العينة');
    } catch (err) {
      toast(`❌ ${errorMessage(err)}`, 'bad');
    }
  };
  return (
    <Modal title="🧪 عينة جديدة" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form">
          <div className="field full">
            <label>الصنف</label>
            <input list="smPL" placeholder="اسم الصنف" required value={name} onChange={(e) => setName(e.target.value)} />
            <datalist id="smPL">{prods.data?.items.map((p) => <option key={p.id} value={p.name} />)}</datalist>
          </div>
          <div className="field">
            <label>الكمية</label>
            <input type="number" min="0.001" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="field">
            <label>العميل</label>
            <input placeholder="اسم العميل" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </div>
          <div className="field">
            <label>التاريخ</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>سلّمها</label>
            <input value={by} onChange={(e) => setBy(e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="primary" disabled={create.isPending}>
            حفظ العينة
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Row({ s }: { s: SampleDto }) {
  const toast = useToast();
  const set = useSampleStatus();
  const act = async (status: 'returned' | 'sold' | 'lost') => {
    try {
      await set.mutateAsync({ id: s.id, status });
      toast('✔ تم');
    } catch (e) {
      toast(`❌ ${errorMessage(e)}`, 'bad');
    }
  };
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <b>{s.productName}</b> × {qtyText(s.qty)}
          <br />
          <small style={{ color: 'var(--muted)' }}>
            {s.customer || 'بدون اسم'} — {arDate(s.date)} — {BADGE[s.status]}
            {s.givenBy ? ` — سلّمها ${s.givenBy}` : ''}
          </small>
        </div>
        {s.status === 'out' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="secondary" disabled={set.isPending} onClick={() => act('returned')}>
              رجعت
            </button>
            <button type="button" className="secondary" disabled={set.isPending} onClick={() => act('sold')}>
              بيعت
            </button>
            <button type="button" className="secondary danger" disabled={set.isPending} onClick={() => act('lost')}>
              خسارة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SamplesPage() {
  const admin = useIsAdmin();
  const data = useSamples();
  const flag = useSampleFlag();
  const [adding, setAdding] = useState(false);
  if (data.isPending) return <Loading />;
  if (data.isError) return <ErrorBox message={errorMessage(data.error)} onRetry={() => data.refetch()} />;
  const { on, samples } = data.data;
  if (!on && !admin) return <div className="empty">العينات مقفولة دلوقتي.</div>;
  const out = samples.filter((x) => x.status === 'out');
  const rest = samples.filter((x) => x.status !== 'out');
  return (
    <>
      <div className="title-row">
        <div className="title">
          <h1>🧪 العينات</h1>
          <p>عينة خرجت من غير بيع — تتبعها لحد ما ترجع أو تتباع</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {admin && (
            <button type="button" className="secondary" disabled={flag.isPending} onClick={() => flag.mutate(!on)}>
              {on ? 'إقفال الميزة' : 'تشغيل الميزة'}
            </button>
          )}
          <button type="button" className="primary" onClick={() => setAdding(true)}>
            ＋ عينة جديدة
          </button>
        </div>
      </div>
      <b>العينات الخارجة ومع مين ({out.length})</b>
      {out.length ? out.map((s) => <Row key={s.id} s={s} />) : <div className="empty">مفيش عينات خارجة دلوقتي</div>}
      <div style={{ marginTop: 18 }}>
        <b>السجل</b>
        {rest.length ? rest.map((s) => <Row key={s.id} s={s} />) : <div className="empty">لسه مفيش سجل</div>}
      </div>
      {adding && <NewSample onClose={() => setAdding(false)} />}
    </>
  );
}
