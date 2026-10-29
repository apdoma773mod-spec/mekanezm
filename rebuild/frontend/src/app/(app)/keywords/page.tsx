'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import {
  DEFAULT_RULES,
  PRESETS,
  WA_TYPES,
  evaluate,
  linesOf,
  numbersText,
  parseNumbers,
  type WaRule,
  type WaRules,
} from '@/lib/wa-match';

/** 🔑 كلمات الواتساب المفتاحية: نفس الشاشة القديمة (تبويبات، قواعد، أرقام، صور، ممنوعات، تجربة، متجاهَل، نسخة احتياطية). */
type Tab = 'over' | 'rules' | 'nums' | 'photos' | 'never' | 'test' | 'recent' | 'backup';
const TABS: [Tab, string][] = [
  ['over', 'نظرة عامة'],
  ['rules', 'القواعد'],
  ['nums', 'الأرقام'],
  ['photos', 'الصور'],
  ['never', 'الممنوعات'],
  ['test', 'تجربة'],
  ['recent', 'المتجاهَل'],
  ['backup', 'نسخة احتياطية'],
];

interface Stat {
  at?: string;
  src?: string;
  accepted?: number;
  ignored?: number;
  known?: number;
  recent?: { at: number; name?: string; phone?: string; text: string; why?: string }[];
}

const field: React.CSSProperties = { width: '100%', fontSize: 16, lineHeight: 1.9, padding: 12, borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'inherit', fontFamily: 'inherit' };
const big: React.CSSProperties = { ...field, fontSize: 17, direction: 'ltr', textAlign: 'left' };

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 14, margin: '0 0 12px' }}>
      <div style={{ fontSize: 17, fontWeight: 800 }}>{title}</div>
      {sub ? <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9, margin: '4px 0 10px' }}>{sub}</div> : <div style={{ height: 8 }} />}
      {children}
    </div>
  );
}

function Toggle({ on, onChange, title, sub }: { on: boolean; onChange: (v: boolean) => void; title: string; sub: string }) {
  return (
    <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} style={{ width: 26, height: 26, flex: 'none', marginTop: 2 }} />
      <span>
        <b style={{ fontSize: 15 }}>{title}</b>
        <br />
        <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8 }}>{sub}</span>
      </span>
    </label>
  );
}

function Editor() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['inbox', 'wa-rules'],
    queryFn: () => api.get<{ rules: WaRules | null; stat: Stat | null }>('/inbox/wa-rules'),
  });
  const [tab, setTab] = useState<Tab>('over');
  const [cfg, setCfg] = useState<WaRules | null>(null);
  const [dirty, setDirty] = useState(false);
  const [numText, setNumText] = useState<Record<'own' | 'alw' | 'blk', string>>({ own: '', alw: '', blk: '' });
  const [test, setTest] = useState({ text: '', phone: '' });
  const [json, setJson] = useState('');

  const save = useMutation({
    mutationFn: (v: WaRules) => api.put<{ ok: true }>('/inbox/wa-rules', { rules: v }),
    onSuccess: () => {
      setDirty(false);
      toast('✔ اتحفظت القواعد — الجسر هياخدها خلال دقيقة');
      void qc.invalidateQueries({ queryKey: ['inbox', 'wa-rules'] });
    },
    onError: (e) => toast(`مقدرتش أحفظ: ${errorMessage(e)}`, 'bad'),
  });

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const stat = q.data.stat;
  const live = cfg ?? { ...DEFAULT_RULES, ...(q.data.rules ?? {}), photos: { ...DEFAULT_RULES.photos, ...(q.data.rules?.photos ?? {}) } };
  if (!cfg) {
    // first render with the saved values; from here on the screen keeps its own copy until saved
    setCfg(live);
    setNumText({
      own: numbersText(live.ownerPhones, live.phoneNotes),
      alw: numbersText(live.allowPhones, live.phoneNotes),
      blk: numbersText(live.blockPhones, live.phoneNotes),
    });
  }
  const c = cfg ?? live;
  const set = (patch: Partial<WaRules>) => {
    setCfg({ ...c, ...patch });
    setDirty(true);
  };
  const setRule = (i: number, patch: Partial<WaRule>) => set({ rules: c.rules.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= c.rules.length) return;
    const rules = [...c.rules];
    [rules[i], rules[j]] = [rules[j], rules[i]];
    set({ rules });
  };
  const collectNumbers = () => {
    const own = parseNumbers(numText.own);
    const alw = parseNumbers(numText.alw);
    const blk = parseNumbers(numText.blk);
    return { ...c, ownerPhones: own.list, allowPhones: alw.list, blockPhones: blk.list, phoneNotes: { ...own.notes, ...alw.notes, ...blk.notes } };
  };
  /** Blank lines typed while editing are dropped here, so the editor can keep a new empty line. */
  const clean = (v: WaRules): WaRules => ({
    ...v,
    never: linesOf(v.never.join('\n')),
    rules: v.rules
      .map((r) => ({ ...r, phrases: r.phrases.map((x) => x.trim()).filter(Boolean), not: (r.not ?? []).map((x) => x.trim()).filter(Boolean) }))
      .filter((r) => r.phrases.length > 0),
  });
  const saveNow = () => {
    const v = clean(tab === 'nums' ? collectNumbers() : c);
    save.mutate(v);
    setCfg(v);
  };
  const evalNow = evaluate(clean(tab === 'nums' ? collectNumbers() : c), test.text, test.phone);
  const recent = (stat?.recent ?? []).filter((x) => Date.now() - x.at < 864e5);
  const active = c.rules.filter((r) => r.on !== false).length;

  return (
    <>
      <div className="toolbar" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
        {TABS.map(([k, label]) => (
          <button key={k} type="button" className={tab === k ? 'primary' : 'secondary'} style={{ flex: 'none', whiteSpace: 'nowrap' }} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'over' && (
        <>
          <Section title="حالة الجسر">
            <div style={{ fontSize: 16, fontWeight: 800, color: stat?.at && Date.now() - new Date(stat.at).getTime() < 5 * 60000 ? '#15803d' : '#dc2626' }}>
              {stat?.at && Date.now() - new Date(stat.at).getTime() < 5 * 60000 ? '🟢 الجسر شغّال' : '🔴 الجسر مش باعت أخبار'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 2, marginTop: 6 }}>
              {stat?.at && <>آخر خبر: {new Date(stat.at).toLocaleTimeString('ar-EG')}<br /></>}
              دخل النهارده: <b>{stat?.accepted ?? 0}</b> — اتجاهل: <b>{stat?.ignored ?? 0}</b>
              {stat?.known ? <><br />عملاء وموردين معروفين: <b>{stat.known}</b></> : null}
            </div>
          </Section>
          <Section title="الفلتر" sub="لو شغّال، السيستم ماياخدش أي رسالة أو صورة إلا لو ليها سبب واضح (كلمة مقبولة، أو رقم مسموح). غير كده بتتجاهل ومابتتخزنش.">
            <Toggle on={c.enabled} onChange={(v) => set({ enabled: v })} title="الفلتر شغّال" sub="لو قفلته هتدخل كل الرسايل من كل الأرقام." />
          </Section>
          <Section title="الرسالة بتعدّي إزاي؟" sub="الترتيب اللي السيستم بيمشي عليه مع كل رسالة:">
            <ol style={{ margin: 0, paddingRight: 20, lineHeight: 2.2, fontSize: 15 }}>
              <li>لو الرقم في <b>أرقام بتتجاهل دايمًا</b> ← تتجاهل.</li>
              <li>لو الرسالة فيها <b>عبارة ممنوعة</b> ← تتجاهل.</li>
              <li>لو الرقم في <b>أرقام بتدخل دايمًا</b> ← تدخل.</li>
              <li>لو فيها كلمة من <b>القواعد</b> ← تدخل بنوع القاعدة.</li>
              <li>الصور: بتدخل لو التعليق فيه كلمة، أو جت بعد رسالة مقبولة بوقت قصير، أو من عميل معروف.</li>
              <li>غير كده ← تتجاهل.</li>
            </ol>
          </Section>
          <Section title="ملخّص إعداداتك">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, textAlign: 'center' }}>
              {[
                [`${active} / ${c.rules.length}`, 'قواعد مفعّلة'],
                [c.allowPhones.length, 'أرقام بتدخل دايمًا'],
                [c.blockPhones.length, 'أرقام بتتجاهل'],
                [c.never.length, 'عبارات ممنوعة'],
                [c.ownerPhones.length, 'أرقامك الشخصية'],
                [recent.length, 'اتجاهل آخر 24 ساعة'],
              ].map(([n, l]) => (
                <div key={String(l)} style={{ padding: 12, borderRadius: 12, background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{n}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{l}</div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {tab === 'rules' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>قواعد جاهزة (اضغط تضيفها، وتعدّلها براحتك):</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PRESETS.map((p) => (
                <button key={p.n} type="button" className="secondary" style={{ minHeight: 44 }} onClick={() => set({ rules: [...c.rules, { name: p.n, phrases: [...p.phrases], not: [], type: p.type, scope: 'both', mode: 'contains', fuzzy: true, on: true }] })}>
                  + {p.n}
                </button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8, marginBottom: 10 }}>القواعد بتتقري من فوق لتحت، وأول قاعدة تنطبق هي اللي بتحدد النوع.</div>
          {c.rules.map((r, i) => (
            <div key={i} className="card" style={{ padding: 12, margin: '0 0 12px', borderRight: `5px solid ${r.on === false ? '#9ca3af' : 'var(--blue)'}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input value={r.name ?? ''} onChange={(e) => setRule(i, { name: e.target.value })} placeholder="اسم للقاعدة (اختياري) — مثال: طلبات الاستانلس" style={{ ...field, flex: 1, minWidth: 0, fontWeight: 800, fontSize: 16 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, flex: 'none' }}>
                  <input type="checkbox" checked={r.on !== false} onChange={(e) => setRule(i, { on: e.target.checked })} style={{ width: 24, height: 24 }} /> مفعّلة
                </label>
              </div>
              <label style={{ fontSize: 13, color: 'var(--muted)' }}>الكلمات أو العبارات (كل واحدة في سطر)</label>
              <textarea rows={6} value={r.phrases.join('\n')} onChange={(e) => setRule(i, { phrases: e.target.value.split('\n') })} style={{ ...field, minHeight: 150 }} placeholder={'استانلس\nاستلس\nدلف استانلس'} />
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginTop: 8 }}>إلا لو فيها (اختياري — الرسالة اللي فيها أي كلمة هنا القاعدة دي ماتنطبقش عليها)</label>
              <textarea rows={3} value={(r.not ?? []).join('\n')} onChange={(e) => setRule(i, { not: e.target.value.split('\n') })} style={{ ...field, minHeight: 90, fontSize: 16 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                <div>
                  <label style={{ fontSize: 13, color: 'var(--muted)' }}>تتحوّل لنوع</label>
                  <select value={r.type} onChange={(e) => setRule(i, { type: e.target.value })} style={{ width: '100%', minHeight: 48, borderRadius: 12 }}>
                    {WA_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, color: 'var(--muted)' }}>بتتطبق على رسايل</label>
                  <select value={r.scope} onChange={(e) => setRule(i, { scope: e.target.value as WaRule['scope'] })} style={{ width: '100%', minHeight: 48, borderRadius: 12 }}>
                    <option value="both">رقم المحل ورقم عبده</option>
                    <option value="shop">رقم المحل بس</option>
                    <option value="owner">رقم عبده بس</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, color: 'var(--muted)' }}>طريقة المطابقة</label>
                  <select value={r.mode} onChange={(e) => setRule(i, { mode: e.target.value as WaRule['mode'] })} style={{ width: '100%', minHeight: 48, borderRadius: 12 }}>
                    <option value="contains">الكلمة موجودة في أي مكان</option>
                    <option value="starts">الرسالة تبدأ بيها</option>
                    <option value="exact">الرسالة كلها هي الكلمة بالظبط</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, minHeight: 48 }}>
                    <input type="checkbox" checked={r.fuzzy !== false} onChange={(e) => setRule(i, { fuzzy: e.target.checked })} style={{ width: 24, height: 24 }} /> يسامح في الغلطات الإملائية
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button type="button" className="secondary" style={{ flex: 1, minHeight: 46 }} onClick={() => move(i, -1)}>▲ فوق</button>
                <button type="button" className="secondary" style={{ flex: 1, minHeight: 46 }} onClick={() => move(i, 1)}>▼ تحت</button>
                <button type="button" className="secondary" style={{ flex: 1, minHeight: 46 }} onClick={() => set({ rules: [...c.rules.slice(0, i + 1), JSON.parse(JSON.stringify(r)), ...c.rules.slice(i + 1)] })}>⧉ نسخ</button>
                <button type="button" className="secondary danger" style={{ flex: 1, minHeight: 46 }} onClick={() => set({ rules: c.rules.filter((_, k) => k !== i) })}>🗑 حذف</button>
              </div>
            </div>
          ))}
          <button type="button" className="primary" style={{ width: '100%', minHeight: 54 }} onClick={() => set({ rules: [...c.rules, { phrases: [], not: [], type: 'طلب', scope: 'both', mode: 'contains', fuzzy: true, on: true }] })}>
            ➕ قاعدة جديدة
          </button>
        </>
      )}

      {tab === 'nums' && (
        <>
          <Section title="📱 أرقامك الشخصية" sub="أي صورة من الأرقام دي بتدخل دايمًا كتحويل لمورد. اكتب كل رقم في سطر، وتقدر تكتب جنبه اسم.">
            <textarea rows={5} value={numText.own} onChange={(e) => setNumText({ ...numText, own: e.target.value })} placeholder="01xxxxxxxxx" style={big} />
          </Section>
          <Section title="✅ أرقام بتدخل دايمًا" sub="صنايعية وعملاء شغالين معاك: كل رسالة منهم بتدخل حتى من غير كلمة.">
            <textarea rows={6} value={numText.alw} onChange={(e) => setNumText({ ...numText, alw: e.target.value })} placeholder="01xxxxxxxxx  اسم الصنايعي" style={big} />
          </Section>
          <Section title="⛔ أرقام بتتجاهل دايمًا" sub="أهل وأصحاب وجروبات: ولا رسالة منهم بتدخل حتى لو فيها كلمة مقبولة.">
            <textarea rows={6} value={numText.blk} onChange={(e) => setNumText({ ...numText, blk: e.target.value })} placeholder="01xxxxxxxxx  اسم" style={big} />
          </Section>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>الرقم بيتكتب بأي شكل. الأرقام الغلط (أقل من 10 أرقام) مابتتحفظش.</div>
        </>
      )}

      {tab === 'photos' && (
        <>
          <Section title="الصور بتدخل إمتى؟">
            <Toggle on={c.photos.byCaption} onChange={(v) => set({ photos: { ...c.photos, byCaption: v } })} title="صورة معاها تعليق فيه كلمة مقبولة" sub="الصورة بتدخل لو التعليق اللي مكتوب عليها فيه كلمة من القواعد." />
            <Toggle on={c.photos.byWindow} onChange={(v) => set({ photos: { ...c.photos, byWindow: v } })} title="صورة بعد رسالة مقبولة" sub="لو واحد بعت رسالة اتقبلت، أي صورة بيبعتها بعدها بوقت قصير بتدخل كمان." />
            <Toggle on={c.photos.fromKnown} onChange={(v) => set({ photos: { ...c.photos, fromKnown: v } })} title="صور العملاء والموردين المسجّلين" sub="صورة من رقم متسجل في السيستم بتدخل من غير تعليق (زي إيصالات التحويل)." />
          </Section>
          <Section title="مدة قبول الصور بعد الرسالة" sub={`الصورة اللي تيجي بعد الرسالة المقبولة في المدة دي بتدخل. المدة الحالية: ${c.windowMin} دقيقة.`}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[2, 5, 10, 15, 30, 60].map((n) => (
                <button key={n} type="button" className={c.windowMin === n ? 'primary' : 'secondary'} style={{ minWidth: 76, minHeight: 48 }} onClick={() => set({ windowMin: n })}>
                  {n} د
                </button>
              ))}
            </div>
          </Section>
        </>
      )}

      {tab === 'never' && (
        <>
          <Section title="🚫 عبارات ممنوعة" sub="أي رسالة فيها واحدة من العبارات دي بتتجاهل حتى لو فيها كلمة مقبولة. اكتب كل عبارة في سطر.">
            <textarea rows={8} value={c.never.join('\n')} onChange={(e) => set({ never: e.target.value.split('\n') })} placeholder="عبارة في كل سطر" style={field} />
          </Section>
          <Section title="أرقام متسجّلة في موبايل المحل">
            <Toggle on={c.ignoreSaved} onChange={(v) => set({ ignoreSaved: v })} title="تجاهل أي رقم متسجّل في موبايل المحل" sub="حتى لو الرسالة فيها كلمة مقبولة." />
          </Section>
        </>
      )}

      {tab === 'test' && (
        <Section title="🧪 جرّب رسالة" sub="اكتب نص رسالة وشوف إيه اللي هيحصل بيها بالقواعد الحالية.">
          <textarea rows={5} value={test.text} onChange={(e) => setTest({ ...test, text: e.target.value })} placeholder="اكتب نص الرسالة هنا..." style={big} />
          <input inputMode="tel" value={test.phone} onChange={(e) => setTest({ ...test, phone: e.target.value })} placeholder="رقم المرسل (اختياري)" style={{ ...field, marginTop: 8, minHeight: 50 }} />
          <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'var(--card)', border: '1px solid var(--border)', fontSize: 16, lineHeight: 1.9 }}>
            {test.text.trim() ? (
              <>
                {evalNow.ok ? '✅ هتتقبل' : '🚫 هتتجاهل'}
                <br />
                <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                  {evalNow.why}
                  {evalNow.type ? ` — النوع: ${evalNow.type}` : ''}
                </span>
              </>
            ) : (
              '—'
            )}
          </div>
        </Section>
      )}

      {tab === 'recent' && (
        <Section title={`المتجاهَل آخر 24 ساعة (${recent.length})`} sub="لو في رسالة اتجاهلت غلط، اعتبرها طلب، أو اعمل منها قاعدة.">
          {recent.length === 0 ? (
            <div className="empty">مفيش</div>
          ) : (
            recent.slice().reverse().map((x, i) => (
              <div key={i} className="card" style={{ padding: 10, margin: '8px 0' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {x.name ?? ''} <span dir="ltr">{x.phone ?? ''}</span>
                  {x.why ? <> · <b>{x.why}</b></> : null}
                </div>
                <div style={{ whiteSpace: 'pre-line', margin: '6px 0' }}>{x.text}</div>
              </div>
            ))
          )}
        </Section>
      )}

      {tab === 'backup' && (
        <Section title="نسخة احتياطية" sub="انسخ الإعدادات دي واحفظها، أو الصق إعدادات قديمة وارجّعها.">
          <textarea rows={10} value={json || JSON.stringify(c, null, 1)} onChange={(e) => setJson(e.target.value)} style={big} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" className="secondary" style={{ flex: 1, minHeight: 50 }} onClick={() => void navigator.clipboard?.writeText(json || JSON.stringify(c, null, 1))}>
              📋 نسخ
            </button>
            <button
              type="button"
              className="secondary"
              style={{ flex: 1, minHeight: 50 }}
              onClick={() => {
                const b = new Blob([JSON.stringify(c, null, 1)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(b);
                a.download = `wa-rules-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
              }}
            >
              ⬇ تنزيل ملف
            </button>
            <button
              type="button"
              className="secondary"
              style={{ flex: 1, minHeight: 50 }}
              onClick={() => {
                try {
                  const v = JSON.parse(json);
                  if (!v || !Array.isArray(v.rules)) throw new Error('bad');
                  if (!window.confirm('تستبدل الإعدادات الحالية بالنص ده؟')) return;
                  setCfg({ ...DEFAULT_RULES, ...v, photos: { ...DEFAULT_RULES.photos, ...(v.photos ?? {}) } });
                  setDirty(true);
                  setJson('');
                } catch {
                  toast('النص مش إعدادات صح', 'bad');
                }
              }}
            >
              ↩ استرجاع من النص
            </button>
          </div>
          <button
            type="button"
            className="secondary danger"
            style={{ width: '100%', minHeight: 50, marginTop: 14 }}
            onClick={() => {
              if (!window.confirm('تمسح كل القواعد والأرقام وترجع للافتراضي؟')) return;
              setCfg(structuredClone(DEFAULT_RULES));
              setDirty(true);
            }}
          >
            إعادة ضبط كل حاجة
          </button>
        </Section>
      )}

      <div style={{ position: 'sticky', bottom: 0, padding: '10px 0', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <span style={{ flex: 1, fontSize: 13, color: '#d97706', fontWeight: 700 }}>{dirty ? '⚠️ فيه تعديلات لسه ماتحفظتش' : ''}</span>
        <button type="button" className="primary" style={{ minWidth: 140, minHeight: 52, fontSize: 17, fontWeight: 800 }} disabled={save.isPending} onClick={saveNow}>
          💾 حفظ
        </button>
      </div>
    </>
  );
}

export default function KeywordsPage() {
  return (
    <AdminOnly>
      <PageHeader title="🔑 كلمات الواتساب المفتاحية" subtitle="الرسايل اللي مفيهاش كلمة منهم بتتجاهل. تضيف وتعدّل بنفسك." />
      <Editor />
    </AdminOnly>
  );
}
