'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

/** 💾 النسخ الاحتياطية: نسخة كل يوم تلقائي، قايمة آخر ٣١ يوم، تنزيل، وفحص ملف قبل أي استرجاع (الاسترجاع بعلم المطوّر). */
interface BackupRow {
  day: string;
  madeAt: string;
}
interface CheckResult {
  ok: true;
  day?: string;
  tables: Record<string, number>;
}

export function BackupCard() {
  const toast = useToast();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['backup'], queryFn: () => api.get<{ items: BackupRow[] }>('/backup').then((r) => r.items) });
  const now = useMutation({
    mutationFn: () => api.post<{ ok: true; day: string }>('/backup/now'),
    onSuccess: (r) => {
      toast(`✔ اتعملت نسخة ليوم ${r.day}`);
      void qc.invalidateQueries({ queryKey: ['backup'] });
    },
    onError: (e) => toast(`ماتعملتش النسخة: ${errorMessage(e)}`, 'bad'),
  });
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checkErr, setCheckErr] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const download = async (day: string) => {
    try {
      const res = await fetch(`/api/v1/backup/${day}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `mekanizm-backup-${day}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      toast(`ماتنزلتش: ${errorMessage(e)}`, 'bad');
    }
  };

  const pick = async (f: File) => {
    setCheck(null);
    setCheckErr('');
    try {
      const data = JSON.parse(await f.text());
      const r = await api.post<CheckResult>('/backup/check', data);
      setCheck(r);
    } catch (e) {
      setCheckErr(e instanceof SyntaxError ? 'الملف مش JSON' : errorMessage(e));
    }
  };

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h3>💾 النسخ الاحتياطية</h3>
      <div style={{ lineHeight: 1.9, color: 'var(--muted)', fontSize: 14 }}>
        {list.data?.[0]
          ? `آخر نسخة: ${list.data[0].day}. السيستم بيعمل نسخة تلقائي كل يوم، وبيحتفظ بآخر ٣١ يوم.`
          : 'مفيش نسخ لسه. السيستم هيعمل أول نسخة تلقائي.'}
      </div>
      <button type="button" className="primary" style={{ width: '100%', padding: 15, margin: '10px 0' }} disabled={now.isPending} onClick={() => now.mutate()}>
        {now.isPending ? 'جاري...' : 'نسخة احتياطية دلوقتي'}
      </button>
      {list.isError && <div style={{ color: 'var(--danger)' }}>{errorMessage(list.error)}</div>}
      {list.data?.slice(0, 10).map((x) => (
        <div key={x.day} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px dashed var(--border)' }}>
          <span>
            {x.day} <small style={{ color: 'var(--muted)' }}>{new Date(x.madeAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</small>
          </span>
          <button type="button" className="secondary" onClick={() => download(x.day)}>
            ⬇️ تنزيل
          </button>
        </div>
      ))}
      <label className="secondary" style={{ display: 'block', textAlign: 'center', padding: 14, borderRadius: 12, marginTop: 10, fontWeight: 800, cursor: 'pointer' }}>
        📂 فحص ملف نسخة (قبل الاسترجاع)
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
      </label>
      {check && (
        <div style={{ marginTop: 8, lineHeight: 1.9, fontSize: 14 }}>
          ✔ الملف سليم{check.day ? ` (نسخة ${check.day})` : ''}: {Object.entries(check.tables).filter(([, n]) => n > 0).map(([k, n]) => `${k} (${n})`).join('، ') || 'فاضي'}
        </div>
      )}
      {checkErr && <div style={{ marginTop: 8, color: 'var(--danger)' }}>⚠️ {checkErr}</div>}
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, lineHeight: 1.8 }}>
        الفحص مابيغيّرش حاجة. الاسترجاع الفعلي بيتم مع المطوّر عشان مايمسحش شغل جديد بالغلط.
      </div>
    </div>
  );
}
