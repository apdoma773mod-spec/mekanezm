'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/app-shell';
import { useModal } from '@/components/modals/modal-host';
import { ErrorBox, Loading } from '@/components/ui/states';
import { TileLink, useShowMore } from '@/components/ui/tiles';
import { useToast } from '@/components/ui/toast';
import { useIsAdmin } from '@/components/use-role';
import { api, errorMessage } from '@/lib/api';
import { qtyText } from '@/lib/format';
import { useWarehouses, type WarehouseDto } from '@/lib/trade-queries';

/** 🏬 إدارة المخازن: كل مخزن وإيه جواه ومكانه (عين/رف). التسجيل بيتم من «تفاصيل وصور» في شاشة المنتج. */
interface Item {
  id: string;
  code: string;
  name: string;
  unit: string;
  qty: number;
  spot: string;
  inStore: number | null;
}

function WarehouseView({ w, admin, onBack }: { w: WarehouseDto; admin: boolean; onBack: () => void }) {
  const { open } = useModal();
  const toast = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<{ name: string; note: string } | null>(null);
  const list = useQuery({ queryKey: ['warehouse-products', w.id], queryFn: ({ signal }) => api.get<{ items: Item[] }>(`/warehouses/${w.id}/products`, undefined, signal) });
  const nq = q.trim().toLowerCase();
  const items = (list.data?.items ?? []).filter((i) => !nq || i.name.toLowerCase().includes(nq) || i.code.toLowerCase().includes(nq) || i.spot.toLowerCase().includes(nq));
  const { shown, more } = useShowMore(items, 40, q);
  const refresh = () => qc.invalidateQueries({ queryKey: ['warehouses'] });
  const saveEdit = async () => {
    if (!edit) return;
    try {
      await api.put(`/warehouses/${w.id}`, edit);
      toast('✔ اتحفظ');
      setEdit(null);
      void refresh();
      onBack();
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
  const del = async () => {
    if (!window.confirm(`تمسح مخزن «${w.name}»؟`)) return;
    try {
      await api.delete(`/warehouses/${w.id}`);
      toast('✔ اتمسح');
      void refresh();
      onBack();
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
  return (
    <>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onBack}>
          ← المخازن
        </button>
        <b style={{ fontSize: 18 }}>🏬 {w.name}</b>
        {w.note && <small style={{ color: '#7b8a90' }}>{w.note}</small>}
        {admin && (
          <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 6 }}>
            <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setEdit({ name: w.name, note: w.note })}>
              ✏️ تعديل
            </button>
            <button type="button" className="secondary" style={{ width: 'auto', color: 'var(--danger)' }} onClick={() => void del()}>
              🗑️ مسح
            </button>
          </span>
        )}
      </div>
      {edit && (
        <div className="card" style={{ padding: 12, marginBottom: 8, display: 'grid', gap: 6 }}>
          <input value={edit.name} placeholder="اسم المخزن" onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <input value={edit.note} placeholder="ملاحظة (اختياري) — العنوان مثلاً" onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="primary" onClick={() => void saveEdit()}>
              حفظ
            </button>
            <button type="button" className="secondary" onClick={() => setEdit(null)}>
              إلغاء
            </button>
          </div>
        </div>
      )}
      <input placeholder="🔎 دوّر باسم المنتج أو كوده أو مكانه (عين 5)" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorBox message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : !items.length ? (
        <div className="card" style={{ padding: 14, color: '#7b8a90' }}>
          {list.data?.items.length ? 'مفيش نتيجة للبحث ده.' : 'مفيش منتجات متسجلة في المخزن ده لسه. افتح أي منتج ← «تفاصيل وصور» ← «➕ مكان في مخزن».'}
        </div>
      ) : (
        <div className="card">
          {shown.map((i) => (
            <div key={`${i.id}-${i.spot}`} className="prow" style={{ padding: 11, borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }} onClick={() => open({ kind: 'product', id: i.id })}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{i.name}</b>
                <div style={{ fontSize: 12, color: '#7b8a90' }}>
                  {i.code}
                  {i.spot ? ` · ${i.spot}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'end', fontSize: 13, flex: 'none' }}>
                {i.inStore != null ? (
                  <b>
                    {qtyText(i.inStore)} {i.unit}
                  </b>
                ) : (
                  <span style={{ color: '#7b8a90' }}>
                    رصيد {qtyText(i.qty)} {i.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
          {more}
        </div>
      )}
    </>
  );
}

export default function WarehousesPage() {
  const admin = useIsAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const wh = useWarehouses();
  const [sel, setSel] = useState<string | null>(null);
  const [add, setAdd] = useState<{ name: string; note: string } | null>(null);
  const cur = wh.data?.find((x) => x.id === sel) ?? null;
  const create = async () => {
    if (!add?.name.trim()) return toast('اكتب اسم المخزن', 'bad');
    try {
      await api.post('/warehouses', { name: add.name, note: add.note });
      toast('✔ المخزن اتضاف');
      setAdd(null);
      void qc.invalidateQueries({ queryKey: ['warehouses'] });
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
  return (
    <>
      <PageHeader
        title="🏬 المخازن"
        subtitle="كل مخزن وإيه اللي جواه ومكانه"
        action={
          admin && !cur ? (
            <button type="button" className="primary" style={{ width: 'auto' }} onClick={() => setAdd({ name: '', note: '' })}>
              ➕ مخزن جديد
            </button>
          ) : undefined
        }
      />
      {add && !cur && (
        <div className="card" style={{ padding: 12, marginBottom: 10, display: 'grid', gap: 6 }}>
          <input autoFocus value={add.name} placeholder="اسم المخزن (مثلاً: المخزن الرئيسي)" onChange={(e) => setAdd({ ...add, name: e.target.value })} />
          <input value={add.note} placeholder="ملاحظة (اختياري) — العنوان مثلاً" onChange={(e) => setAdd({ ...add, note: e.target.value })} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="primary" onClick={() => void create()}>
              إضافة
            </button>
            <button type="button" className="secondary" onClick={() => setAdd(null)}>
              إلغاء
            </button>
          </div>
        </div>
      )}
      {cur ? (
        <WarehouseView w={cur} admin={admin} onBack={() => setSel(null)} />
      ) : wh.isPending ? (
        <Loading />
      ) : wh.isError ? (
        <ErrorBox message={errorMessage(wh.error)} onRetry={() => wh.refetch()} />
      ) : !wh.data.length ? (
        <div className="card" style={{ padding: 14, color: '#7b8a90' }}>
          {admin ? 'لسه مفيش مخازن. دوس «➕ مخزن جديد» وابدأ بالمخزن الرئيسي، وبعدين سجّل مكان كل منتج فيه من شاشة المنتج.' : 'لسه مفيش مخازن متسجلة.'}
        </div>
      ) : (
        <div className="mk-tiles" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' }}>
          {wh.data.map((w) => (
            <TileLink key={w.id} icon="🏬" title={w.name} sub={w.note || `${w.products} منتج`} badge={w.products} onClick={() => setSel(w.id)} />
          ))}
        </div>
      )}
    </>
  );
}
