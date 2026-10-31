'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CameraConfig, CameraStaffDay, SightingDto } from '@mk/shared';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { Modal } from '@/components/ui/modal';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import {
  getSighting,
  useCameraOverview,
  useDeleteCamAttendance,
  useDeleteSighting,
  useDismissSighting,
  useMarketDay,
  useNameSighting,
  useSaveCameraConfig,
} from '@/lib/camera-queries';
import { todayYmd } from '@/lib/format';
import { useManualAttendance } from '@/lib/phase4-queries';

const TZ = 'Africa/Cairo';
const hm = (t: string | null | undefined) => (t ? new Date(t).toLocaleTimeString('ar-EG', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }) : '—');
const hm24 = (t: string) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t));
const ago = (t: string | null) => {
  if (!t) return 'لسه ما حصلش';
  const m = Math.round((Date.now() - new Date(t).getTime()) / 60_000);
  return m < 1 ? 'من لحظات' : m < 60 ? `من ${m} دقيقة` : `من ${Math.round(m / 60)} ساعة`;
};
const PLACE = { shop: 'المحل', market: 'السوق', both: 'الاتنين' } as const;
const ROLE = { in: 'دخول', out: 'خروج', inside: 'جوه' } as const;

function SnapModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [s, setS] = useState<SightingDto | null>(null);
  useEffect(() => {
    getSighting(id).then(setS, () => setS(null));
  }, [id]);
  return (
    <Modal title="📷 اللقطة" onClose={onClose}>
      {s ? (
        <div style={{ textAlign: 'center' }}>
          {s.snapshot ? <img src={s.snapshot} alt="" style={{ maxWidth: '100%', borderRadius: 12 }} /> : <div className="empty">مفيش صورة</div>}
          <p>
            {hm(s.at)} — كاميرا {s.channel} — تطابق {Math.round(s.score * 100)}٪
          </p>
        </div>
      ) : (
        <Loading />
      )}
    </Modal>
  );
}

function Settings({ cfg, since, bridgeAt }: { cfg: CameraConfig; since: string | null; bridgeAt: string | null }) {
  const toast = useToast();
  const save = useSaveCameraConfig();
  const [f, setF] = useState(cfg);
  useEffect(() => setF(cfg), [cfg]);
  const days = since ? Math.floor((Date.now() - new Date(`${since}T00:00:00Z`).getTime()) / 86_400_000) : 0;
  const go = async (next: CameraConfig) => {
    try {
      await save.mutateAsync(next);
      toast('✔ اتحفظ');
    } catch (e) {
      toast(`ماتحفظش: ${errorMessage(e)}`, 'bad');
    }
  };
  const bridgeOk = bridgeAt && Date.now() - new Date(bridgeAt).getTime() < 3 * 60_000;
  return (
    <div className="cm-box" id="camSettings">
      <div className="cm-row">
        <label className="cm-sw">
          <input id="camOn" type="checkbox" checked={f.on} onChange={(e) => void go({ ...f, on: e.target.checked })} /> {f.on ? '🟢 الكاميرات شغالة' : '⚪ الكاميرات مقفولة'}
        </label>
        <span className={bridgeOk ? 'cm-ok' : 'cm-bad'}>{bridgeOk ? `✔ جسر الكاميرات متصل (${ago(bridgeAt)})` : `⚠️ جسر الكاميرات مش متصل${bridgeAt ? ` (آخر مرة ${ago(bridgeAt)})` : ''}`}</span>
      </div>
      <div className="cm-row">
        <label>الوضع:</label>
        <select id="camMode" value={f.mode} onChange={(e) => void go({ ...f, mode: e.target.value as CameraConfig['mode'] })}>
          <option value="suggest">💡 اقتراح — بيخزن اللي شافه ويقترح بس، من غير ما يسجل حضور ولا مرتبات</option>
          <option value="write">✍️ تسجيل — بيكتب الحضور والانصراف فعلاً (زي الـ QR)</option>
        </select>
      </div>
      {f.mode === 'suggest' && f.on && since && (
        <p className="cm-note">
          بدأنا الاقتراح من {since} (يوم {days + 1}). الأفضل تسيبه أسبوعين تتأكد إن الكاميرات بتعرفهم صح، وبعدها حوّله لـ «تسجيل».
        </p>
      )}
      <div className="cm-row">
        <label>درجة التطابق المطلوبة: <b>{Math.round(f.threshold * 100)}٪</b></label>
        <input id="camThr" type="range" min="40" max="90" value={Math.round(f.threshold * 100)} onChange={(e) => setF({ ...f, threshold: Number(e.target.value) / 100 })} onMouseUp={() => void go(f)} onTouchEnd={() => void go(f)} onKeyUp={() => void go(f)} />
        <small>أعلى = أدق بس يفوّت ناس أكتر. أقل = يعرف أكتر بس ممكن يغلط.</small>
      </div>
      <div className="cm-row">
        <label>نبّهني «لسه ما جاش» بعد الساعة</label>
        <input id="camAbs" type="time" value={f.absentAfter} onChange={(e) => setF({ ...f, absentAfter: e.target.value || '11:00' })} onBlur={() => void go(f)} />
      </div>
      <div className="cm-chs">
        {f.channels.map((c, i) => (
          <div key={c.n} className="cm-ch-set">
            <b>كاميرا {c.n}</b>
            <input value={c.label} placeholder="الاسم" onChange={(e) => setF({ ...f, channels: f.channels.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} onBlur={() => void go(f)} />
            <select value={c.role} onChange={(e) => void go({ ...f, channels: f.channels.map((x, j) => (j === i ? { ...x, role: e.target.value as typeof c.role } : x)) })}>
              {Object.entries(ROLE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <label>
              <input type="checkbox" checked={c.watch} onChange={(e) => void go({ ...f, channels: f.channels.map((x, j) => (j === i ? { ...x, watch: e.target.checked } : x)) })} /> تراقب
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

function StaffRow({ r, day, sightings, mode }: { r: CameraStaffDay; day: string; sightings: SightingDto[]; mode: CameraConfig['mode'] }) {
  const toast = useToast();
  const market = useMarketDay();
  const manual = useManualAttendance();
  const delAtt = useDeleteCamAttendance();
  const delSight = useDeleteSighting();
  const [snap, setSnap] = useState<string | null>(null);
  const s = r.suggestion;
  const today = day === todayYmd();
  const apply = async () => {
    if (!s.inAt) return;
    try {
      await manual.mutateAsync({ staffId: r.staffId, day, inTime: hm24(s.inAt), ...(s.outAt ? { outTime: hm24(s.outAt) } : {}), note: '📷 من اقتراح الكاميرا' });
      toast('✔ اتسجل');
    } catch (e) {
      toast(`ماتسجلش: ${errorMessage(e)}`, 'bad');
    }
  };
  const toggleMarket = async () => {
    try {
      await market.mutateAsync({ staffId: r.staffId, day, on: !r.market });
      toast(r.market ? 'اتشال من السوق' : '🛒 اتسجل في السوق النهارده');
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
  return (
    <tr className={r.notSeen ? 'cm-warn' : ''} data-staff={r.name}>
      <td>
        <b>{r.name}</b>
        <br />
        <small>
          {PLACE[r.place]} · انصراف بعد {r.gapHours} س · وشه: {r.facesReady}/{r.faces} صورة
        </small>
      </td>
      <td>
        {r.market && <span className="cm-tag">🛒 في السوق</span>}
        {r.notSeen && <span className="cm-tag cm-bad">⏰ لسه ما جاش</span>}
        {r.late && <span className="cm-tag cm-bad">متأخر</span>}
        {!r.market && !r.notSeen && !r.late && s.seen > 0 && <span className="cm-tag cm-ok">موجود</span>}
        {r.place !== 'shop' && !s.seen && !r.market && <span className="cm-tag">مش مطلوب يتشاف</span>}
      </td>
      <td>
        <div className="cm-chips">
          {sightings.map((x) => (
            <button type="button" key={x.id} className="cm-chip" title={`كاميرا ${x.channel}`} onClick={() => setSnap(x.id)}>
              {hm(x.at)}
            </button>
          ))}
          {!sightings.length && <small>—</small>}
        </div>
      </td>
      <td>
        {s.inAt ? (
          <>
            حضور <b>{hm(s.inAt)}</b>
            <br />
            {s.outAt ? (
              <>
                انصراف <b>{hm(s.outAt)}</b>
              </>
            ) : s.outPending && today ? (
              <small>لسه ممكن يتشاف</small>
            ) : null}
          </>
        ) : (
          '—'
        )}
      </td>
      <td>
        {r.attendance ? (
          <>
            {r.attendance.snapshot && <img className="cm-face" src={r.attendance.snapshot} alt="" />}
            {hm(r.attendance.inAt)} ← {hm(r.attendance.outAt)}
            <br />
            <small>{r.attendance.method === 'camera' ? '📷 كاميرا' : r.attendance.method === 'manual' ? '✍️ يدوي' : 'QR'}</small>{' '}
            <button type="button" className="secondary cm-x" onClick={() => confirm('تمسح سجل الحضور ده؟') && delAtt.mutate(r.attendance!.id)}>
              🗑️
            </button>
          </>
        ) : mode === 'suggest' && s.inAt ? (
          <button type="button" className="secondary cm-apply" onClick={apply} disabled={manual.isPending}>
            ✅ سجّل الاقتراح
          </button>
        ) : (
          '—'
        )}
      </td>
      <td>
        <button type="button" className="secondary cm-market" onClick={toggleMarket}>
          {r.market ? '↩️ مش في السوق' : '🛒 النهارده في السوق / بجيب بضاعة'}
        </button>
        {sightings.length > 0 && (
          <button type="button" className="secondary cm-x" title="مسح آخر لقطة غلط" onClick={() => confirm('تمسح آخر لقطة اتشافت (لو غلط)؟') && delSight.mutate(sightings[sightings.length - 1]!.id)}>
            ✖
          </button>
        )}
        {snap && <SnapModal id={snap} onClose={() => setSnap(null)} />}
      </td>
    </tr>
  );
}

function Unknown({ list, staff }: { list: SightingDto[]; staff: CameraStaffDay[] }) {
  const toast = useToast();
  const name = useNameSighting();
  const dismiss = useDismissSighting();
  const [pick, setPick] = useState<Record<string, string>>({});
  if (!list.length) return <div className="empty">مفيش وشوش مجهولة</div>;
  return (
    <div className="cm-unk" id="camUnknown">
      {list.map((u) => (
        <div key={u.id} className="cm-unk-card">
          {u.snapshot && <img src={u.snapshot} alt="" />}
          <small>
            {new Date(u.at).toLocaleString('ar-EG', { timeZone: TZ, day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit' })} — كاميرا {u.channel}
          </small>
          <select value={pick[u.id] ?? ''} onChange={(e) => setPick({ ...pick, [u.id]: e.target.value })}>
            <option value="">ده مين؟</option>
            {staff.map((s) => (
              <option key={s.staffId} value={s.staffId}>
                {s.name}
              </option>
            ))}
          </select>
          <div>
            <button
              type="button"
              className="primary"
              disabled={!pick[u.id]}
              onClick={async () => {
                try {
                  await name.mutateAsync({ id: u.id, staffId: pick[u.id]! });
                  toast('✔ اتسمّى وصورته اتضافت');
                } catch (e) {
                  toast(errorMessage(e), 'bad');
                }
              }}
            >
              ده هو
            </button>{' '}
            <button type="button" className="secondary" onClick={() => dismiss.mutate(u.id)}>
              مش مهم
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CameraScreen() {
  const [day, setDay] = useState(todayYmd());
  const q = useCameraOverview(day);
  const [big, setBig] = useState<string | null>(null);
  const o = q.data;
  const by = useMemo(() => {
    const m = new Map<string, SightingDto[]>();
    for (const s of o?.sightings ?? []) m.set(s.staffId!, [...(m.get(s.staffId!) ?? []), s]);
    return m;
  }, [o]);

  if (q.isPending) return <Loading />;
  if (q.isError || !o) return <ErrorBox message={`ماقدرتش أجيب بيانات الكاميرات: ${errorMessage(q.error)}`} onRetry={() => q.refetch()} />;

  return (
    <>
      <PageHeader title="📷 الكاميرات" subtitle="مين اتشاف الساعة كام، واقتراح الحضور والانصراف من الوش" />
      <Settings cfg={o.config} since={o.since} bridgeAt={o.bridgeAt} />

      <h3 className="cm-h">الكاميرات دلوقتي</h3>
      <div className="cm-cams" id="camChannels">
        {o.channels.map((c) => (
          <div key={c.n} className="cm-cam">
            {c.snapshot ? (
              <img src={c.snapshot} alt="" onClick={() => setBig(c.snapshot)} />
            ) : (
              <div className="cm-noimg">{c.watch ? 'مفيش لقطة لسه' : 'مش بتراقب'}</div>
            )}
            <b>
              {c.n} — {c.label || '—'} ({ROLE[c.role]})
            </b>
            <small>آخر صورة {ago(c.lastSnapAt)}</small>
            <small>آخر وش {ago(c.lastSeenAt)}</small>
            {c.note && <small className="cm-bad">⚠️ {c.note}</small>}
          </div>
        ))}
        {!o.channels.length && <div className="empty">مفيش كاميرات متظبطة</div>}
      </div>
      {big && (
        <Modal title="📷 اللقطة" onClose={() => setBig(null)} wide>
          <img src={big} alt="" style={{ width: '100%', borderRadius: 12 }} />
        </Modal>
      )}

      <h3 className="cm-h">
        مين اتشاف —{' '}
        <input id="camDay" type="date" value={day} onChange={(e) => setDay(e.target.value || todayYmd())} />
      </h3>
      <div className="table-wrap">
        <table className="cm-table" id="camStaff">
          <thead>
            <tr>
              <th>العامل</th>
              <th>الحالة</th>
              <th>اتشاف الساعة</th>
              <th>اقتراح الكاميرا</th>
              <th>الحضور المسجّل</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {o.staff.map((r) => (
              <StaffRow key={r.staffId + day} r={r} day={day} sightings={by.get(r.staffId) ?? []} mode={o.config.mode} />
            ))}
            {!o.staff.length && (
              <tr>
                <td colSpan={6} className="empty">
                  مفيش عمال لسه — ضيفهم من «العمالة والمرتبات»
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="cm-h">وشوش مجهولة (سمّيها لو تعرفها)</h3>
      <Unknown list={o.unknown} staff={o.staff} />
    </>
  );
}

export default function CameraPage() {
  return (
    <AdminOnly>
      <CameraScreen />
    </AdminOnly>
  );
}
