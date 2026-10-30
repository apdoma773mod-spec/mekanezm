'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { Modal } from '../ui/modal';
import { ErrorBox, Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useIsAdmin } from '../use-role';
import { useModal } from './modal-host';

interface Rise {
  productId: string;
  name: string;
  oldCost: number;
  newCost: number;
  sell: number;
  pct: number;
  suggested: number;
  invoiceNo: string;
}
const useRises = (enabled = true) =>
  useQuery({ queryKey: ['cost-rises'], enabled, queryFn: ({ signal }) => api.get<{ items: Rise[] }>('/cost-rises', undefined, signal).then((r) => r.items), staleTime: 30000 });

/** Dashboard card: «📈 تكلفة N صنف غلت — راجع أسعار البيع». */
export function CostRisesCard() {
  const admin = useIsAdmin();
  const { open } = useModal();
  const q = useRises(admin);
  if (!admin || !q.data?.length) return null;
  return (
    <button type="button" id="costRisesCard" onClick={() => open({ kind: 'costRises' })} style={{ width: '100%', marginBottom: 10, padding: 12, fontWeight: 800, textAlign: 'right', borderRadius: 14, border: '1px solid #f0b46a', background: '#fff4e5', color: '#8a4b00', font: 'inherit' }}>
      📈 تكلفة <b>{q.data.length}</b> صنف غلت — راجع أسعار البيع
    </button>
  );
}

function Row({ r }: { r: Rise }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [price, setPrice] = useState(String(r.suggested));
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['cost-rises'] });
    void qc.invalidateQueries({ queryKey: ['products'] });
  };
  const apply = useMutation({
    mutationFn: () => api.post(`/cost-rises/${r.productId}/apply`, { price: Number(price.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٫،]/g, '.')) }),
    onSuccess: () => (toast('✔ سعر البيع اتعدّل'), done()),
    onError: (e) => toast(errorMessage(e), 'bad'),
  });
  const dismiss = useMutation({ mutationFn: () => api.post(`/cost-rises/${r.productId}/dismiss`, {}), onSuccess: done, onError: (e) => toast(errorMessage(e), 'bad') });
  return (
    <tr>
      <td>
        <b>{r.name}</b>
        <small style={{ display: 'block', color: 'var(--muted)' }}>فاتورة {r.invoiceNo}</small>
      </td>
      <td>
        {money(r.oldCost)} ← <b>{money(r.newCost)}</b>
        <small style={{ display: 'block', color: 'var(--danger)' }}>+{r.pct}%</small>
      </td>
      <td>{money(r.sell)}</td>
      <td>
        <input inputMode="decimal" dir="ltr" style={{ width: 80 }} value={price} onChange={(e) => setPrice(e.target.value)} />
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <button type="button" className="primary" disabled={apply.isPending} onClick={() => apply.mutate()}>
          عدّل
        </button>{' '}
        <button type="button" className="secondary" disabled={dismiss.isPending} onClick={() => dismiss.mutate()}>
          سيبه
        </button>
      </td>
    </tr>
  );
}

export function CostRisesModal() {
  const { close } = useModal();
  const q = useRises();
  return (
    <Modal title="📈 تكلفة أصناف غلت" onClose={close} wide>
      <p style={{ marginTop: 0, color: 'var(--muted)' }}>الأصناف دي اتشرت بسعر أغلى من قبل بـ3% أو أكتر. السعر المقترح بيحافظ على نفس هامش الربح القديم، وتقدر تغيّره قبل ما تعدّل.</p>
      {q.isPending && <Loading />}
      {q.isError && <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && !q.data.length && <div className="empty">مفيش أصناف محتاجة مراجعة ✔</div>}
      {!!q.data?.length && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الصنف</th>
                <th>الشراء</th>
                <th>البيع دلوقتي</th>
                <th>البيع الجديد</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data.map((r) => (
                <Row key={r.productId} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
