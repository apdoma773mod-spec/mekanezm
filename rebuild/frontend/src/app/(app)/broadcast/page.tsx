'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/app-shell';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';

/** 📣 إعلان لكل العملاء بضغطة واحدة: السيستم بيبعت واحد واحد من واتساب المحل (بفاصل زمني عشان الرقم ما يتحظرش). */
type Audience = 'customers' | 'subscribers' | 'both';
interface AudienceInfo {
  customers: number;
  subscribers: number;
  both: number;
  noPhone: number;
  optedOut: number;
  gapSec: number;
  daily: number;
  minutes: Record<Audience, number>;
}
interface Item {
  id: string;
  at: string;
  by: string;
  text: string;
  audience: Audience;
  total: number;
  queued: number;
  sent: number;
  failed: number;
}
interface Detail extends Item {
  failures: { phone: string; err: string }[];
}

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '').slice(0, 24) : `b${Date.now()}${Math.random().toString(36).slice(2, 10)}`);
const WHO: Record<Audience, string> = { customers: 'العملاء', subscribers: 'مشتركي الواتساب', both: 'العملاء والمشتركين' };
const dur = (m: number) => (m < 90 ? `حوالي ${Math.max(m, 1)} دقيقة` : m < 36 * 60 ? `حوالي ${Math.round(m / 60)} ساعة` : `حوالي ${Math.round(m / 1440)} يوم`);
const when = (iso: string) => new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });

function Progress({ it }: { it: Item }) {
  const pct = (n: number) => `${it.total ? (n / it.total) * 100 : 0}%`;
  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--border)', margin: '6px 0' }}>
      <div style={{ width: pct(it.sent), background: 'var(--green, #1f9d55)' }} />
      <div style={{ width: pct(it.failed), background: 'var(--red, #d64545)' }} />
    </div>
  );
}

function History() {
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['broadcast', 'list'],
    queryFn: ({ signal }) => api.get<{ items: Item[] }>('/broadcast', undefined, signal).then((r) => r.items),
    refetchInterval: (s) => (s.state.data?.some((i) => i.queued > 0) ? 5000 : false),
  });
  const detail = useQuery({
    queryKey: ['broadcast', 'item', open],
    enabled: !!open,
    queryFn: ({ signal }) => api.get<Detail>(`/broadcast/item/${open}`, undefined, signal),
    refetchInterval: 8000,
  });
  const cancel = async (it: Item) => {
    if (!window.confirm(`توقف الإعلان؟ اللي لسه ماخرجش (${it.queued}) هيتلغى، واللي اتبعت مش هيتأثر.`)) return;
    try {
      const r = await api.post<{ cancelled: number }>(`/broadcast/item/${it.id}/cancel`);
      toast(`✔ اتلغى ${r.cancelled} رسالة`);
      void qc.invalidateQueries({ queryKey: ['broadcast'] });
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  if (!q.data.length) return <div className="card" style={{ padding: 12, color: '#7b8a90' }}>لسه ما بعتّش إعلانات.</div>;
  return (
    <>
      {q.data.map((it) => (
        <div key={it.id} className="card" style={{ padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
            <b>
              {it.total} · {WHO[it.audience]}
            </b>
            <span style={{ color: '#7b8a90' }}>{when(it.at)}</span>
          </div>
          <div style={{ fontSize: 13, margin: '4px 0', whiteSpace: 'pre-wrap', maxHeight: 60, overflow: 'hidden' }}>{it.text}</div>
          <Progress it={it} />
          <div style={{ fontSize: 13, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>✅ اتبعت {it.sent}</span>
            {it.queued > 0 && <span>⏳ مستني {it.queued}</span>}
            {it.failed > 0 && <span>❌ فشل {it.failed}</span>}
            <span style={{ flex: 1 }} />
            {it.failed > 0 && (
              <button type="button" className="secondary" onClick={() => setOpen(open === it.id ? null : it.id)}>
                {open === it.id ? 'اخفي' : 'ليه فشل؟'}
              </button>
            )}
            {it.queued > 0 && (
              <button type="button" className="secondary" onClick={() => void cancel(it)}>
                ⛔ وقف
              </button>
            )}
          </div>
          {open === it.id && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#7b8a90' }}>
              {detail.isPending ? '⏳' : (detail.data?.failures ?? []).map((f) => <div key={f.phone}>{`${f.phone} — ${f.err || 'فشل'}`}</div>)}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function OptOut() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['broadcast', 'optout'], queryFn: ({ signal }) => api.get<{ items: { phone: string; name: string }[] }>('/broadcast/optout', undefined, signal).then((r) => r.items) });
  const [add, setAdd] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['broadcast'] });
  const back = async (phone: string) => {
    try {
      await api.delete(`/broadcast/optout/${phone}`);
      void refresh();
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
  const put = async () => {
    try {
      await api.post('/broadcast/optout', { phone: add });
      setAdd('');
      toast('✔ اتشال من الإعلانات');
      void refresh();
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ fontSize: 13, color: '#7b8a90', marginBottom: 8 }}>اللي بيبعت «إلغاء» بيتشال لوحده. تقدر كمان تشيل حد بإيدك:</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input inputMode="numeric" dir="ltr" value={add} placeholder="01xxxxxxxxx" onChange={(e) => setAdd(e.target.value)} />
        <button type="button" className="secondary" style={{ width: 'auto' }} disabled={!add.trim()} onClick={() => void put()}>
          شيله
        </button>
      </div>
      {(q.data ?? []).map((o) => (
        <div key={o.phone} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
          <span style={{ flex: 1 }}>
            {o.name || 'غير مسجّل'} <span dir="ltr" style={{ color: '#7b8a90' }}>{o.phone}</span>
          </span>
          <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => void back(o.phone)}>
            رجّعه
          </button>
        </div>
      ))}
      {q.data && !q.data.length && <div style={{ fontSize: 13, color: '#7b8a90' }}>مفيش حد طالب إلغاء لسه.</div>}
    </div>
  );
}

export default function BroadcastPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ['broadcast', 'audience'], queryFn: ({ signal }) => api.get<AudienceInfo>('/broadcast/audience', undefined, signal), staleTime: 30_000 });
  const [text, setText] = useState('');
  const [aud, setAud] = useState<Audience>('customers');
  const [busy, setBusy] = useState(false);
  const idRef = useRef(newId()); // نفس الدفعة لو الضغطة اتكررت (النت وقع مثلاً) مايتبعتش مرتين
  const area = useRef<HTMLTextAreaElement>(null);
  const n = info.data?.[aud] ?? 0;
  const addName = () => {
    const el = area.current;
    const at = el?.selectionStart ?? text.length;
    setText(`${text.slice(0, at)}{الاسم}${text.slice(el?.selectionEnd ?? at)}`);
    el?.focus();
  };
  const send = async () => {
    if (busy) return;
    if (text.trim().length < 5) return toast('اكتب الإعلان الأول', 'bad');
    if (!n) return toast('مفيش حد يتبعتله بالاختيار ده', 'bad');
    const mins = info.data?.minutes[aud] ?? 0;
    if (!window.confirm(`هتبعت الإعلان ده لـ ${n} من ${WHO[aud]}.\nهيتبعت واحد واحد وهياخد ${dur(mins)} — جهاز المحل لازم يفضل شغّال.\nمتأكد؟`)) return;
    setBusy(true);
    try {
      await api.post('/broadcast/send', { id: idRef.current, text, audience: aud });
      toast(`✔ الإعلان اتحط في الطابور لـ ${n}`);
      idRef.current = newId();
      setText('');
      void qc.invalidateQueries({ queryKey: ['broadcast'] });
    } catch (e) {
      toast(errorMessage(e), 'bad');
    } finally {
      setBusy(false);
    }
  };
  const sample = text.trim() ? `${text.replaceAll('{الاسم}', 'محمد')}\n\nلو مش عايز توصلك رسايلنا ابعتلنا «إلغاء» وهنشيلك فوراً.` : '';
  return (
    <>
      <PageHeader title="📣 إعلان لكل العملاء" subtitle="اكتب الإعلان مرة، ودوس مرة، والسيستم يبعته لكل واحد من واتساب المحل" />
      {info.isPending ? (
        <Loading />
      ) : info.isError ? (
        <ErrorBox message={errorMessage(info.error)} onRetry={() => info.refetch()} />
      ) : (
        <div className="card" style={{ padding: 12, marginBottom: 14, display: 'grid', gap: 8 }}>
          <label style={{ fontWeight: 700 }}>الإعلان</label>
          <textarea ref={area} rows={6} value={text} maxLength={1000} placeholder="مثلاً: أهلاً {الاسم} 👋 وصلنا مجرى بلي جديد بسعر خاص — تعالى شوفه أو اطلبه من الموقع" onChange={(e) => setText(e.target.value)} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="secondary" style={{ width: 'auto' }} onClick={addName}>
              ➕ اسم العميل
            </button>
            <span style={{ fontSize: 12, color: '#7b8a90' }}>بيتبدّل باسم كل عميل (أول اسم)</span>
          </div>
          <label style={{ fontWeight: 700 }}>لمين؟</label>
          <select value={aud} onChange={(e) => setAud(e.target.value as Audience)}>
            <option value="customers">كل العملاء ({info.data.customers})</option>
            <option value="subscribers">مشتركي الواتساب ({info.data.subscribers})</option>
            <option value="both">العملاء + المشتركين ({info.data.both})</option>
          </select>
          {sample && (
            <div style={{ background: 'var(--bg-soft, #f3f6f7)', borderRadius: 8, padding: 10, fontSize: 13, whiteSpace: 'pre-wrap' }}>
              <div style={{ color: '#7b8a90', marginBottom: 4 }}>شكل الرسالة عند العميل:</div>
              {sample}
            </div>
          )}
          <div style={{ fontSize: 12, color: '#7b8a90', lineHeight: 1.7 }}>
            • بيتبعت واحد واحد بفاصل ~{info.data.gapSec} ثانية وبحد أقصى {info.data.daily} في اليوم (والباقي يكمل تاني يوم لوحده) — ده عشان واتساب مايحظرش رقم المحل.
            <br />• بيتخطّى: الأرقام الناقصة أو الغلط ({info.data.noPhone}) واللي طلبوا إلغاء ({info.data.optedOut}).
            <br />• جسر الواتساب اللي على جهاز المحل لازم يكون شغّال.
          </div>
          <button type="button" className="primary" disabled={busy || !n || text.trim().length < 5} onClick={() => void send()}>
            {busy ? '⏳ …' : `🚀 ابعت لـ ${n} ${aud === 'subscribers' ? 'مشترك' : 'عميل'}`}
          </button>
        </div>
      )}
      <h3 style={{ margin: '14px 0 8px' }}>الإعلانات اللي اتبعتت</h3>
      <History />
      <h3 style={{ margin: '18px 0 8px' }}>🚫 اللي مش عايزين إعلانات</h3>
      <OptOut />
    </>
  );
}
