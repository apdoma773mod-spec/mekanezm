'use client';
// All popups (bottom sheets). Wording and checks follow the old site's final version.
import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { addNotifyMe, addReview, placeOrder, placeRequest, trackCustom, trackOrder, uploadRequestImage, type TrackedCustom, type TrackedOrder } from '@/lib/api';
import type { Ship, ShipMethod } from '@/lib/schema';
import { deliveryFee, GOVS, orderMsg, shipBits, shipLine, waUrl } from '@/lib/shop';
import { ev } from '@/lib/track';
import { shrinkImage } from '@/lib/images';
import { useShop } from './shop-provider';

function Sheet({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    const o = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', k); document.body.style.overflow = o; };
  }, [onClose]);
  return (
    <div className="mb" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mc" role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>
  );
}

const digits = (s: string) => s.replace(/\D/g, '').length;
const LK = 'mk_last_order';
const saveLast = (ref: string, phone: string) => { try { localStorage.setItem(LK, JSON.stringify({ ref, phone })); } catch { /* */ } };

export function Modals() {
  const { modal, close } = useShop();
  if (!modal) return null;
  switch (modal.kind) {
    case 'cart': return <CartSheet />;
    case 'ship': return <ShipInfo />;
    case 'req': return <RequestSheet />;
    case 'track': return <TrackSheet ref0={modal.ref} phone0={modal.phone} />;
    case 'review': return <ReviewSheet />;
    case 'notify': return <NotifySheet id={modal.id} />;
    case 'work': return <WorkView i={modal.i} />;
    case 'image': return <Lightbox src={modal.src} onClose={close} />;
  }
}

/* ---------------- 🛒 cart + send order ---------------- */
const SHK = 'mk_ship_pref';
function CartSheet() {
  const { site, cart, setQty, product, ok, close, clearCart, refreshStock, open } = useShop();
  const items = Object.keys(cart).map(id => product(id)).filter(p => !!p);
  const anyBack = items.some(p => !ok(p));
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [ship, setShip] = useState<Ship>({ method: 'pickup', gov: '', area: '', address: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ref: string; ship: Ship; lines: string[]; back: boolean; name: string; phone: string } | null>(null);

  useEffect(() => {
    try { const p = JSON.parse(localStorage.getItem(SHK) || '{}'); if (p && p.method) setShip(s => ({ ...s, ...p })); } catch { /* */ }
  }, []);
  const upd = (o: Partial<Ship>) => setShip(s => {
    const n = { ...s, ...o };
    if (n.method === 'delivery' && !['القاهرة', 'الجيزة'].includes(n.gov)) n.gov = 'الجيزة';
    try { localStorage.setItem(SHK, JSON.stringify(n)); } catch { /* */ }
    return n;
  });

  async function send() {
    if (!items.length) return;
    if (name.trim().length < 2) return setMsg('اكتب اسمك الأول');
    const sh: Ship = ship.method === 'pickup' ? { method: 'pickup', gov: '', area: '', address: '' } : { ...ship, area: ship.area.trim(), address: ship.address.trim() };
    if (sh.method !== 'pickup') {
      if (digits(phone) < 8) return setMsg('اكتب رقم موبايلك عشان المندوب أو شركة الشحن يكلمك');
      if (!sh.gov) return setMsg('اختار المحافظة');
      if (sh.address.length < 5) return setMsg('اكتب العنوان بالتفصيل');
    }
    const lines: string[] = [];
    const body: { code: string; qty: number }[] = [];
    for (const p of items) {
      if (!p.code) return setMsg('المنتج ده مش متاح للطلب من الموقع، كلمنا على الواتساب');
      body.push({ code: p.code, qty: cart[p.id] });
      lines.push(`• كود:${p.code} | ${(p.name + (p.desc ? ` (${p.desc})` : '')).replace(/\|/g, '/')} | × ${cart[p.id]}`);
    }
    lines.push('', shipLine(sh));
    if (sh.address) lines.push('📍 ' + sh.address);
    setBusy(true);
    setMsg('جاري إرسال الطلب…');
    try {
      const r = await placeOrder(name.trim(), phone.trim(), body, sh);
      if (r.ok && typeof r.data === 'string') {
        const ref = r.data.slice(0, 8);
        if (phone.trim()) saveLast(ref, phone.trim());
        setDone({ ref: r.data, ship: sh, lines, back: anyBack, name: name.trim(), phone: phone.trim() });
        clearCart();
        ev('generate_lead', 'Lead');
        setTimeout(refreshStock, 800);
        return;
      }
      const em = r.message;
      setMsg(em === 'invalid_name' ? 'الاسم مش صحيح' : em === 'invalid_phone' || em === 'need_phone' ? 'رقم الموبايل مش صحيح' : em === 'invalid_ship' ? 'العنوان طويل أوي — اختصره شوية' : em === 'too_many_requests' ? 'في ضغط دلوقتي، جرّب بعد شوية أو كلمنا على الواتساب' : 'تعذر تسجيل الطلب دلوقتي. تقدر تبعته على الواتساب.');
    } catch {
      setMsg('مفيش اتصال بالإنترنت، جرّب تاني');
    }
    setBusy(false);
  }

  if (done) {
    const ref = done.ref.slice(0, 8);
    return (
      <Sheet onClose={close} label="تم تسجيل طلبك">
        <h3>تم تسجيل طلبك ✔</h3>
        {done.back && <p className="warn">📦 طلبك فيه أصناف بالحجز — هنكلمك على الواتساب ونقولك ميعاد الاستلام.</p>}
        <p>رقم طلبك: <b dir="ltr">{ref}</b></p>
        <p>{shipLine(done.ship)}</p>
        <p>هنتواصل معاك لتأكيد الطلب والسعر{done.ship.method === 'pickup' ? '' : ' ومصاريف ' + (done.ship.method === 'ship' ? 'الشحن' : 'التوصيل')}. تقدر كمان تبعتلنا نسخة على الواتساب.</p>
        <button className="sec" onClick={() => open({ kind: 'track', ref, phone: done.phone })}>📦 تابع طلبك وصل لفين</button>
        <div className="row">
          <a className="btn-g" target="_blank" rel="noopener" href={waUrl(site, orderMsg(done.ref, done.name, done.phone, done.lines))}>📲 ابعت على الواتساب</a>
          <button className="sec" onClick={close}>إغلاق</button>
        </div>
      </Sheet>
    );
  }

  const L = site.shipLocal ?? {}, G = site.shipGov ?? {};
  const govs = ship.method === 'delivery' ? ['القاهرة', 'الجيزة'] : GOVS;
  return (
    <Sheet onClose={close} label="طلبي">
      <h3>طلبي</h3>
      {items.length ? items.map(p => (
        <div className="citem" key={p.id}>
          <span>{p.name}{!ok(p) && <b className="bo"> 📦 حجز — مش متوفر دلوقتي</b>}{p.desc && <small>{p.desc.slice(0, 80)}</small>}</span>
          <span className="qty">
            <button onClick={() => setQty(p.id, cart[p.id] - 1)} aria-label="نقص">−</button>
            <b>{cart[p.id]}</b>
            <button onClick={() => setQty(p.id, cart[p.id] + 1)} aria-label="زيادة">+</button>
          </span>
        </div>
      )) : <p>الطلب فاضي</p>}
      {items.length > 0 && <>
        <label>اسمك<input value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" name="name" /></label>
        <label>{ship.method === 'pickup' ? 'رقم موبايلك (اختياري)' : 'رقم موبايلك (مطلوب عشان المندوب يكلمك)'}
          <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" maxLength={20} autoComplete="tel" name="tel" /></label>
        <div>
          <b>🚚 هتستلم إزاي؟</b>
          <div className="shopt">
            {([['pickup', '🏪 هاستلم من المحل', ''], ['delivery', '🛵 توصيل داخل القاهرة والجيزة', shipBits(L)], ['ship', '📦 شحن لمحافظة تانية', shipBits(G)]] as [ShipMethod, string, string][]).map(([v, t, s]) => (
              <label key={v}><input type="radio" name="shm" checked={ship.method === v} onChange={() => upd({ method: v })} /><span>{t}{s && <small>{s}</small>}</span></label>
            ))}
          </div>
          {ship.method !== 'pickup' && <>
            <label>المحافظة<select value={ship.gov} onChange={e => upd({ gov: e.target.value })}><option value="">— اختار المحافظة —</option>{govs.map(g => <option key={g}>{g}</option>)}</select></label>
            <label>المنطقة / المدينة<input value={ship.area} onChange={e => upd({ area: e.target.value })} maxLength={80} /></label>
            <label>العنوان بالتفصيل<textarea value={ship.address} onChange={e => upd({ address: e.target.value })} rows={2} maxLength={300} autoComplete="street-address" /></label>
          </>}
        </div>
      </>}
      <p className={msg ? 'err' : 'mut'} aria-live="polite">{msg || (anyBack ? <span className="warn">في أصناف مش متوفرة دلوقتي — اطلبها عادي وهنكلمك نقولك ميعاد وصولها.</span> : '')}</p>
      {items.length > 0 && (
        <a className="btn-g" target="_blank" rel="noopener" href={waUrl(site, 'السلام عليكم، عايز أطلب:\n' + items.map(p => `• ${p.name}${p.code ? ` (كود ${p.code})` : ''} × ${cart[p.id]}`).join('\n') + (name.trim() ? '\nالاسم: ' + name.trim() : ''))}>💬 ابعت الطلب كله واتساب</a>
      )}
      <div className="row">
        {items.length > 0 && <button className="pri" onClick={send} disabled={busy}>إرسال الطلب</button>}
        <button className="sec" onClick={close}>إغلاق</button>
      </div>
    </Sheet>
  );
}

/* ---------------- 🚚 delivery info ---------------- */
function ShipInfo() {
  const { site, close } = useShop();
  const L = site.shipLocal ?? {}, G = site.shipGov ?? {};
  const D = site.delivery.filter(x => x.area);
  return (
    <Sheet onClose={close} label="الشحن والتوصيل">
      <h3>🚚 الشحن والتوصيل</h3>
      <div className="shinfo">
        <div><b>🛵 توصيل داخل القاهرة والجيزة</b><br />{L.note || 'مندوب بيوصّلك الطلب لحد باب البيت'}{shipBits(L) && <><br />{shipBits(L)}</>}</div>
        <div><b>📦 شحن لأي محافظة</b><br />{G.note || 'بنشحن لكل محافظات مصر مع شركات الشحن'}{shipBits(G) && <><br />{shipBits(G)}</>}</div>
        <div><b>🏪 استلام من المحل</b><br />{site.address || 'تقدر تيجي تستلم طلبك من المحل'}{site.hours && <><br />🕒 {site.hours}</>}</div>
      </div>
      {D.length > 0 && <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>{D.map((x, i) => (
        <tr key={i}><td><b>{x.area}</b></td><td>{deliveryFee(x.fee)}</td><td className="mut">{x.days}</td></tr>
      ))}</tbody></table>}
      <p className="mut">اختار طريقة الاستلام وانت بتبعت الطلب 👌</p>
      <div className="row">
        <a className="btn-g" target="_blank" rel="noopener" href={waUrl(site, 'السلام عليكم، عايز أسأل عن الشحن/التوصيل')}>💬 اسأل على الواتساب</a>
        <button className="sec" onClick={close}>تمام</button>
      </div>
    </Sheet>
  );
}

/* ---------------- 📷 request a product we don't list ---------------- */
export function HowToRequest() {
  return (
    <div className="rqv" aria-hidden="true">
      <h3>إزاي تطلب منتج مش موجود؟ 3 خطوات بس</h3>
      <div className="rqs">
        <div><i>📷</i><b>١) صوّره</b>صوّر المنتج أو اختار صورة من موبايلك</div>
        <div><i>📤</i><b>٢) ابعته</b>اكتب اسمك ورقمك واضغط إرسال</div>
        <div><i>💬</i><b>٣) هنرد عليك</b>على الواتساب نقولك متوفر ولا لأ وبكام</div>
      </div>
      <div className="rqbar" />
    </div>
  );
}

function RequestSheet() {
  const { site, close } = useShop();
  const [pics, setPics] = useState<{ blob: Blob; url: string }[]>([]);
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function pick(fs: FileList | null) {
    const list = [...(fs ?? [])].slice(0, 3 - pics.length);
    setMsg('⏳ بنجهّز الصور…');
    const out: { blob: Blob; url: string }[] = [];
    for (const f of list) { try { const b = await shrinkImage(f, 1200); out.push({ blob: b, url: URL.createObjectURL(b) }); } catch { /* skip */ } }
    setPics(p => [...p, ...out]);
    setMsg('');
  }
  async function send() {
    if (name.trim().length < 2) return setMsg('اكتب اسمك');
    if (digits(phone) < 8) return setMsg('اكتب رقم موبايلك عشان نرد عليك');
    if (!pics.length && note.trim().length < 3) return setMsg('ابعت صورة أو اكتب وصف للمنتج');
    setBusy(true);
    try {
      const urls: string[] = [];
      for (let i = 0; i < pics.length; i++) { setMsg(`⏳ جاري رفع الصورة ${i + 1} من ${pics.length}…`); urls.push(await uploadRequestImage(pics[i].blob)); }
      setMsg('⏳ جاري الإرسال…');
      const r = await placeRequest(name.trim(), phone.trim(), note.trim(), urls);
      if (!r.ok || typeof r.data !== 'string') {
        setMsg(r.message === 'invalid_phone' ? 'رقم الموبايل مش صحيح' : r.message === 'too_many_requests' ? 'في ضغط دلوقتي، جرّب بعد شوية' : 'ماتبعتش — جرّب تاني أو كلمنا على الواتساب');
        setBusy(false);
        return;
      }
      setSent(true);
    } catch {
      setMsg('مفيش اتصال أو الصورة كبيرة — جرّب تاني');
      setBusy(false);
    }
  }

  if (sent) return (
    <Sheet onClose={close} label="وصلنا طلبك">
      <h3>وصلنا طلبك ✔</h3>
      <p>هنشوف المنتج ونرد عليك على الواتساب على رقم <b dir="ltr">{phone}</b> قريب.</p>
      <div className="row">
        <a className="btn-g" target="_blank" rel="noopener" href={waUrl(site, `السلام عليكم، بعتلكم صورة منتج من الموقع باسم ${name} — عايز أعرف تقدروا توفّروه؟`)}>💬 كلّمنا على الواتساب كمان</a>
        <button className="sec" onClick={close}>إغلاق</button>
      </div>
    </Sheet>
  );
  return (
    <Sheet onClose={close} label="مش لاقي اللي بتدوّر عليه؟">
      <h3>📷 مش لاقي اللي بتدوّر عليه؟</h3>
      <HowToRequest />
      <p className="mut">صوّر المنتج أو ابعت صورته (لحد 3 صور)، وإحنا هنرد عليك على الواتساب ونقولك نقدر نوفّره ولا لأ وإمتى.</p>
      <div className="thumbs">{pics.map((x, i) => (
        <div key={x.url}><img src={x.url} alt="" /><button type="button" onClick={() => setPics(p => p.filter((_, k) => k !== i))} aria-label="شيل الصورة">✕</button></div>
      ))}</div>
      {pics.length < 3 && <button type="button" className="btn-g" onClick={() => file.current?.click()}>📷 صوّر أو اختار صورة</button>}
      <input ref={file} type="file" accept="image/*" multiple hidden onChange={e => { pick(e.target.files); e.target.value = ''; }} />
      <label>وصف (اختياري — المقاس، الماركة، الاستخدام…)<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} rows={3} /></label>
      <label>اسمك<input value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" /></label>
      <label>رقم موبايلك (واتساب)<input value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" maxLength={20} placeholder="01xxxxxxxxx" autoComplete="tel" /></label>
      <p className="mut" aria-live="polite">{msg}</p>
      <div className="row"><button className="pri" onClick={send} disabled={busy}>إرسال</button><button className="sec" onClick={close}>إغلاق</button></div>
    </Sheet>
  );
}

/* ---------------- 📦 order tracking ---------------- */
const fmt = (t?: string) => (t ? new Date(t).toLocaleString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
type Step = { t: string; d?: string; on: boolean; bad?: boolean; at?: string };
function steps(o: TrackedOrder): Step[] {
  const s = o.shipment, m = o.method, L: Step[] = [];
  L.push({ t: 'استلمنا طلبك', d: fmt(o.created_at), on: true });
  if (o.status === 'cancelled') { L.push({ t: '❌ الطلب اتلغى', d: 'كلمنا على الواتساب لو محتاج أي حاجة', on: true, bad: true }); return L; }
  L.push({ t: o.eta ? 'اتأكد ✔' : 'بنراجع طلبك', d: o.eta ? 'الميعاد: ' + o.eta : 'هنكلمك على الواتساب نأكد معاك', on: !!(o.eta || o.invoiced) });
  L.push({ t: 'اتجهّز', d: o.invoiced ? 'طلبك جاهز' : '', on: !!o.invoiced });
  if (m === 'pickup' && !s) { L.push({ t: 'جاهز للاستلام من المحل', d: o.invoiced ? 'تقدر تيجي تستلمه' : '', on: !!o.invoiced }); return L; }
  const st = s?.status ?? '', lg = Array.isArray(s?.log) ? s.log : [];
  const at = (k: string) => { const x = lg.filter(e => e.s === k).slice(-1)[0]; return x ? fmt(x.at) : ''; };
  const i = ['new', 'printed', 'handed', 'out', 'delivered', 'paid'].indexOf(st);
  if ((s ? s.kind : m) === 'ship') {
    L.push({ t: 'اتسلّم لشركة الشحن', d: s?.carrier ? s.carrier + (s.tracking ? ' — رقم البوليصة: ' + s.tracking : '') : '', on: i >= 2, at: at('handed') });
    L.push({ t: 'في الطريق ليك 🚚', d: o.gov ? 'لـ ' + o.gov : '', on: i >= 3, at: at('out') });
  } else L.push({ t: 'خرج مع المندوب 🛵', d: s?.carrier ?? '', on: i >= 3, at: at('out') });
  if (st === 'returned') L.push({ t: '↩️ الطلب رجع', d: 'كلمنا على الواتساب', on: true, bad: true });
  else L.push({ t: 'وصلك ✅', d: '', on: i >= 4, at: at('delivered') });
  return L;
}
function Steps({ L }: { L: Step[] }) {
  const cur = L.map(x => x.on).lastIndexOf(true);
  return <div className="trk">{L.map((x, i) => (
    <div key={i} className={'st' + (x.on ? ' on' : '') + (i === cur ? ' now' : '')}>
      <div className="dot">{x.bad ? '!' : x.on ? '✓' : i + 1}</div>
      <div><b>{x.t}</b>{(x.d || x.at) && <small>{[x.d, x.at].filter(Boolean).join(' • ')}</small>}</div>
    </div>
  ))}</div>;
}
const CKIND: Record<string, string> = { steel: '🔩 استانلس حماية الباب', bamboo: '🎍 درج بامبو', delf: '🚪 دلف الدريسنج روم' };
const CDEF = ['وصلنا طلبك', 'بنراجع المقاسات معاك', 'بنجهّز الشغل', 'جاهز للاستلام', 'اتسلّم ✅'];
function CustomCard({ o }: { o: TrackedCustom }) {
  const st = o.stages?.length ? o.stages : CDEF;
  let i = o.stage_idx != null ? o.stage_idx : o.status === 'done' ? st.length - 1 : o.status === 'opened' ? 1 : 0;
  i = Math.max(0, Math.min(st.length - 1, i));
  return (
    <div className="trkcard">
      <div className="row" style={{ justifyContent: 'space-between' }}><b>تجهيز رقم {o.ref}</b><small className="mut" style={{ flex: 'none' }}>{CKIND[o.kind ?? ''] ?? 'تجهيز'}</small></div>
      <div className="mut" style={{ fontSize: 13, whiteSpace: 'pre-line' }}>{o.summary}</div>
      {o.img && <img style={{ width: '100%', borderRadius: 12, margin: '6px 0', border: '1px solid var(--line)' }} loading="lazy" src={o.img} alt="" />}
      {o.eta && <div><b>ميعاد التسليم المتوقع:</b> {o.eta}</div>}
      {o.status === 'cancelled'
        ? <Steps L={[{ t: 'الطلب اتلغى', d: 'كلمنا على الواتساب', on: true, bad: true }]} />
        : <Steps L={st.map((t, k) => ({ t, on: k <= i }))} />}
    </div>
  );
}
function TrackSheet({ ref0, phone0 }: { ref0?: string; phone0?: string }) {
  const { site, close } = useShop();
  const [ref, setRef] = useState(ref0 ?? '');
  const [phone, setPhone] = useState(phone0 ?? '');
  const [msg, setMsg] = useState<ReactNode>('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ L: TrackedOrder[]; C: TrackedCustom[] } | null>(null);

  async function go(r = ref, p = phone) {
    if (digits(p) < 8) return setMsg('اكتب رقم الموبايل');
    setBusy(true); setRes(null); setMsg('⏳ بندوّر على طلبك…');
    try {
      const [L, C] = await Promise.all([trackOrder(r.trim(), p.trim()), trackCustom(r.trim(), p.trim())]);
      if (!L.length && !C.length) setMsg(<>مالقيناش طلب بالبيانات دي. اتأكد من الرقم، أو <a target="_blank" rel="noopener" href={waUrl(site, 'السلام عليكم، عايز أعرف طلبي وصل لفين')}>كلمنا على الواتساب</a>.</>);
      else { setMsg(''); setRes({ L, C }); saveLast(r.trim() || (L[0] ?? C[0]).ref, p.trim()); }
    } catch (e) {
      const m = String((e as Error).message);
      setMsg(/bad_phone/.test(m) ? 'رقم الموبايل مش صحيح' : /bad_ref/.test(m) ? 'رقم الطلب قصير — اكتبه كله أو سيبه فاضي' : 'مفيش اتصال — جرّب تاني');
    }
    setBusy(false);
  }
  useEffect(() => {
    let r = ref0 ?? '', p = phone0 ?? '';
    if (!p) { try { const l = JSON.parse(localStorage.getItem(LK) || 'null'); if (l) { r = r || l.ref || ''; p = l.phone || ''; } } catch { /* */ } }
    setRef(r); setPhone(p);
    if (digits(p) >= 8) go(r, p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const first = res && (res.L[0] ?? res.C[0]);
  return (
    <Sheet onClose={close} label="تتبّع طلبك">
      <h3>📦 تتبّع طلبك</h3>
      <p className="mut">اكتب رقم الموبايل اللي طلبت بيه — ورقم الطلب لو معاك.</p>
      <label>رقم الموبايل<input value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" maxLength={20} placeholder="01xxxxxxxxx" autoComplete="tel" /></label>
      <label>رقم الطلب (اختياري)<input value={ref} onChange={e => setRef(e.target.value)} maxLength={12} dir="ltr" placeholder="مثلاً 3f9a12bc" /></label>
      <p className="mut" aria-live="polite">{msg}</p>
      {res && <div>
        {res.C.map(o => <CustomCard key={'c' + o.ref} o={o} />)}
        {res.L.map(o => (
          <div className="trkcard" key={o.ref}>
            <div className="row" style={{ justifyContent: 'space-between' }}><b>طلب رقم {o.ref}</b><small className="mut" style={{ flex: 'none' }}>{o.method === 'ship' ? '📦 شحن' : o.method === 'delivery' ? '🛵 توصيل' : '🏪 استلام من المحل'}</small></div>
            <div className="mut" style={{ fontSize: 13 }}>{(o.items ?? []).map(x => `${x.name} × ${x.qty}`).join('، ')}</div>
            <Steps L={steps(o)} />
          </div>
        ))}
        {first && <a className="btn-g" target="_blank" rel="noopener" href={waUrl(site, 'السلام عليكم، بخصوص طلبي رقم ' + first.ref)}>💬 اسألنا على الواتساب</a>}
      </div>}
      <div className="row"><button className="pri" onClick={() => go()} disabled={busy}>🔍 شوف طلبي</button><button className="sec" onClick={close}>إغلاق</button></div>
    </Sheet>
  );
}

/* ---------------- ⭐ review ---------------- */
function ReviewSheet() {
  const { close } = useShop();
  const [r, setR] = useState(5);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState('رأيك هيظهر بعد ما نراجعه.');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function go() {
    if (name.trim().length < 2) return setMsg('اكتب اسمك');
    setBusy(true); setMsg('⏳ جاري الإرسال…');
    try { const x = await addReview(name.trim(), r, body.trim()); if (!x.ok) throw 0; setSent(true); } catch { setMsg('ماتبعتش — جرّب تاني'); setBusy(false); }
  }
  if (sent) return <Sheet onClose={close} label="شكراً"><h3>شكراً ليك ♥</h3><p>وصلنا رأيك وهيظهر بعد المراجعة.</p><div className="row"><button className="sec" onClick={close}>إغلاق</button></div></Sheet>;
  return (
    <Sheet onClose={close} label="اكتب رأيك">
      <h3>✍️ اكتب رأيك</h3>
      <div className="stars">{[1, 2, 3, 4, 5].map(i => <button type="button" key={i} className={i <= r ? 'on' : ''} onClick={() => setR(i)} aria-label={`${i} نجوم`}>★</button>)}</div>
      <label>اسمك<input value={name} onChange={e => setName(e.target.value)} maxLength={60} autoComplete="name" /></label>
      <label>رأيك (اختياري)<textarea value={body} onChange={e => setBody(e.target.value)} rows={3} maxLength={600} /></label>
      <p className="mut">{msg}</p>
      <div className="row"><button className="pri" onClick={go} disabled={busy}>إرسال</button><button className="sec" onClick={close}>إغلاق</button></div>
    </Sheet>
  );
}

/* ---------------- 🔔 notify me when back ---------------- */
function NotifySheet({ id }: { id: string }) {
  const { product, close } = useShop();
  const p = product(id);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  if (!p) return null;
  async function go() {
    if (digits(phone) < 8) return setMsg('اكتب رقم موبايلك');
    setBusy(true); setMsg('⏳…');
    try { const r = await addNotifyMe(id, p!.name, name.trim(), phone.trim()); if (!r.ok) throw 0; setSent(true); } catch { setMsg('ماتبعتش — جرّب تاني'); setBusy(false); }
  }
  if (sent) return <Sheet onClose={close} label="تمام"><h3>تمام ✔</h3><p>هنكلمك أول ما المنتج يتوفر.</p><div className="row"><button className="sec" onClick={close}>إغلاق</button></div></Sheet>;
  return (
    <Sheet onClose={close} label="نبّهني لما يتوفر">
      <h3>🔔 نبّهني لما يتوفر</h3>
      <p className="mut">{p.name}</p>
      <p className="mut">سيب رقمك وهنكلمك على الواتساب أول ما يتوفر.</p>
      <label>اسمك (اختياري)<input value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" /></label>
      <label>رقم موبايلك<input value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" maxLength={20} placeholder="01xxxxxxxxx" autoComplete="tel" /></label>
      <p className="mut">{msg}</p>
      <div className="row"><button className="pri" onClick={go} disabled={busy}>تمام</button><button className="sec" onClick={close}>إغلاق</button></div>
    </Sheet>
  );
}

/* ---------------- 🏗️ our work photos ---------------- */
function WorkView({ i }: { i: number }) {
  const { site, close } = useShop();
  const w = site.works.filter(x => x.imgs.length)[i];
  if (!w) return null;
  return (
    <Sheet onClose={close} label={w.title}>
      <h3>{w.title}</h3>
      {w.imgs.map(u => <div key={u} style={{ position: 'relative', aspectRatio: '4/3' }}><Image src={u} alt="" fill sizes="520px" style={{ objectFit: 'cover', borderRadius: 12 }} /></div>)}
      {w.desc && <p style={{ whiteSpace: 'pre-line' }}>{w.desc}</p>}
      <button className="sec" onClick={close}>إغلاق</button>
    </Sheet>
  );
}

/* ---------------- 🔍 zoom a photo ---------------- */
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [z, setZ] = useState(false);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className={'lb' + (z ? ' z' : '')} role="dialog" aria-label="تكبير الصورة">
      <button onClick={onClose} aria-label="إغلاق">✕</button>
      <img src={src} alt="" onClick={() => setZ(v => !v)} />
    </div>
  );
}
