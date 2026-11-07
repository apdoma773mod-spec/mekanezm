'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { useToast } from './ui/toast';

interface Cfg {
  staffMonthly: { on: boolean };
  debtsWeekly: { on: boolean; day: number; time: string; minDays: number; minAmount: number };
  onlineStatus: { on: boolean };
}
const DAYS = ['الأحد', 'الإثنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];

/** «🤖 رسائل تلقائية» in settings: the owner's monthly worker summary, weekly debt reminders and online-customer shipment messages. */
export function AutoMessagesCard() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['autosend'], queryFn: () => api.get<{ config: Cfg }>('/autosend').then((r) => r.config) });
  const [draft, setDraft] = useState<Cfg | null>(null);
  const c = draft ?? q.data;
  const save = useMutation({
    mutationFn: (v: Cfg) => api.put('/autosend', v),
    onSuccess: () => {
      toast('✔ اتحفظ');
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ['autosend'] });
    },
    onError: (e) => toast(errorMessage(e), 'bad'),
  });
  const now = useMutation({
    mutationFn: () => api.post<{ sent: number }>('/autosend/staff-summary', {}),
    onSuccess: (r) => toast(r.sent ? '✔ الملخص اتحط في طابور الواتساب' : 'مفيش عمال متسجلين'),
    onError: (e) => toast(errorMessage(e), 'bad'),
  });
  if (!c) return null;
  const set = (p: Partial<Cfg>) => setDraft({ ...c, ...p });
  const row = { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 0', borderTop: '1px solid var(--border)' } as const;

  return (
    <div className="card" style={{ marginTop: 14 }} id="autoMsgs">
      <h3>🤖 رسائل تلقائية</h3>
      <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>الرسائل دي بتتحط في طابور الواتساب وتتبعت لوحدها. اللي رايح لعملاء مقفول لحد ما إنت تفتحه.</div>

      <label style={row}>
        <input type="checkbox" checked={c.staffMonthly.on} onChange={(e) => set({ staffMonthly: { on: e.target.checked } })} />
        <span>
          <b>📅 ملخص العمال أول كل شهر (ليك انت بس)</b>
          <small style={{ display: 'block', color: 'var(--muted)' }}>لكل عامل: حضر كام يوم، اتأخر كام مرة، السلف، وكام باع.</small>
          <button type="button" className="secondary" style={{ marginTop: 6 }} disabled={now.isPending} onClick={(e) => (e.preventDefault(), now.mutate())}>
            ابعتلي ملخص الشهر اللي فات دلوقتي
          </button>
        </span>
      </label>

      <label style={row}>
        <input type="checkbox" checked={c.debtsWeekly.on} onChange={(e) => set({ debtsWeekly: { ...c.debtsWeekly, on: e.target.checked } })} />
        <span style={{ flex: 1 }}>
          <b>💰 تحصيل أسبوعي للعملاء (بيروح للعملاء)</b>
          <small style={{ display: 'block', color: 'var(--muted)' }}>رسالة تذكير بنفس صيغة «الديون والتذكير» لكل عميل عليه فلوس بقاله فترة.</small>
          {c.debtsWeekly.on && (
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
              <select value={c.debtsWeekly.day} onChange={(e) => set({ debtsWeekly: { ...c.debtsWeekly, day: Number(e.target.value) } })}>
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
              <input type="time" value={c.debtsWeekly.time} onChange={(e) => set({ debtsWeekly: { ...c.debtsWeekly, time: e.target.value } })} />
              <span>عليه فلوس من</span>
              <input inputMode="numeric" dir="ltr" style={{ width: 60 }} value={c.debtsWeekly.minDays} onChange={(e) => set({ debtsWeekly: { ...c.debtsWeekly, minDays: Number(e.target.value.replace(/\D/g, '')) || 1 } })} />
              <span>يوم أو أكتر</span>
            </span>
          )}
        </span>
      </label>

      <label style={row}>
        <input type="checkbox" checked={c.onlineStatus.on} onChange={(e) => set({ onlineStatus: { on: e.target.checked } })} />
        <span>
          <b>🌐 رسائل لعميل الأونلاين مع الشحنة (بيروح للعملاء)</b>
          <small style={{ display: 'block', color: 'var(--muted)' }}>لما الشحنة تتسلّم للشركة، تخرج للتوصيل، وتوصل — العميل يوصله «طلبك اتجهّز / خرج / وصل». بيشتغل بس على الفواتير اللي معلّمها «🌐 عميل أونلاين».</small>
        </span>
      </label>

      <button type="button" className="primary" style={{ width: '100%', marginTop: 8 }} disabled={!draft || save.isPending} onClick={() => save.mutate(c)}>
        {save.isPending ? '⏳ بيحفظ…' : 'حفظ'}
      </button>
    </div>
  );
}
