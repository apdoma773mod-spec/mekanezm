'use client';

import { useRef, useState } from 'react';
import type { ProductDto } from '@mk/shared';
import { api, errorMessage } from '@/lib/api';
import { money, qtyText } from '@/lib/format';
import {
  useAllContacts,
  useInfoGroups,
  useMakeVariant,
  useProduct,
  useProductCard,
  useProductInfo,
  useSaveProductInfo,
  useSiblings,
  type ProductInfo,
  type ProductPack,
} from '@/lib/trade-queries';
import { useSettings } from '@/lib/queries';
import { Modal } from '../ui/modal';
import { ErrorBox, Loading } from '../ui/states';
import { useToast } from '../ui/toast';
import { useIsAdmin } from '../use-role';
import { useModal } from './modal-host';
import { ExtraButtons } from './product-modal';

export type ProductCardSpec = { kind: 'productEdit'; id: string } | { kind: 'productDetails'; id: string } | { kind: 'productSend'; id: string } | { kind: 'productVariant'; id: string };

const abs = (u: string) => (u.startsWith('http') ? u : `${location.origin}${u}`);
const kv = (l: string, v: React.ReactNode) => (v || v === 0 ? <div><small>{l}</small>{v}</div> : null);

// ---------- 🏷️ شاشة المنتج ----------

export function ProductCard({ id }: { id: string }) {
  const { open, close } = useModal();
  const own = useIsAdmin();
  const prod = useProduct(id);
  const info = useProductInfo(id);
  const sibs = useSiblings(id);
  const stats = useProductCard(id, own);
  const [idx, setIdx] = useState(0);

  if (prod.isPending || info.isPending)
    return (
      <Modal title="⏳ بفتح المنتج…" onClose={close}>
        <Loading />
      </Modal>
    );
  if (prod.isError)
    return (
      <Modal title="المنتج" onClose={close}>
        <ErrorBox message={errorMessage(prod.error)} onRetry={() => prod.refetch()} />
      </Modal>
    );
  const p = prod.data;
  const inf = info.data ?? ({ brand: '', finish: '', size: '', specs: '', loc: '', grp: '', descr: '', packs: [], imgs: [] } as ProductInfo);
  const cost = p.cost ?? 0;
  const st = p.qty <= 0 ? <span className="badge red">نفد</span> : p.qty <= p.minQty ? <span className="badge red">قرب يخلص</span> : <span className="badge green">متوفر</span>;
  const S = sibs.data?.items ?? [];
  const sd = stats.data;

  return (
    <Modal title={<><span className="pico">📦</span> {p.name}</>} onClose={close} wide>
      <div id="pcv">
        <div className="pc-gal">
          {inf.imgs.length ? (
            <>
              <img className="pc-main" id="pcMain" src={inf.imgs[idx] ?? inf.imgs[0]} alt="" />
              {inf.imgs.length > 1 && (
                <div className="pc-th">
                  {inf.imgs.map((u, i) => (
                    <img key={u} src={u} alt="" className={i === idx ? 'on' : ''} onClick={() => setIdx(i)} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="pc-noimg">
              مفيش صور للمنتج ده لسه
              {own && (
                <>
                  <br />
                  دوس «تفاصيل وصور» وارفع صوره، وهتتحط في الفريم بالكود لوحدها
                </>
              )}
            </div>
          )}
        </div>
        <div className="pc-card">
          <h3>
            🏷️ كارت المنتج <small style={{ color: '#7b8a90', fontWeight: 400 }}>(ده اللي بيتبعت للعميل)</small>
          </h3>
          <div className="pc-kv">
            {kv('الكود', <b>{p.code || '—'}</b>)}
            {kv('التصنيف', p.category)}
            {kv('الماركة', inf.brand)}
            {kv('التشطيب / اللون', inf.finish)}
            {kv('المقاس', inf.size)}
            {kv('الوحدة', p.unit)}
            {kv('الحالة', st)}
          </div>
          {inf.descr && (
            <p className="pc-specs" style={{ marginTop: 10 }}>
              {inf.descr}
            </p>
          )}
          {inf.specs && <p className="pc-specs">{inf.specs}</p>}
        </div>
        {own ? (
          <div className="pc-card pc-own">
            <h3>
              🔒 بيانات المنتج <small style={{ color: '#7b8a90', fontWeight: 400 }}>(ليك انت بس)</small>
            </h3>
            <div className="pc-kv">
              {kv('سعر البيع', <b>{money(p.price)}</b>)}
              {kv('سعر الشراء', cost ? <>{money(cost)}{p.costEst ? <> <span className="badge red" title="تقدير لأن سعر الشراء الحقيقي مش معروف">تقديري</span></> : null}</> : <span className="badge red">مش معروف</span>)}
              {kv('هامش الربح', p.price ? `${Math.round(((p.price - cost) / p.price) * 100)}%` : '—')}
              {kv('الرصيد', `${qtyText(p.qty)} ${p.unit}`)}
              {kv('حد التنبيه', p.minQty)}
              {kv('مكانه في المحل', inf.loc || '—')}
              {kv('آخر شراء', sd ? (sd.lastBuy ? `${money(sd.lastBuy.price)} من ${sd.lastBuy.person || '—'} (${sd.lastBuy.date})` : '—') : '…')}
              {sd && kv('اتباع آخر ٣ شهور', `${qtyText(sd.sold90)} ${p.unit}`)}
              {sd && kv('أكتر عملاء بيشتروه', sd.top.map((t) => `${t.name} (${t.qty})`).join('، ') || '—')}
              {p.barcode ? kv('الباركود', p.barcode) : null}
            </div>
          </div>
        ) : inf.loc ? (
          <div className="pc-card">
            <div className="pc-kv">
              {kv('مكانه في المحل', inf.loc)}
              {kv('سعر البيع', <b>{money(p.price)}</b>)}
            </div>
          </div>
        ) : null}
        {(S.length > 0 || own) && (
          <div className="pc-card">
            <h3>
              📏 المقاسات والألوان {inf.grp ? <small style={{ color: '#7b8a90', fontWeight: 400 }}>({inf.grp})</small> : null}
            </h3>
            {S.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[{ id: p.id, name: p.name, qty: p.qty, size: inf.size, finish: inf.finish, price: p.price }, ...S].map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    className={x.id === p.id ? 'primary' : 'secondary'}
                    style={{ padding: '6px 10px', fontSize: 13, lineHeight: 1.5 }}
                    disabled={x.id === p.id}
                    onClick={() => open({ kind: 'product', id: x.id })}
                  >
                    {[x.size, x.finish].filter(Boolean).join(' · ') || x.name}
                    <br />
                    <small>
                      {x.qty <= 0 ? 'نفد' : `متاح ${qtyText(x.qty)}`}
                      {own && x.price != null ? ` · ${money(x.price)}` : ''}
                    </small>
                  </button>
                ))}
              </div>
            ) : (
              <small style={{ color: '#7b8a90' }}>{inf.grp ? 'مفيش مقاسات تانية في المجموعة دي لسه.' : 'الصنف ده مش مربوط بمقاسات أو ألوان تانية.'}</small>
            )}
            {own && (
              <div style={{ marginTop: 8 }}>
                <button type="button" className="secondary" onClick={() => open({ kind: 'productVariant', id })}>
                  ➕ مقاس أو لون جديد
                </button>
              </div>
            )}
          </div>
        )}
        {inf.packs.length > 0 && (
          <div className="pc-card">
            <h3>📦 العبوات</h3>
            <div className="pc-kv">
              {inf.packs.map((k) =>
                k.small ? (
                  <div key={k.u}>
                    <small>{k.u} (سايب)</small>
                    {p.unit} فيه {k.x} {k.u}
                    {p.price ? ` · سعر ال${k.u} ${money(Math.round(p.price * k.n * 100) / 100)}` : ''}
                  </div>
                ) : (
                  <div key={k.u}>
                    <small>{k.u}</small>
                    {k.n} {p.unit || 'قطعة'}
                    {own && p.price ? ` · ${money(Math.round(p.price * k.n * 100) / 100)}` : ''}
                  </div>
                ),
              )}
            </div>
          </div>
        )}
        <div className="pc-acts">
          <button type="button" className="primary" onClick={() => open({ kind: 'productSend', id })}>
            📤 ابعته واتساب
          </button>
          {own && (
            <>
              <button type="button" className="secondary" onClick={() => open({ kind: 'productDetails', id })}>
                📝 تفاصيل وصور
              </button>
              <button type="button" className="secondary" onClick={() => open({ kind: 'productEdit', id })}>
                ✏️ الاسم والسعر والكمية
              </button>
              <button type="button" className="secondary" onClick={() => open({ kind: 'itemCard', id })}>
                📋 حركة الصنف
              </button>
              <button type="button" className="secondary" onClick={() => open({ kind: 'siteProduct', id })}>
                🌐 انشر على الموقع
              </button>
            </>
          )}
        </div>
        {own && <ExtraButtons product={p} />}
      </div>
    </Modal>
  );
}

// ---------- 📝 تفاصيل وصور ----------

/** The frame the old system put every product photo in (frame.png + frame.json: the product sits in the window, the code under it). */
async function framed(file: File, code: string): Promise<Blob> {
  const loadImg = (src: string) =>
    new Promise<HTMLImageElement>((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => no(new Error('الصورة مش بتفتح'));
      i.src = src;
    });
  const url = URL.createObjectURL(file);
  const im = await loadImg(url);
  let F: { cfg: { window: { x: number; y: number; w: number; h: number }; code?: { x: number; y: number; size: number; color: string; anchor?: string } }; im: HTMLImageElement } | null = null;
  try {
    const cfg = await (await fetch('/brand/frame.json', { cache: 'no-store' })).json();
    F = { cfg, im: await loadImg('/brand/frame.png') };
  } catch {
    F = null;
  }
  const c = document.createElement('canvas');
  const x = c.getContext('2d')!;
  if (F) {
    const W = F.im.naturalWidth;
    const Hh = F.im.naturalHeight;
    const w = F.cfg.window;
    c.width = W;
    c.height = Hh;
    x.fillStyle = '#fff';
    x.fillRect(0, 0, W, Hh);
    const k = Math.min(w.w / im.width, w.h / im.height) * 0.94;
    const dw = im.width * k;
    const dh = im.height * k;
    x.drawImage(im, w.x + (w.w - dw) / 2, w.y + (w.h - dh) / 2, dw, dh);
    x.drawImage(F.im, 0, 0, W, Hh);
    const q = F.cfg.code;
    if (code && q) {
      x.font = `700 ${q.size}px Arial,Tahoma,sans-serif`;
      x.fillStyle = q.color;
      x.textAlign = q.anchor === 'middle' ? 'center' : ((q.anchor as CanvasTextAlign) || 'center');
      x.fillText(code, q.x, q.y);
    }
  } else {
    const W = 1200;
    const Hh = 1000;
    c.width = W;
    c.height = Hh;
    x.fillStyle = '#fff';
    x.fillRect(0, 0, W, Hh);
    const k = Math.min(W / im.width, Hh / im.height);
    x.drawImage(im, (W - im.width * k) / 2, (Hh - im.height * k) / 2, im.width * k, im.height * k);
  }
  URL.revokeObjectURL(url);
  return await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.88));
}
const blobB64 = (b: Blob) =>
  new Promise<string>((ok) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.readAsDataURL(b);
  });

export function ProductDetails({ id }: { id: string }) {
  const { open } = useModal();
  const toast = useToast();
  const prod = useProduct(id).data;
  const info = useProductInfo(id);
  const groups = useInfoGroups().data ?? [];
  const save = useSaveProductInfo();
  const ai = useRef(false);
  const [f, setF] = useState<ProductInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const back = () => open({ kind: 'product', id });
  if (!prod || info.isPending)
    return (
      <Modal title="📝 تفاصيل وصور" onClose={back}>
        <Loading />
      </Modal>
    );
  const v = f ?? info.data!;
  const set = (p: Partial<ProductInfo>) => setF({ ...v, ...p });
  const inp = (k: 'brand' | 'finish' | 'size' | 'loc', label: string, ph: string) => (
    <div className="field">
      <label>{label}</label>
      <input value={v[k]} placeholder={ph} onChange={(e) => set({ [k]: e.target.value })} />
    </div>
  );
  const setPack = (i: number, p: Partial<ProductPack>) => set({ packs: v.packs.map((k, j) => (j === i ? { ...k, ...p } : k)) });
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let ok = 0;
    const urls = [...v.imgs];
    for (const file of [...files]) {
      try {
        toast(`⏳ بجهّز الصورة ${ok + 1} من ${files.length}…`);
        const b = await framed(file, prod.code);
        const r = await api.post<{ url: string }>('/work/files', { data: await blobB64(b), ext: 'jpg' });
        urls.push(r.url);
        ok++;
      } catch (e) {
        toast(`صورة ماترفعتش: ${errorMessage(e)}`, 'bad');
      }
    }
    set({ imgs: urls });
    setBusy(false);
    if (ok) toast(`✔ اترفع ${ok} صورة — دوس «حفظ»`);
  };
  const go = async () => {
    const packs = v.packs
      .map((k): ProductPack | null => {
        const u = k.u.trim();
        if (k.small) {
          const x = Math.round(+(k.x ?? 0));
          return x > 1 ? { u, n: 1 / x, x, small: true } : null;
        }
        const n = Math.round(+k.n || 0);
        return n > 1 ? { u, n } : null;
      })
      .filter((k): k is ProductPack => !!k && !!k.u);
    try {
      await save.mutateAsync({ id, info: { ...v, packs } });
      ai.current = false;
      toast('✔ اتحفظ');
      back();
    } catch (e) {
      toast(`ماتحفظش: ${errorMessage(e)}`, 'bad');
    }
  };
  const bu = prod.unit || 'قطعة';
  return (
    <Modal title={`📝 تفاصيل وصور: ${prod.name}`} onClose={back}>
      <div id="pce">
        <div className="form">
          {inp('brand', 'الماركة', 'مثلاً: ...')}
          {inp('finish', 'التشطيب / اللون', 'نيكل، كروم، أسود مطفي…')}
          {inp('size', 'المقاس', 'مثلاً: 45 سم / 35 مم')}
          {inp('loc', 'مكانه في المحل', 'رف 3 – دولاب المفصلات')}
          <div className="field full">
            <label>مجموعة المقاسات والألوان (لو الصنف ده مقاس أو لون من صنف تاني)</label>
            <input list="pceGrps" value={v.grp} placeholder="مثلاً: مجرى بلي تلسكوبي" onChange={(e) => set({ grp: e.target.value })} />
            <datalist id="pceGrps">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            <small style={{ color: '#7b8a90' }}>كل الأصناف اللي ليها نفس اسم المجموعة بتظهر مع بعض في شاشة المنتج.</small>
          </div>
          <div className="field full">
            <label>العبوات (الوحدة الأساسية: {bu})</label>
            <div id="pcePacks">
              {v.packs.map((k, i) =>
                k.small ? (
                  <div key={i} style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ flex: 'none', fontSize: 13 }}>ال{bu} فيه</span>
                    <input type="number" min={2} step={1} value={k.x || ''} placeholder="كام" onChange={(e) => setPack(i, { x: +e.target.value })} style={{ flex: 1, minWidth: 70 }} />
                    <input value={k.u} placeholder="مسمار / قطعة" onChange={(e) => setPack(i, { u: e.target.value })} style={{ flex: 2, minWidth: 90 }} />
                    <span style={{ flex: 'none', fontSize: 12, color: '#087f8c' }}>بيتباع سايب</span>
                    <button type="button" className="secondary danger" style={{ flex: 'none', padding: '6px 10px' }} onClick={() => set({ packs: v.packs.filter((_, j) => j !== i) })}>
                      ×
                    </button>
                  </div>
                ) : (
                  <div key={i} style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                    <input value={k.u} placeholder="علبة / كرتونة / زوج" onChange={(e) => setPack(i, { u: e.target.value })} style={{ flex: 2, minWidth: 0 }} />
                    <span style={{ flex: 'none' }}>=</span>
                    <input type="number" min={2} step={1} value={k.n || ''} placeholder={`كام ${bu}`} onChange={(e) => setPack(i, { n: +e.target.value })} style={{ flex: 1, minWidth: 0 }} />
                    <button type="button" className="secondary danger" style={{ flex: 'none', padding: '6px 10px' }} onClick={() => set({ packs: v.packs.filter((_, j) => j !== i) })}>
                      ×
                    </button>
                  </div>
                ),
              )}
              <div style={{ marginTop: 6 }}>
                <button type="button" className="secondary" style={{ padding: '6px 10px', fontSize: 13 }} onClick={() => set({ packs: [...v.packs, { u: '', x: 0, n: 1, small: true }] })}>
                  ➕ وحدة أصغر بتتباع سايب (زي المسامير بالحتة)
                </button>{' '}
                <button type="button" className="secondary" onClick={() => set({ packs: [...v.packs, { u: '', n: 0 }] })}>
                  ➕ عبوة
                </button>
              </div>
              {!v.packs.length && <small style={{ color: '#7b8a90', display: 'block', marginTop: 6 }}>بتبيع أو بتشتري بالعلبة أو الكرتونة؟ ضيف عبوة. وبتبيع سايب من صنف متسجل بالكيلو؟ ضيف وحدة أصغر.</small>}
            </div>
          </div>
          <div className="field full">
            <label>الوصف (بيظهر في الكارت ويتبعت مع المنتج)</label>
            <textarea rows={4} value={v.descr} onChange={(e) => set({ descr: e.target.value })} />
          </div>
          <div className="field full">
            <label>المواصفات (كل ميزة في سطر)</label>
            <textarea rows={4} placeholder={'كاتم صوت\nزاوية فتح 110°\nيستحمل 30 كيلو'} value={v.specs} onChange={(e) => set({ specs: e.target.value })} />
          </div>
          <div className="field full">
            <label>صور المنتج (أول صورة هي الأساسية)</label>
            <div className="pc-imgs" id="pceImgs">
              {v.imgs.length ? (
                v.imgs.map((u, i) => (
                  <div key={u}>
                    <img src={u} alt="" />
                    {i ? (
                      <span className="main" style={{ background: '#5d7477', cursor: 'pointer' }} onClick={() => set({ imgs: [u, ...v.imgs.filter((_, j) => j !== i)] })}>
                        خليها الأساسية
                      </span>
                    ) : (
                      <span className="main">الأساسية</span>
                    )}
                    <button type="button" className="secondary danger" title="شيل" onClick={() => set({ imgs: v.imgs.filter((_, j) => j !== i) })}>
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <small style={{ color: '#7b8a90' }}>مفيش صور مرفوعة من هنا لسه</small>
              )}
            </div>
            <label className="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '9px 14px', borderRadius: 12, width: 'auto' }}>
              📷 ارفع صور
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  const fl = e.target.files;
                  void upload(fl);
                  e.target.value = '';
                }}
              />
            </label>
            <small style={{ display: 'block', color: '#7b8a90', marginTop: 6 }}>الصور بتتحط في فريم المحل والكود لوحدها.</small>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="primary" disabled={busy || save.isPending} onClick={() => void go()}>
            حفظ
          </button>
          <button type="button" className="secondary" onClick={back}>
            رجوع
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- 📤 ابعته واتساب ----------

const wnum = (ph: string) => {
  let d = String(ph || '').replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = `2${d}`;
  return d;
};
const msgOf = (p: ProductDto, inf: ProductInfo, withPrice: boolean, shop: string, links?: string[]) => {
  const L = [p.name, p.code ? `الكود: ${p.code}` : '', inf.brand ? `الماركة: ${inf.brand}` : '', inf.finish ? `التشطيب: ${inf.finish}` : '', inf.size ? `المقاس: ${inf.size}` : '', inf.descr ? `\n${inf.descr}` : '', inf.specs || '', withPrice ? `السعر: ${money(p.price)}` : '', p.qty <= 0 ? '(غير متوفر حالياً)' : ''].filter(Boolean);
  if (links?.length) L.push('', 'الصور:', ...links);
  if (shop) L.push('', shop);
  return L.join('\n');
};

export function ProductSend({ id }: { id: string }) {
  const { open } = useModal();
  const toast = useToast();
  const own = useIsAdmin();
  const prod = useProduct(id).data;
  const info = useProductInfo(id).data;
  const shop = useSettings().data?.store.name ?? '';
  const customers = useAllContacts('CUSTOMER', own).data ?? [];
  const suppliers = useAllContacts('SUPPLIER', own).data ?? [];
  const [to, setTo] = useState('');
  const [price, setPrice] = useState(false);
  const back = () => open({ kind: 'product', id });
  if (!prod || !info)
    return (
      <Modal title="📤 ابعت" onClose={back}>
        <Loading />
      </Modal>
    );
  const people = [...customers, ...suppliers].filter((c) => c.phone);
  const im = info.imgs;
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare;
  const target = () => {
    const v = to.trim();
    const c = people.find((x) => v === x.name || v.startsWith(`${x.name} — `));
    return wnum(c ? c.phone : v);
  };
  const wa = () => {
    const n = target();
    if (n.length < 11) return toast('اختار شخص من القايمة أو اكتب رقم صحيح', 'bad');
    const url = `https://wa.me/${n}?text=${encodeURIComponent(msgOf(prod, info, price, shop, im.slice(0, 4).map(abs)))}`;
    if (!window.open(url, '_blank')) location.href = url;
  };
  const share = async () => {
    try {
      toast('⏳ بجهّز الصور…');
      const files: File[] = [];
      for (let i = 0; i < Math.min(im.length, 6); i++) {
        const b = await (await fetch(im[i]!)).blob();
        files.push(new File([b], `${prod.code || 'product'}-${i + 1}.jpg`, { type: b.type || 'image/jpeg' }));
      }
      const data = { files, text: msgOf(prod, info, price, shop) };
      if (!navigator.canShare(data)) throw new Error('الجهاز ده مش بيدعم مشاركة الصور، استخدم «ابعت للرقم»');
      await navigator.share(data);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      toast((e as Error).message || 'المشاركة ماتمتش', 'bad');
    }
  };
  return (
    <Modal title={`📤 ابعت ${prod.name}`} onClose={back}>
      <div className="form">
        <div className="field full">
          <label>لمين؟ (عميل أو مورد أو اكتب رقم)</label>
          <input list="pcsList" placeholder="اسم من جهات الاتصال أو رقم موبايل" value={to} onChange={(e) => setTo(e.target.value)} />
          <datalist id="pcsList">
            {people.map((c) => (
              <option key={c.id} value={`${c.name} — ${c.phone}`} />
            ))}
          </datalist>
        </div>
        <div className="field full">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={price} onChange={(e) => setPrice(e.target.checked)} /> اكتب سعر البيع في الرسالة
          </label>
        </div>
        <p style={{ margin: 0, color: '#7b8a90', fontSize: 13, lineHeight: 1.8 }}>
          {im.length ? `فيه ${im.length} صورة. «شارك الصور» بيفتح قايمة المشاركة على الموبايل وتختار واتساب والشخص. «ابعت للرقم» بيفتح واتساب على الرقم ومعاه الوصف ولينكات الصور.` : 'المنتج ملوش صور لسه، هيتبعت الوصف بس.'}
        </p>
      </div>
      <div className="modal-foot">
        {im.length > 0 && canShare && (
          <button type="button" className="primary" onClick={() => void share()}>
            📲 شارك الصور
          </button>
        )}
        <button type="button" className={im.length && canShare ? 'secondary' : 'primary'} onClick={wa}>
          💬 ابعت للرقم
        </button>
        <button type="button" className="secondary" onClick={back}>
          رجوع
        </button>
      </div>
    </Modal>
  );
}

// ---------- ➕ مقاس أو لون جديد ----------

export function ProductVariant({ id }: { id: string }) {
  const { open } = useModal();
  const toast = useToast();
  const prod = useProduct(id).data;
  const info = useProductInfo(id).data;
  const make = useMakeVariant();
  const [f, setF] = useState<{ name: string; size: string; finish: string; price: string; cost: string } | null>(null);
  const back = () => open({ kind: 'product', id });
  if (!prod || !info)
    return (
      <Modal title="➕ مقاس أو لون جديد" onClose={back}>
        <Loading />
      </Modal>
    );
  const v = f ?? { name: prod.name, size: info.size, finish: info.finish, price: String(prod.price || 0), cost: String(prod.cost ?? 0) };
  const set = (p: Partial<typeof v>) => setF({ ...v, ...p });
  const go = async () => {
    if (!v.name.trim()) return toast('اكتب اسم الصنف', 'bad');
    try {
      const r = await make.mutateAsync({ id, name: v.name.trim(), size: v.size.trim(), finish: v.finish.trim(), price: +v.price || 0, cost: +v.cost || 0 });
      toast(`✔ اتعمل ${v.name}${r.code ? ` بكود ${r.code}` : ''}`);
      open({ kind: 'product', id: r.id });
    } catch (e) {
      toast(`ماتعملش: ${errorMessage(e)}`, 'bad');
    }
  };
  return (
    <Modal title={`➕ مقاس أو لون جديد من: ${info.grp || prod.name}`} onClose={back}>
      <div className="form">
        <div className="field full">
          <label>اسم الصنف الجديد</label>
          <input value={v.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className="field">
          <label>المقاس</label>
          <input value={v.size} onChange={(e) => set({ size: e.target.value })} />
        </div>
        <div className="field">
          <label>التشطيب / اللون</label>
          <input value={v.finish} onChange={(e) => set({ finish: e.target.value })} />
        </div>
        <div className="field">
          <label>سعر البيع</label>
          <input type="number" min={0} step="0.01" value={v.price} onChange={(e) => set({ price: e.target.value })} />
        </div>
        <div className="field">
          <label>سعر الشراء</label>
          <input type="number" min={0} step="0.01" value={v.cost} onChange={(e) => set({ cost: e.target.value })} />
        </div>
        <p style={{ gridColumn: '1/-1', margin: 0, color: '#7b8a90', fontSize: 13 }}>هيتعمل صنف جديد بكود جديد ورصيد صفر، وياخد الماركة والمواصفات والعبوات من الصنف ده، ويتربط بنفس المجموعة.</p>
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={make.isPending} onClick={() => void go()}>
          إنشاء
        </button>
        <button type="button" className="secondary" onClick={back}>
          رجوع
        </button>
      </div>
    </Modal>
  );
}

export function ProductCardModal({ spec }: { spec: ProductCardSpec }) {
  switch (spec.kind) {
    case 'productDetails':
      return <ProductDetails id={spec.id} />;
    case 'productSend':
      return <ProductSend id={spec.id} />;
    case 'productVariant':
      return <ProductVariant id={spec.id} />;
    case 'productEdit':
      return null;
  }
}
