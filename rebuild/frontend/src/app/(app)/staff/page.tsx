'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AttendanceDto, PointsConfig, StaffConfig, StaffDto, StaffInput, StaffMonth, StaffMoveDto } from '@mk/shared';
import { Modal } from '@/components/ui/modal';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useIsAdmin } from '@/components/use-role';
import { errorMessage } from '@/lib/api';
import { money, todayYmd } from '@/lib/format';
import {
  punchCode,
  staffToday,
  useGivePoints,
  useManualAttendance,
  usePoints,
  usePointsConfig,
  useSaveStaff,
  useStaffConfig,
  useStaffMonth,
  useStaffMove,
} from '@/lib/phase4-queries';

const DAYS = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
const PT = { month: 'شهري', week: 'أسبوعي', day: 'يومية' } as const;
const KIND = { advance: '💸 سلفة', bonus: '🎉 مكافأة', deduct: '➖ خصم', pay: '💵 قبض' } as const;
const M = (n: number) => money(Math.round(n));
const hm = (t: string | null) => (t ? new Date(t).toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo', hour: 'numeric', minute: '2-digit' }) : '—');
const num = (v: string) => Number(String(v ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٬\s]/g, '')) || 0;
const wd = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

interface Calc {
  work: number;
  pres: number;
  abs: string[];
  late: number;
  hrs: number;
  base: number;
  daily: number;
  lateCut: number;
  adv: number;
  bon: number;
  ded: number;
  paid: number;
  due: number;
  rest: number;
}

/** The old calc(): one employee's month. */
function calc(s: StaffDto, d: StaffMonth): Calc {
  const [y, mo] = d.month.split('-').map(Number);
  const last = new Date(Date.UTC(y!, mo!, 0)).getUTCDate();
  const t = todayYmd();
  const A = d.attendance.filter((r) => r.staffId === s.id);
  const have = new Set(A.map((r) => r.day));
  let work = 0;
  const abs: string[] = [];
  for (let i = 1; i <= last; i++) {
    const iso = `${d.month}-${String(i).padStart(2, '0')}`;
    if (iso > t || iso < s.startDate || (!s.active && !have.has(iso))) continue;
    if (wd(iso) === s.offDay) continue;
    work++;
    if (!have.has(iso) && iso < t) abs.push(iso);
  }
  const pres = A.filter((r) => r.inAt).length;
  const late = A.reduce((x, r) => x + r.lateMin, 0);
  const hrs = A.reduce((x, r) => x + (r.inAt && r.outAt ? (Date.parse(r.outAt) - Date.parse(r.inAt)) / 36e5 : 0), 0);
  const cfg = d.config ?? { absent: true, late: 0 };
  let base: number;
  let daily: number;
  if (s.payType === 'day') {
    daily = s.salary;
    base = pres * s.salary;
  } else if (s.payType === 'week') {
    daily = s.salary / 6;
    base = pres * daily;
  } else {
    daily = s.salary / 30;
    base = s.salary - (cfg.absent ? abs.length * daily : 0);
  }
  const lateCut = cfg.late * late;
  const mv = (k: StaffMoveDto['kind']) => d.moves.filter((x) => x.staffId === s.id && x.kind === k && x.month === d.month).reduce((a, x) => a + x.amount, 0);
  const adv = mv('advance');
  const bon = mv('bonus');
  const ded = mv('deduct');
  const paid = mv('pay');
  const due = Math.round(base + bon - ded - adv - lateCut);
  return { work, pres, abs, late, hrs, base: Math.round(base), daily, lateCut: Math.round(lateCut), adv, bon, ded, paid, due, rest: due - paid };
}

function MonthSel({ value, onChange, count = 12 }: { value: string; onChange: (v: string) => void; count?: number }) {
  const t = todayYmd();
  const opts = Array.from({ length: count }, (_, i) => {
    const x = new Date(Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1 - i, 1));
    const v = x.toISOString().slice(0, 7);
    return <option key={v} value={v}>{x.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</option>;
  });
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 'auto' }}>
      {opts}
    </select>
  );
}

const emptyStaff = (): StaffInput => ({
  name: '',
  job: '',
  phone: '',
  nid: '',
  address: '',
  payType: 'month',
  salary: 0,
  shiftStart: '10:00',
  shiftEnd: '22:00',
  offDay: 5,
  startDate: todayYmd(),
  userId: null,
  note: '',
  active: true,
});

function EditStaff({ s, d, onClose }: { s?: StaffDto; d: StaffMonth; onClose: () => void }) {
  const toast = useToast();
  const save = useSaveStaff();
  const [f, setF] = useState<StaffInput>(s ? { ...s, nid: s.nid, startDate: s.startDate } : emptyStaff());
  const set = (p: Partial<StaffInput>) => setF((x) => ({ ...x, ...p }));
  const go = async () => {
    if (!f.name.trim()) return toast('اكتب الاسم', 'bad');
    if (f.userId && d.staff.some((x) => x.userId === f.userId && x.id !== s?.id)) return toast('الحساب ده مربوط بموظف تاني', 'bad');
    try {
      await save.mutateAsync({ id: s?.id, input: { ...f, name: f.name.trim() } });
      onClose();
      toast('✔ اتحفظ');
    } catch (e) {
      toast(`ماتحفظش: ${errorMessage(e)}`, 'bad');
    }
  };
  return (
    <Modal title={s ? `📋 ملف ${s.name}` : '➕ موظف جديد'} onClose={onClose}>
      <div className="form">
        <div className="field">
          <label>الاسم</label>
          <input value={f.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className="field">
          <label>الشغلانة</label>
          <input value={f.job} placeholder="بياع / مخزن / توصيل / مساعد" onChange={(e) => set({ job: e.target.value })} />
        </div>
        <div className="field">
          <label>الموبايل</label>
          <input inputMode="tel" dir="ltr" value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
        </div>
        <div className="field">
          <label>الرقم القومي (اختياري)</label>
          <input inputMode="numeric" dir="ltr" value={f.nid} onChange={(e) => set({ nid: e.target.value })} />
        </div>
        <div className="field full">
          <label>العنوان (اختياري)</label>
          <input value={f.address} onChange={(e) => set({ address: e.target.value })} />
        </div>
        <div className="field">
          <label>نظام القبض</label>
          <select value={f.payType} onChange={(e) => set({ payType: e.target.value as StaffInput['payType'] })}>
            {Object.entries(PT).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>المرتب / اليومية</label>
          <input type="number" min="0" value={f.salary || ''} onChange={(e) => set({ salary: num(e.target.value) })} />
        </div>
        <div className="field">
          <label>ميعاد الحضور</label>
          <input type="time" value={f.shiftStart} onChange={(e) => set({ shiftStart: e.target.value || '10:00' })} />
        </div>
        <div className="field">
          <label>ميعاد الانصراف</label>
          <input type="time" value={f.shiftEnd} onChange={(e) => set({ shiftEnd: e.target.value || '22:00' })} />
        </div>
        <div className="field">
          <label>يوم الأجازة</label>
          <select value={f.offDay} onChange={(e) => set({ offDay: Number(e.target.value) })}>
            <option value={-1}>مفيش</option>
            {DAYS.map((x, i) => (
              <option key={x} value={i}>
                {x}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>بدأ الشغل من</label>
          <input type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value || todayYmd() })} />
        </div>
        <div className="field full">
          <label>حسابه على السيستم (عشان يسجل حضوره بالـ QR من موبايله)</label>
          <select value={f.userId ?? ''} onChange={(e) => set({ userId: e.target.value || null })}>
            <option value="">مالوش حساب — هسجله يدوي</option>
            {d.members?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.role === 'ADMIN' ? 'مدير' : 'موظف'})
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label>ملاحظات</label>
          <input value={f.note} onChange={(e) => set({ note: e.target.value })} />
        </div>
        {s && (
          <div className="field full">
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'inherit' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={f.active} onChange={(e) => set({ active: e.target.checked })} /> لسه شغال معانا
            </label>
          </div>
        )}
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={save.isPending} onClick={go}>
          حفظ
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

function StaffCard({ s, d, onClose, onEdit, onManual }: { s: StaffDto; d: StaffMonth; onClose: () => void; onEdit: () => void; onManual: () => void }) {
  const c = calc(s, d);
  const A = d.attendance.filter((r) => r.staffId === s.id);
  const V = d.moves.filter((x) => x.staffId === s.id).slice(0, 40);
  const cfg = d.config ?? { absent: true, late: 0 };
  return (
    <Modal title={`📋 ${s.name}`} onClose={onClose} wide>
      <div className="st-row" style={{ gap: 6, marginBottom: 8 }}>
        <button type="button" className="secondary" onClick={onEdit}>
          ✏️ تعديل الملف
        </button>
        <button type="button" className="secondary" onClick={onManual}>
          ✍️ تسجيل حضور يدوي
        </button>
        {s.phone && (
          <a className="secondary" style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)' }} href={`https://wa.me/2${s.phone.replace(/\D/g, '').replace(/^2/, '')}`} target="_blank" rel="noreferrer">
            💬 واتساب
          </a>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8, fontSize: 14 }}>
        <div>
          <small>الشغلانة</small>
          <br />
          {s.job || '—'}
        </div>
        <div>
          <small>الموبايل</small>
          <br />
          {s.phone || '—'}
        </div>
        <div>
          <small>المواعيد</small>
          <br />
          {s.shiftStart} — {s.shiftEnd}
        </div>
        <div>
          <small>الأجازة</small>
          <br />
          {s.offDay >= 0 ? DAYS[s.offDay] : 'مفيش'}
        </div>
        <div>
          <small>المرتب</small>
          <br />
          {PT[s.payType]} {M(s.salary)}
        </div>
        <div>
          <small>من</small>
          <br />
          {s.startDate}
        </div>
        <div>
          <small>حساب السيستم</small>
          <br />
          {s.userId ? '✅ مربوط (بيسجل بالـ QR)' : '— يدوي'}
        </div>
      </div>
      <h3 style={{ fontSize: 15, margin: '12px 0 6px' }}>حساب {d.month}</h3>
      <div style={{ fontSize: 14, lineHeight: 2 }}>
        {s.payType === 'month' ? (
          <>
            المرتب {M(s.salary)}
            {c.abs.length > 0 && cfg.absent ? ` − غياب ${c.abs.length} يوم (${M(c.abs.length * c.daily)})` : ''}
          </>
        ) : (
          `${c.pres} يوم × ${M(c.daily)}`
        )}{' '}
        = <b>{M(c.base)}</b>
        {c.bon > 0 && (
          <>
            <br />+ مكافآت {M(c.bon)}
          </>
        )}
        {c.ded > 0 && (
          <>
            <br />− خصومات {M(c.ded)}
          </>
        )}
        {c.lateCut > 0 && (
          <>
            <br />− تأخير {c.late} دقيقة ({M(c.lateCut)})
          </>
        )}
        {c.adv > 0 && (
          <>
            <br />− سلف {M(c.adv)}
          </>
        )}
        <br />
        المستحق <b>{M(c.due)}</b> · اتقبض {M(c.paid)} · <b style={{ color: '#087f8c' }}>الباقي {M(c.rest)}</b>
        {c.abs.length > 0 && (
          <>
            <br />
            <small style={{ color: '#b33' }}>أيام الغياب: {c.abs.map((x) => x.slice(8)).join('، ')}</small>
          </>
        )}
      </div>
      <h3 style={{ fontSize: 15, margin: '12px 0 6px' }}>الحضور</h3>
      <AttTable rows={A} withMethod />
      <h3 style={{ fontSize: 15, margin: '12px 0 6px' }}>آخر الحركات</h3>
      {V.length ? (
        V.map((x) => (
          <div key={x.id} style={{ fontSize: 13, borderBottom: '1px solid var(--border)', padding: '5px 0' }}>
            {KIND[x.kind]} {M(x.amount)} — {x.month} {x.note ? `· ${x.note}` : ''}
            <span style={{ color: '#7b8a90' }}> · {new Date(x.createdAt).toLocaleDateString('ar-EG')}</span>
          </div>
        ))
      ) : (
        <div className="empty">مفيش حركات.</div>
      )}
      <div className="modal-foot">
        <button type="button" className="secondary" onClick={onClose}>
          إغلاق
        </button>
      </div>
    </Modal>
  );
}

function AttTable({ rows, withMethod }: { rows: AttendanceDto[]; withMethod?: boolean }) {
  if (!rows.length) return <div className="empty">مفيش حضور الشهر ده.</div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>اليوم</th>
            <th>حضور</th>
            <th>انصراف</th>
            <th>تأخير</th>
            {withMethod && <th />}
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((r) => (
            <tr key={r.id}>
              <td>
                {DAYS[wd(r.day)]} {withMethod ? r.day.slice(5) : r.day}
              </td>
              <td>{hm(r.inAt)}</td>
              <td>{hm(r.outAt)}</td>
              <td>{r.lateMin ? `${r.lateMin} د` : '—'}</td>
              {withMethod && <td>{r.method === 'manual' ? '✍️' : '📱'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoveModal({ s, kind, month, onClose }: { s: StaffDto; kind: 'advance' | 'bonus'; month: string; onClose: () => void }) {
  const toast = useToast();
  const move = useStaffMove();
  const [k, setK] = useState<'bonus' | 'deduct'>('bonus');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const go = async () => {
    const a = num(amount);
    if (a <= 0) return toast('اكتب المبلغ', 'bad');
    try {
      await move.mutateAsync({ id: s.id, input: { kind: kind === 'advance' ? 'advance' : k, amount: a, month, note: note.trim() } });
      onClose();
      toast('✔ اتسجل');
    } catch (e) {
      toast(`ماتسجلش: ${errorMessage(e)}`, 'bad');
    }
  };
  return (
    <Modal title={`${kind === 'advance' ? '💸 سلفة لـ ' : '🎉 مكافأة أو ➖ خصم — '}${s.name}`} onClose={onClose}>
      <div className="form">
        {kind !== 'advance' && (
          <div className="field">
            <label>النوع</label>
            <select value={k} onChange={(e) => setK(e.target.value as 'bonus' | 'deduct')}>
              <option value="bonus">🎉 مكافأة</option>
              <option value="deduct">➖ خصم</option>
            </select>
          </div>
        )}
        <div className="field">
          <label>المبلغ</label>
          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field full">
          <label>السبب</label>
          <input placeholder={kind === 'advance' ? 'مثلاً: ظرف عائلي' : 'مثلاً: شغل زيادة يوم الجمعة'} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      {kind === 'advance' && <p style={{ fontSize: 12, color: '#7b8a90', margin: '4px 0' }}>السلفة بتتخصم من مرتب الشهر ده، وبتتسجل في المصروفات عشان الدرج يتقفل صح.</p>}
      <div className="modal-foot">
        <button type="button" className="primary" disabled={move.isPending} onClick={go}>
          حفظ
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

function PayModal({ s, d, onClose }: { s: StaffDto; d: StaffMonth; onClose: () => void }) {
  const toast = useToast();
  const move = useStaffMove();
  const c = calc(s, d);
  const [amount, setAmount] = useState(String(Math.max(0, c.rest)));
  const [note, setNote] = useState('');
  const go = async () => {
    const a = num(amount);
    if (a <= 0) return toast('اكتب المبلغ', 'bad');
    try {
      await move.mutateAsync({ id: s.id, input: { kind: 'pay', amount: a, month: d.month, note: note.trim() } });
      onClose();
      toast('✔ اتقبض واتسجل في المصروفات');
    } catch (e) {
      toast(`ماتسجلش: ${errorMessage(e)}`, 'bad');
    }
  };
  const wa = () => {
    const t = `كشف حساب ${s.name} — شهر ${d.month}\nأيام الحضور: ${c.pres} من ${c.work}${c.abs.length ? `\nغياب: ${c.abs.length} يوم` : ''}${c.late ? `\nتأخير: ${c.late} دقيقة` : ''}\nالمرتب المستحق: ${Math.round(c.base)} ج${c.bon ? `\nمكافآت: ${c.bon} ج` : ''}${c.ded ? `\nخصومات: ${c.ded} ج` : ''}${c.adv ? `\nسلف: ${c.adv} ج` : ''}${c.lateCut ? `\nخصم تأخير: ${c.lateCut} ج` : ''}\nالصافي: ${c.due} ج\nاتقبض: ${c.paid} ج\nالباقي: ${c.rest} ج`;
    window.open(`https://wa.me/2${s.phone.replace(/\D/g, '').replace(/^2/, '')}?text=${encodeURIComponent(t)}`, '_blank');
  };
  return (
    <Modal title={`💵 قبض مرتب ${s.name} — ${d.month}`} onClose={onClose}>
      <p style={{ fontSize: 14, lineHeight: 1.9, margin: '0 0 8px' }}>
        المستحق {M(c.due)} · اتقبض قبل كده {M(c.paid)} · <b>الباقي {M(c.rest)}</b>
      </p>
      <div className="form">
        <div className="field">
          <label>المبلغ اللي هيقبضه</label>
          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label>ملاحظة</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#7b8a90', margin: '4px 0' }}>بيتسجل في المصروفات (بند مرتبات) أوتوماتيك.</p>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={move.isPending} onClick={go}>
          💵 قبّض
        </button>
        {s.phone && (
          <button type="button" className="secondary" onClick={wa}>
            💬 ابعتله كشف الحساب
          </button>
        )}
        <button type="button" className="secondary" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

function ManualModal({ d, staffId, onClose }: { d: StaffMonth; staffId?: string; onClose: () => void }) {
  const toast = useToast();
  const save = useManualAttendance();
  const act = d.staff.filter((s) => s.active);
  const [sid, setSid] = useState(staffId ?? act[0]?.id ?? '');
  const [day, setDay] = useState(todayYmd());
  const [inT, setIn] = useState('');
  const [outT, setOut] = useState('');
  const [note, setNote] = useState('');
  const go = async () => {
    if (!day || !inT) return toast('اكتب اليوم وساعة الحضور', 'bad');
    try {
      await save.mutateAsync({ staffId: sid, day, inTime: inT, ...(outT ? { outTime: outT } : {}), note: note.trim() });
      onClose();
      toast('✔ اتسجل');
    } catch (e) {
      toast(`ماتسجلش: ${errorMessage(e)}`, 'bad');
    }
  };
  return (
    <Modal title="✍️ تسجيل حضور يدوي" onClose={onClose}>
      <div className="form">
        <div className="field">
          <label>الموظف</label>
          <select value={sid} onChange={(e) => setSid(e.target.value)}>
            {act.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>اليوم</label>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        <div className="field">
          <label>حضر الساعة</label>
          <input type="time" value={inT} onChange={(e) => setIn(e.target.value)} />
        </div>
        <div className="field">
          <label>مشي الساعة (اختياري)</label>
          <input type="time" value={outT} onChange={(e) => setOut(e.target.value)} />
        </div>
        <div className="field full">
          <label>ملاحظة</label>
          <input placeholder="مثلاً: نسي موبايله" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={save.isPending} onClick={go}>
          حفظ
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

function ConfigModal({ cfg, onClose }: { cfg: StaffConfig; onClose: () => void }) {
  const toast = useToast();
  const save = useStaffConfig();
  const [absent, setAbsent] = useState(cfg.absent);
  const [late, setLate] = useState(String(cfg.late));
  return (
    <Modal title="⚙️ قواعد المرتب" onClose={onClose}>
      <div className="form">
        <div className="field full">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'inherit' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={absent} onChange={(e) => setAbsent(e.target.checked)} /> اخصم أيام الغياب من المرتب الشهري (المرتب ÷ ٣٠ لكل يوم)
          </label>
        </div>
        <div className="field">
          <label>خصم التأخير — جنيه لكل دقيقة (0 = من غير خصم)</label>
          <input type="number" min="0" step="0.25" value={late} onChange={(e) => setLate(e.target.value)} />
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#7b8a90' }}>التأخير بيتحسب من ميعاد الحضور في ملف كل موظف.</p>
      <div className="modal-foot">
        <button
          type="button"
          className="primary"
          disabled={save.isPending}
          onClick={async () => {
            try {
              await save.mutateAsync({ absent, late: Math.max(0, num(late)) });
              onClose();
              toast('✔ اتحفظ');
            } catch (e) {
              toast(`ماتحفظش: ${errorMessage(e)}`, 'bad');
            }
          }}
        >
          حفظ
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

/** «📺 شاشة الحضور»: a full-screen QR that changes every 30 seconds. */
function QrScreen({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(0);
  const [err, setErr] = useState('');
  const [now, setNow] = useState('');
  const [people, setPeople] = useState<{ name: string; inAt: string | null; outAt: string | null }[]>([]);
  const leftRef = useRef(0);
  useEffect(() => {
    try {
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    } catch {
      /* not allowed */
    }
    const tick = async () => {
      if (leftRef.current <= 0) {
        try {
          const r = await punchCode();
          setCode(r.code);
          setErr('');
          leftRef.current = 30;
        } catch (e) {
          setErr(errorMessage(e));
          leftRef.current = 5;
        }
      }
      leftRef.current--;
      setLeft(leftRef.current);
      setNow(new Date().toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo', hour: 'numeric', minute: '2-digit' }));
    };
    const load = () => staffToday().then(setPeople).catch(() => undefined);
    void tick();
    void load();
    const a = setInterval(tick, 1000);
    const b = setInterval(load, 8000);
    return () => {
      clearInterval(a);
      clearInterval(b);
      try {
        if (document.fullscreenElement) void document.exitFullscreen();
      } catch {
        /* ignore */
      }
    };
  }, []);
  const url = typeof window !== 'undefined' && code ? `${window.location.origin}/staff#punch=${code}` : '';
  return (
    <div id="stQR">
      <button type="button" className="x" onClick={onClose}>
        ✕ قفل
      </button>
      <h1>👷 تسجيل الحضور والانصراف</h1>
      <p>افتح كاميرا موبايلك وصوّر الكود — أول مرة في اليوم حضور، والتانية انصراف</p>
      <div className="qr">{url ? <QrCode text={url} size={Math.min(340, typeof window !== 'undefined' ? window.innerWidth * 0.7 : 300)} /> : '⏳'}</div>
      <div className="bar">
        <i style={{ width: `${(left / 30) * 100}%` }} />
      </div>
      <p style={{ fontSize: 22, color: '#fff' }}>{err ? `⚠️ ${err}` : now}</p>
      <div className="now">
        {people.length ? (
          people.map((r, i) => (
            <span key={i}>
              {r.outAt ? '👋' : '✅'} {r.name} {hm(r.inAt)}
              {r.outAt ? ` — ${hm(r.outAt)}` : ''}
            </span>
          ))
        ) : (
          <span>لسه محدش سجّل النهارده</span>
        )}
      </div>
    </div>
  );
}

/** QR drawn with the qrcodejs library from cdnjs, as the old system did. */
function QrCode({ text, size }: { text: string; size: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const w = window as unknown as { QRCode?: unknown };
    if (w.QRCode) return setReady(true);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = () => setReady(true);
    s.onerror = () => setFailed(true);
    document.head.appendChild(s);
  }, []);
  useEffect(() => {
    if (!ready || !ref.current) return;
    ref.current.innerHTML = '';
    const Q = (window as unknown as { QRCode: new (el: HTMLElement, o: object) => unknown & { CorrectLevel?: unknown } }).QRCode;
    new Q(ref.current, { text, width: size, height: size, correctLevel: (Q as unknown as { CorrectLevel: { M: number } }).CorrectLevel.M });
  }, [ready, text, size]);
  if (failed) return <div style={{ color: '#000' }}>مكتبة الـ QR ماحملتش — اتأكد من النت</div>;
  return <div ref={ref} />;
}

function PointsModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [month, setMonth] = useState(todayYmd().slice(0, 7));
  const b = usePoints(month);
  const give = useGivePoints();
  const saveCfg = usePointsConfig();
  const [view, setView] = useState<{ kind: 'give'; id: string; sign: 1 | -1 } | { kind: 'redeem'; id: string } | { kind: 'hist'; id: string } | { kind: 'rules' } | null>(null);
  const [why, setWhy] = useState('');
  const [pts, setPts] = useState('5');
  const medal = (i: number) => ['🥇', '🥈', '🥉'][i] ?? '⭐';
  if (!b.data)
    return (
      <Modal title="⭐ نقاط العمال" onClose={onClose}>
        {b.isError ? <ErrorBox message={errorMessage(b.error)} /> : <Loading />}
      </Modal>
    );
  const d = b.data;
  const R = d.config.rules;
  const nameOf = (id: string) => d.rows.find((r) => r.staff.id === id)?.staff.name ?? '';

  if (view?.kind === 'give') {
    const rs = d.config.reasons.filter((r) => (view.sign > 0 ? r[1] > 0 : r[1] < 0));
    return (
      <Modal title={`${view.sign > 0 ? '➕ نقاط لـ ' : '➖ خصم من '}${nameOf(view.id)}`} onClose={() => setView(null)}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {rs.map((r) => (
            <button
              key={r[0]}
              type="button"
              className="secondary"
              onClick={() => {
                setWhy(r[0]);
                setPts(String(Math.abs(r[1])));
              }}
            >
              {r[0]} ({r[1] > 0 ? '+' : ''}
              {r[1]})
            </button>
          ))}
        </div>
        <div className="form">
          <div className="field">
            <label>السبب</label>
            <input value={why} onChange={(e) => setWhy(e.target.value)} />
          </div>
          <div className="field">
            <label>عدد النقاط</label>
            <input inputMode="numeric" value={pts} onChange={(e) => setPts(e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <button
            type="button"
            className="primary"
            onClick={async () => {
              const v = Math.abs(Math.round(num(pts))) * view.sign;
              if (!v) return toast('اكتب عدد النقاط', 'bad');
              try {
                await give.mutateAsync({ id: view.id, pts: v, why: why.trim() });
                toast('✔ اتسجّلت');
                setView(null);
              } catch (e) {
                toast(`ماتحفظش: ${errorMessage(e)}`, 'bad');
              }
            }}
          >
            حفظ
          </button>
        </div>
      </Modal>
    );
  }
  if (view?.kind === 'redeem') {
    const row = d.rows.find((r) => r.staff.id === view.id)!;
    return (
      <Modal title={`🎁 استبدال نقاط — ${row.staff.name}`} onClose={() => setView(null)}>
        <p>
          الرصيد: <b>{row.balance}</b> نقطة
        </p>
        {d.config.rewards.map((r) => (
          <button
            key={r[0]}
            type="button"
            className={row.balance >= r[1] ? 'primary' : 'secondary'}
            style={{ display: 'block', width: '100%', margin: '6px 0', textAlign: 'start' }}
            disabled={row.balance < r[1]}
            onClick={async () => {
              try {
                await give.mutateAsync({ id: view.id, pts: -r[1], why: `🎁 استبدال: ${r[0]}`, redeem: true });
                toast('✔ اتصرفت المكافأة');
                setView(null);
              } catch (e) {
                toast(errorMessage(e), 'bad');
              }
            }}
          >
            {r[0]} — {r[1]} نقطة
          </button>
        ))}
      </Modal>
    );
  }
  if (view?.kind === 'hist') {
    const L = d.log.filter((l) => l.staffId === view.id);
    return (
      <Modal title={`📜 سجل نقاط ${nameOf(view.id)}`} onClose={() => setView(null)}>
        {L.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>السبب</th>
                  <th>النقاط</th>
                  <th>بواسطة</th>
                </tr>
              </thead>
              <tbody>
                {L.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.createdAt).toLocaleDateString('ar-EG')}</td>
                    <td>{l.why}</td>
                    <td style={{ color: l.pts >= 0 ? '#087f8c' : '#b33', fontWeight: 800 }}>
                      {l.pts > 0 ? '+' : ''}
                      {l.pts}
                    </td>
                    <td>{l.byName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">مفيش حركات يدوي لسه — النقاط الأوتوماتيك من الحضور بتتحسب لوحدها.</div>
        )}
        <button type="button" className="secondary" style={{ marginTop: 8 }} onClick={() => setView(null)}>
          ↩ رجوع
        </button>
      </Modal>
    );
  }
  if (view?.kind === 'rules') return <PointsRules cfg={d.config} onClose={() => setView(null)} onSave={(c) => saveCfg.mutateAsync(c)} />;

  return (
    <Modal title="⭐ نقاط العمال" onClose={onClose} wide>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <MonthSel value={month} onChange={setMonth} count={6} />
        <button type="button" className="secondary" onClick={() => setView({ kind: 'rules' })}>
          ⚙️ قواعد النقاط
        </button>
      </div>
      <div style={{ background: '#fff8e6', border: '1px solid #f0d68a', borderRadius: 12, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>
        أوتوماتيك من الحضور: يوم في ميعاده <b>{R.ontime > 0 ? '+' : ''}{R.ontime}</b> · تأخير أكتر من {R.lateMin} دقيقة <b>{R.late}</b> · غياب <b>{R.absent}</b> · شهر كامل من غير غياب ولا تأخير <b>+{R.fullMonth}</b>
      </div>
      {d.rows.length ? (
        d.rows.map((r, i) => (
          <div key={r.staff.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '10px 12px', margin: '8px 0', ...(i === 0 && r.month > 0 ? { background: 'linear-gradient(135deg,#fff8e1,#fff)' } : {}) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 26 }}>{medal(i)}</span>
              <div style={{ flex: 1, minWidth: 140 }}>
                <b style={{ fontSize: 16 }}>{r.staff.name}</b>
                <br />
                <small style={{ color: '#7b8a90' }}>
                  {r.staff.job} · في ميعاده {r.on} · متأخر {r.late} · غاب {r.abs}
                </small>
              </div>
              <div style={{ textAlign: 'center' }}>
                <b style={{ fontSize: 22, color: r.month >= 0 ? '#087f8c' : '#b33' }}>{r.month}</b>
                <br />
                <small>نقطة الشهر</small>
              </div>
              <div style={{ textAlign: 'center' }}>
                <b style={{ fontSize: 18 }}>{r.balance}</b>
                <br />
                <small>الرصيد</small>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <button type="button" className="primary" onClick={() => (setWhy(''), setPts('5'), setView({ kind: 'give', id: r.staff.id, sign: 1 }))}>
                ➕ نقاط
              </button>
              <button type="button" className="secondary" onClick={() => (setWhy(''), setPts('5'), setView({ kind: 'give', id: r.staff.id, sign: -1 }))}>
                ➖ خصم
              </button>
              <button type="button" className="secondary" onClick={() => setView({ kind: 'redeem', id: r.staff.id })}>
                🎁 استبدال
              </button>
              <button type="button" className="secondary" onClick={() => setView({ kind: 'hist', id: r.staff.id })}>
                📜 السجل
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="empty">ضيف الموظفين الأول من «موظف جديد».</div>
      )}
    </Modal>
  );
}

function PointsRules({ cfg, onClose, onSave }: { cfg: PointsConfig; onClose: () => void; onSave: (c: PointsConfig) => Promise<unknown> }) {
  const toast = useToast();
  const [r, setR] = useState<Record<string, string>>(Object.fromEntries(Object.entries(cfg.rules).map(([k, v]) => [k, String(v)])));
  const [reasons, setReasons] = useState(cfg.reasons.map((x) => `${x[0]} = ${x[1]}`).join('\n'));
  const [rewards, setRewards] = useState(cfg.rewards.map((x) => `${x[0]} = ${x[1]}`).join('\n'));
  const parse = (t: string): [string, number][] =>
    t
      .split('\n')
      .map((l) => l.split('='))
      .filter((a) => a.length === 2 && a[0]!.trim())
      .map((a) => [a[0]!.trim(), num(a[1]!)]);
  const L: [string, string][] = [
    ['ontime', 'يوم في ميعاده'],
    ['late', 'يوم متأخر'],
    ['lateMin', 'التأخير يتحسب بعد كام دقيقة'],
    ['absent', 'يوم غياب'],
    ['fullMonth', 'شهر كامل من غير غياب ولا تأخير'],
  ];
  return (
    <Modal title="⚙️ قواعد النقاط" onClose={onClose}>
      <div className="form">
        {L.map(([k, l]) => (
          <div key={k} className="field">
            <label>{l}</label>
            <input inputMode="numeric" value={r[k]} onChange={(e) => setR({ ...r, [k]: e.target.value })} />
          </div>
        ))}
        <div className="field full">
          <label>أسباب سريعة (كل سطر: السبب = النقاط)</label>
          <textarea rows={6} value={reasons} onChange={(e) => setReasons(e.target.value)} />
        </div>
        <div className="field full">
          <label>المكافآت (كل سطر: المكافأة = النقاط)</label>
          <textarea rows={5} value={rewards} onChange={(e) => setRewards(e.target.value)} />
        </div>
      </div>
      <div className="modal-foot">
        <button
          type="button"
          className="primary"
          onClick={async () => {
            const rules = Object.fromEntries(L.map(([k]) => [k, String(r[k] ?? '').trim().startsWith('-') ? -num(String(r[k]).replace('-', '')) : num(r[k] ?? '0')])) as PointsConfig['rules'];
            try {
              await onSave({ rules, reasons: parse(reasons), rewards: parse(rewards) });
              toast('✔ اتحفظت القواعد');
              onClose();
            } catch (e) {
              toast(`ماتحفظش: ${errorMessage(e)}`, 'bad');
            }
          }}
        >
          حفظ
        </button>
      </div>
    </Modal>
  );
}

type View =
  | { kind: 'edit'; s?: StaffDto }
  | { kind: 'card'; s: StaffDto }
  | { kind: 'move'; s: StaffDto; m: 'advance' | 'bonus' }
  | { kind: 'pay'; s: StaffDto }
  | { kind: 'manual'; staffId?: string }
  | { kind: 'config' }
  | { kind: 'qr' }
  | { kind: 'points' };

export default function StaffPage() {
  const admin = useIsAdmin();
  const [month, setMonth] = useState(todayYmd().slice(0, 7));
  const data = useStaffMonth(month);
  const [view, setView] = useState<View | null>(null);
  const d = data.data;
  const close = () => setView(null);
  const rows = useMemo(() => (d ? d.staff.filter((s) => s.active).map((s) => [s, calc(s, d)] as const) : []), [d]);

  if (data.isPending) return <div style={{ padding: 30, textAlign: 'center', color: '#8a979c' }}>⏳ بجيب بيانات العمالة…</div>;
  if (data.isError || !d) return <ErrorBox message={`ماقدرتش أجيب البيانات: ${errorMessage(data.error)}`} onRetry={() => data.refetch()} />;

  if (!admin) {
    const me = d.staff[0];
    if (!me)
      return (
        <>
          <div className="title-row">
            <div className="title">
              <h1>👷 حضوري</h1>
            </div>
          </div>
          <div className="empty">حسابك لسه مش مربوط بملف موظف — كلم صاحب المحل.</div>
        </>
      );
    const c = calc(me, d);
    return (
      <>
        <div className="title-row">
          <div className="title">
            <h1>👷 حضوري — {me.name}</h1>
            <p>عشان تسجل حضورك أو انصرافك: صوّر الـ QR اللي على شاشة المحل بكاميرا موبايلك</p>
          </div>
        </div>
        <div className="st-row">
          <MonthSel value={month} onChange={setMonth} />
        </div>
        <div className="st-cards">
          <div className="st-card">
            <small>أيام الحضور</small>
            <b>{c.pres}</b>
            <small>من {c.work} يوم شغل</small>
          </div>
          <div className="st-card">
            <small>التأخير</small>
            <b>{c.late}</b>
            <small>دقيقة الشهر ده</small>
          </div>
          <div className="st-card">
            <small>الساعات</small>
            <b>{Math.round(c.hrs)}</b>
          </div>
        </div>
        <AttTable rows={d.attendance.filter((r) => r.staffId === me.id)} />
      </>
    );
  }

  const t = todayYmd();
  const nm = (id: string) => d.staff.find((s) => s.id === id)?.name ?? '';
  const T = d.attendance.filter((r) => r.day === t);
  const inNow = T.filter((r) => r.inAt && !r.outAt);
  const lateT = T.filter((r) => r.lateMin > 10);
  const absT = month === t.slice(0, 7) ? d.staff.filter((s) => s.active && s.offDay !== wd(t) && !T.some((r) => r.staffId === s.id)) : [];
  const tot = rows.reduce((a, [, c]) => a + Math.max(0, c.rest), 0);
  const advT = rows.reduce((a, [, c]) => a + c.adv, 0);
  const gone = d.staff.filter((s) => !s.active);

  return (
    <>
      <div className="title-row">
        <div className="title">
          <h1>👷 العمالة والمرتبات</h1>
          <p>ملف كل موظف، حضوره وانصرافه بالـ QR، وتأخيره وسلفه ومرتبه</p>
        </div>
        <div className="btnrow">
          <button type="button" className="secondary" onClick={() => setView({ kind: 'points' })} style={{ borderColor: '#c9971f', color: '#8a6410' }}>
            ⭐ نقاط العمال
          </button>
          <button type="button" className="secondary" onClick={() => setView({ kind: 'manual' })}>
            ✍️ تسجيل يدوي
          </button>
          <button type="button" className="secondary" onClick={() => setView({ kind: 'config' })}>
            ⚙️ قواعد المرتب
          </button>
          <button type="button" className="secondary" onClick={() => setView({ kind: 'qr' })}>
            📺 شاشة الحضور QR
          </button>
          <button type="button" className="primary" onClick={() => setView({ kind: 'edit' })}>
            ➕ موظف جديد
          </button>
        </div>
      </div>
      <div className="st-row">
        <MonthSel value={month} onChange={setMonth} />
      </div>
      <div className="st-cards">
        <div className="st-card">
          <small>موجودين في المحل دلوقتي</small>
          <b>{inNow.length}</b>
          <div>
            {inNow.map((r) => (
              <span key={r.id} className="st-chip">
                {nm(r.staffId)} من {hm(r.inAt)}
              </span>
            ))}
          </div>
        </div>
        <div className="st-card">
          <small>متأخرين النهارده</small>
          <b>{lateT.length}</b>
          <div>
            {lateT.map((r) => (
              <span key={r.id} className="st-chip late">
                {nm(r.staffId)} {r.lateMin} د
              </span>
            ))}
          </div>
        </div>
        <div className="st-card">
          <small>لسه ماجوش النهارده</small>
          <b>{absT.length}</b>
          <div>
            {absT.map((s) => (
              <span key={s.id} className="st-chip abs">
                {s.name}
              </span>
            ))}
          </div>
        </div>
        <div className="st-card">
          <small>باقي مرتبات الشهر</small>
          <b>{M(tot)}</b>
          <small>سلف الشهر {M(advT)}</small>
        </div>
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الموظف</th>
                <th>الحضور</th>
                <th>التأخير</th>
                <th>المستحق</th>
                <th>سلف / خصم</th>
                <th>اتقبض</th>
                <th>الباقي</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(([s, c]) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.name}</b>
                    <br />
                    <small style={{ color: '#7b8a90' }}>
                      {s.job} · {PT[s.payType]} {M(s.salary)}
                    </small>
                  </td>
                  <td>
                    {c.pres} من {c.work} يوم
                    {c.abs.length > 0 && (
                      <>
                        <br />
                        <small style={{ color: '#b33' }}>غاب {c.abs.length}</small>
                      </>
                    )}
                    <br />
                    <small style={{ color: '#7b8a90' }}>{Math.round(c.hrs)} ساعة</small>
                  </td>
                  <td>{c.late ? `${c.late} دقيقة` : '—'}</td>
                  <td>
                    {M(c.base + c.bon)}
                    {c.bon > 0 && (
                      <>
                        <br />
                        <small style={{ color: '#087f8c' }}>+ مكافأة {M(c.bon)}</small>
                      </>
                    )}
                  </td>
                  <td>
                    {c.adv ? `سلف ${M(c.adv)}` : ''}
                    {c.ded ? (
                      <>
                        <br />
                        خصم {M(c.ded)}
                      </>
                    ) : null}
                    {c.lateCut ? (
                      <>
                        <br />
                        تأخير {M(c.lateCut)}
                      </>
                    ) : null}
                    {!c.adv && !c.ded && !c.lateCut ? '—' : ''}
                  </td>
                  <td>{M(c.paid)}</td>
                  <td>
                    <b style={{ color: c.rest > 0 ? '#087f8c' : '#7b8a90' }}>{M(c.rest)}</b>
                  </td>
                  <td>
                    <div className="st-row">
                      <button type="button" className="secondary" onClick={() => setView({ kind: 'card', s })}>
                        📋 الملف
                      </button>
                      <button type="button" className="secondary" onClick={() => setView({ kind: 'move', s, m: 'advance' })}>
                        💸 سلفة
                      </button>
                      <button type="button" className="secondary" onClick={() => setView({ kind: 'move', s, m: 'bonus' })}>
                        🎉 / ➖
                      </button>
                      <button type="button" className="primary" onClick={() => setView({ kind: 'pay', s })}>
                        💵 قبّض
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty" style={{ marginTop: 12 }}>
          لسه مفيش موظفين. دوس «➕ موظف جديد» وضيف كل اللي شغالين معاك — ولو ليه حساب على السيستم اربطه بيه عشان يسجل حضوره بالـ QR من موبايله.
        </div>
      )}
      {gone.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer' }}>موظفين سابوا الشغل ({gone.length})</summary>
          {gone.map((s) => (
            <div key={s.id} style={{ margin: '6px 0' }}>
              {s.name}{' '}
              <button type="button" className="secondary" onClick={() => setView({ kind: 'edit', s })}>
                فتح
              </button>
            </div>
          ))}
        </details>
      )}

      {view?.kind === 'edit' && <EditStaff s={view.s} d={d} onClose={close} />}
      {view?.kind === 'card' && <StaffCard s={view.s} d={d} onClose={close} onEdit={() => setView({ kind: 'edit', s: view.s })} onManual={() => setView({ kind: 'manual', staffId: view.s.id })} />}
      {view?.kind === 'move' && <MoveModal s={view.s} kind={view.m} month={month} onClose={close} />}
      {view?.kind === 'pay' && <PayModal s={view.s} d={d} onClose={close} />}
      {view?.kind === 'manual' && <ManualModal d={d} staffId={view.staffId} onClose={close} />}
      {view?.kind === 'config' && <ConfigModal cfg={d.config ?? { absent: true, late: 0 }} onClose={close} />}
      {view?.kind === 'qr' && <QrScreen onClose={close} />}
      {view?.kind === 'points' && <PointsModal onClose={close} />}
    </>
  );
}

