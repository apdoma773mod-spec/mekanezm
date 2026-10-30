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

interface Item {
  id: string;
  code: string;
  name: string;
  unit: string;
  counted: number | null;
  system?: number;
  diff?: number | null;
  cost?: number;
}
interface Daily {
  day: string;
  status: 'open' | 'submitted' | 'approved';
  by: string | null;
  at: string | null;
  approvedBy: string | null;
  items: Item[];
}

export const useDaily = () =>
  useQuery({ queryKey: ['daily-count'], queryFn: ({ signal }) => api.get<Daily>('/daily-count', undefined, signal), staleTime: 30000 });

/** Dashboard card: «🧮 جرد النهاردة — 10 أصناف». */
export function DailyCountCard() {
  const { open } = useModal();
  const d = useDaily();
  const admin = useIsAdmin();
  if (!d.data) return null;
  const s = d.data.status;
  const diffs = admin ? d.data.items.filter((i) => i.diff).length : 0;
  return (
    <button
      type="button"
      id="dailyCountCard"
      className="secondary"
      onClick={() => open({ kind: 'dailyCount' })}
      style={{ width: '100%', marginBottom: 10, padding: 12, fontWeight: 800, textAlign: 'right' }}
    >
      {s === 'open' && '🧮 جرد النهاردة — عدّ 10 أصناف (3 دقايق)'}
      {s === 'submitted' && (admin ? `🧮 جرد النهاردة اتعدّ (${d.data.by}) — ${diffs ? `فيه ${diffs} صنف فيهم فرق، مستني اعتمادك` : 'من غير فروق، مستني تقفله'}` : '🧮 جرد النهاردة اتبعت ✔')}
      {s === 'approved' && '🧮 جرد النهاردة خلص ✔'}
    </button>
  );
}

export function DailyCountModal() {
  const { close } = useModal();
  const toast = useToast();
  const qc = useQueryClient();
  const admin = useIsAdmin();
  const d = useDaily();
  const [vals, setVals] = useState<Record<string, string>>({});
  const refresh = () => qc.invalidateQueries({ queryKey: ['daily-count'] });
  const send = useMutation({
    mutationFn: (answers: { productId: string; counted: number }[]) => api.post('/daily-count', { answers }),
    onSuccess: () => {
      toast('✔ الجرد اتبعت');
      void refresh();
    },
    onError: (e) => toast(errorMessage(e), 'bad'),
  });
  const decide = useMutation({
    mutationFn: (k: 'approve' | 'close') => api.post(`/daily-count/${k}`, {}),
    onSuccess: (_r, k) => {
      toast(k === 'approve' ? '✔ المخزون اتعدّل بالعدّ' : '✔ الجرد اتقفل من غير تعديل');
      void refresh();
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e) => toast(errorMessage(e), 'bad'),
  });

  if (d.isPending)
    return (
      <Modal title="🧮 جرد النهاردة" onClose={close}>
        <Loading />
      </Modal>
    );
  if (d.isError)
    return (
      <Modal title="🧮 جرد النهاردة" onClose={close}>
        <ErrorBox message={errorMessage(d.error)} onRetry={() => d.refetch()} />
      </Modal>
    );
  const x = d.data;
  const num = (s: string) => Number(s.replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[٫،,]/g, '.'));
  const filled = x.items.every((i) => (vals[i.id] ?? '').trim() !== '' && Number.isFinite(num(vals[i.id]!)));
  const diffs = x.items.filter((i) => i.diff);
  const lossValue = diffs.reduce((a, i) => a + (i.diff! < 0 ? -i.diff! * (i.cost ?? 0) : 0), 0);

  return (
    <Modal title="🧮 جرد النهاردة" onClose={close} wide>
      {x.status === 'open' && (
        <>
          <p style={{ marginTop: 0, color: 'var(--muted)' }}>روح للرف وعدّ كل صنف بإيدك واكتب العدد اللي لقيته. السيستم مش هيوريك الرصيد عشان العدّ يبقى أمين.</p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>الكود</th>
                  <th>عددته كام؟</th>
                </tr>
              </thead>
              <tbody>
                {x.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <b>{i.name}</b> <small style={{ color: 'var(--muted)' }}>({i.unit})</small>
                    </td>
                    <td dir="ltr">{i.code}</td>
                    <td>
                      <input inputMode="decimal" dir="ltr" style={{ width: 90 }} value={vals[i.id] ?? ''} onChange={(e) => setVals({ ...vals, [i.id]: e.target.value })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-foot">
            <button type="button" className="primary" disabled={!filled || send.isPending} onClick={() => send.mutate(x.items.map((i) => ({ productId: i.id, counted: num(vals[i.id]!) })))}>
              {send.isPending ? '⏳ بيتبعت…' : '✔ ابعت الجرد'}
            </button>
            <button type="button" className="secondary" onClick={close}>
              بعدين
            </button>
          </div>
        </>
      )}
      {x.status !== 'open' && (
        <>
          <p style={{ marginTop: 0 }}>
            {x.status === 'submitted' ? `اتعدّ بواسطة ${x.by}.` : `اتقفل${x.approvedBy ? ` بواسطة ${x.approvedBy}` : ''}.`}
            {!admin && ' شكراً ✔'}
          </p>
          {admin && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>الصنف</th>
                    <th>السيستم</th>
                    <th>العدّ</th>
                    <th>الفرق</th>
                  </tr>
                </thead>
                <tbody>
                  {x.items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.name}</td>
                      <td>{i.system}</td>
                      <td>{i.counted}</td>
                      <td style={{ fontWeight: 700, color: i.diff ? (i.diff < 0 ? 'var(--danger)' : '#b26a00') : 'var(--green)' }}>{i.diff ? `${i.diff > 0 ? '+' : ''}${i.diff}` : '✔'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {admin && x.status === 'submitted' && (
            <>
              {lossValue > 0 && <p style={{ color: 'var(--danger)' }}>العجز بسعر الشراء: {money(lossValue)}</p>}
              <div className="modal-foot">
                {diffs.length > 0 && (
                  <button type="button" className="primary" disabled={decide.isPending} onClick={() => decide.mutate('approve')}>
                    ✔ اعتمد العدّ وعدّل المخزون
                  </button>
                )}
                <button type="button" className={diffs.length ? 'secondary' : 'primary'} disabled={decide.isPending} onClick={() => decide.mutate('close')}>
                  {diffs.length ? 'اقفله من غير تعديل' : '✔ تمام، اقفله'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
