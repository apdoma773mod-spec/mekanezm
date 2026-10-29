'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { Modal } from '../ui/modal';
import { ErrorBox, Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useModal } from './modal-host';

interface AlertCfg {
  on: boolean;
  to: string[];
  disc: number;
  short: number;
  skip_admin: boolean;
  types: Record<string, boolean>;
}
interface AlertsRes {
  config: AlertCfg;
  types: { key: string; label: string }[];
  log: { body: string; status: string; to: string; at: string }[];
}

const fmt = (p: string) => (p.startsWith('20') ? `0${p.slice(2)}` : p);

/** 🔔 تنبيهات فورية ضد السرقة (mkAL.open القديمة): مين يستلم، حدود الخصم والعجز، وأنواع التنبيهات، وآخر ما اتبعت. */
export function AlertsModal() {
  const { close } = useModal();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['alerts', 'config'], queryFn: ({ signal }) => api.get<AlertsRes>('/alerts/config', undefined, signal) });
  const save = useMutation({
    mutationFn: (c: AlertCfg) => api.put('/alerts/config', c),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
  const test = useMutation({ mutationFn: () => api.post<{ sent: number }>('/alerts/test') });
  const [f, setF] = useState<{ on: boolean; to: string; disc: string; short: string; skip: boolean; types: Record<string, boolean> } | null>(null);

  if (q.isPending)
    return (
      <Modal title="🔔 تنبيهات فورية ضد السرقة" onClose={close}>
        <Loading />
      </Modal>
    );
  if (q.isError)
    return (
      <Modal title="🔔 تنبيهات فورية ضد السرقة" onClose={close}>
        <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      </Modal>
    );
  const c = q.data.config;
  const v = f ?? { on: c.on, to: c.to.map(fmt).join('\n'), disc: String(c.disc), short: String(c.short), skip: c.skip_admin, types: c.types };
  const set = (p: Partial<typeof v>) => setF({ ...v, ...p });
  const go = async () => {
    const to = [...new Set(v.to.split(/[\n,،/]+/).map((x) => x.trim()).filter((x) => x.length >= 11))];
    if (!to.length) return toast('اكتب رقم واحد على الأقل', 'bad');
    try {
      await save.mutateAsync({ on: v.on, to, disc: Math.max(1, Number(v.disc) || 15), short: Math.max(1, Number(v.short) || 50), skip_admin: v.skip, types: v.types });
      toast('✔ اتحفظت إعدادات التنبيهات');
      close();
    } catch (e) {
      toast(`ماتحفظش: ${errorMessage(e)}`, 'bad');
    }
  };

  return (
    <Modal title="🔔 تنبيهات فورية ضد السرقة" onClose={close}>
      <p style={{ margin: '0 0 8px', color: '#6b7c82', fontSize: 13, lineHeight: 1.8 }}>
        السيرفر بيراقب العمليات الحساسة، وأول ما تحصل بيوصلك تنبيه على الواتساب من رقم المحل — حتى لو الموظف شغال من موبايله. محدش يقدر يوقفها غير من هنا.
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={v.on} onChange={(e) => set({ on: e.target.checked })} /> التنبيهات شغالة
      </label>
      <div className="form" style={{ marginTop: 8 }}>
        <div className="field full">
          <label>الأرقام اللي يوصلها التنبيه (رقم في كل سطر)</label>
          <textarea rows={2} dir="ltr" style={{ textAlign: 'right' }} value={v.to} onChange={(e) => set({ to: e.target.value })} />
        </div>
        <div className="field">
          <label>نسبة الخصم اللي تعتبر كبيرة %</label>
          <input type="number" min={1} max={90} value={v.disc} onChange={(e) => set({ disc: e.target.value })} />
        </div>
        <div className="field">
          <label>أقل عجز في الدرج يتبلّغ (جنيه)</label>
          <input type="number" min={1} value={v.short} onChange={(e) => set({ short: e.target.value })} />
        </div>
        <div className="field full">
          <label>ابعتلي على:</label>
          {q.data.types.map((t) => (
            <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0', fontSize: 14, color: 'inherit' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={v.types[t.key] !== false} onChange={(e) => set({ types: { ...v.types, [t.key]: e.target.checked } })} /> {t.label}
            </label>
          ))}
        </div>
        <div className="field full">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'inherit' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={v.skip} onChange={(e) => set({ skip: e.target.checked })} /> متبعتليش على الحاجات اللي بعملها أنا (المدير)
          </label>
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={save.isPending} onClick={() => void go()}>
          حفظ
        </button>
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            try {
              const r = await test.mutateAsync();
              toast(`✔ التنبيه في الطريق لـ ${r.sent} رقم`);
              void qc.invalidateQueries({ queryKey: ['alerts'] });
            } catch (e) {
              toast(`ماتبعتش: ${errorMessage(e)}`, 'bad');
            }
          }}
        >
          🧪 ابعت تنبيه تجربة
        </button>
        <button type="button" className="secondary" onClick={close}>
          إغلاق
        </button>
      </div>
      <h3 style={{ margin: '16px 0 6px', fontSize: 15 }}>آخر التنبيهات</h3>
      {q.data.log.length ? (
        q.data.log.map((x, i) => (
          <div key={i} style={{ border: '1px solid var(--border,#e3e8ea)', borderRadius: 10, padding: '8px 10px', marginTop: 6, fontSize: 13, whiteSpace: 'pre-line', lineHeight: 1.7 }}>
            {x.body}
            <div style={{ color: '#7b8a90', fontSize: 12 }}>
              {x.status === 'sent' ? '✔ اتبعت' : x.status === 'failed' ? '✘ ماتبعتش' : '⏳ في الطريق'} لـ {fmt(x.to)}
            </div>
          </div>
        ))
      ) : (
        <div className="empty">لسه مفيش تنبيهات.</div>
      )}
    </Modal>
  );
}

/** 📊 تقرير آخر اليوم على الواتساب: التشغيل والميعاد، ومعاينة وإرسال دلوقتي. */
export function DayReportModal() {
  const { close } = useModal();
  const toast = useToast();
  const cfg = useQuery({ queryKey: ['alerts', 'report-config'], queryFn: ({ signal }) => api.get<{ config: { on: boolean; time: string } }>('/alerts/report/config', undefined, signal).then((r) => r.config) });
  const [on, setOn] = useState<boolean | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [text, setText] = useState('');
  const save = useMutation({ mutationFn: (b: { on: boolean; time: string }) => api.put('/alerts/report/config', b) });
  if (cfg.isPending)
    return (
      <Modal title="📊 تقرير آخر اليوم" onClose={close}>
        <Loading />
      </Modal>
    );
  const vOn = on ?? cfg.data?.on ?? true;
  const vTime = time ?? cfg.data?.time ?? '23:30';
  return (
    <Modal title="📊 تقرير آخر اليوم" onClose={close}>
      <p style={{ margin: '0 0 8px', color: '#6b7c82', fontSize: 13, lineHeight: 1.8 }}>
        كل يوم في الميعاد ده بيوصلك على الواتساب ملخص اليوم: المبيعات ومقارنتها بالأسبوع اللي فات، الكاش والآجل، المكسب، المصروفات، صافي الدرج، الأكتر بيعاً، اللي خلص، الهدايا، الفواتير الملغية، وحضور الموظفين. بيوصلك أنت بس (على نفس أرقام التنبيهات) ومش بيبان في واتساب المحل.
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={vOn} onChange={(e) => setOn(e.target.checked)} /> التقرير شغال
      </label>
      <div className="form" style={{ marginTop: 8 }}>
        <div className="field">
          <label>الساعة كام؟</label>
          <input type="time" value={vTime} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#7b8a90', margin: '4px 0' }}>لو اخترت ميعاد بعد نص الليل (زي ١ الصبح) التقرير بيبقى عن اليوم اللي خلص.</p>
      <div className="modal-foot">
        <button
          type="button"
          className="primary"
          disabled={save.isPending}
          onClick={async () => {
            try {
              await save.mutateAsync({ on: vOn, time: vTime || '23:30' });
              toast(`✔ التقرير هيوصلك الساعة ${vTime}`);
            } catch (e) {
              toast(`ماتحفظش: ${errorMessage(e)}`, 'bad');
            }
          }}
        >
          حفظ
        </button>
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            try {
              setText((await api.get<{ text: string }>('/alerts/report/preview')).text);
            } catch (e) {
              toast(errorMessage(e), 'bad');
            }
          }}
        >
          👁️ شوف تقرير النهارده
        </button>
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            try {
              const r = await api.post<{ sent: number }>('/alerts/report/send');
              toast(`✔ التقرير في الطريق لـ ${r.sent} رقم`);
            } catch (e) {
              toast(errorMessage(e), 'bad');
            }
          }}
        >
          📲 ابعته دلوقتي
        </button>
      </div>
      {text && <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.8, background: 'var(--soft,#f4f7f8)', borderRadius: 12, padding: 10 }}>{text}</pre>}
    </Modal>
  );
}
