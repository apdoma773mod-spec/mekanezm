/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ContactDto, KitDto, Paginated, ProductDto } from '@mk/shared';
import { api, errorMessage } from '@/lib/api';
import { printHtml } from '@/lib/print';

/**
 * The globals the old «🛠️ أنظمة الشغل» code (./work.js) expects from index.html — db, toast, ask, openModal,
 * mkT.api, mkSB … — backed by the new API. Kept here so work.js itself stays an untouched copy.
 */
export interface LegacyHooks {
  user: { name: string; admin: boolean };
  toast: (text: string) => void;
  /** Opens the new sale window filled with lines; `after` runs once the invoice is saved. */
  openSale: (p: { person?: string; phone?: string; paid?: number; note?: string; lines: { productId?: string; name: string; qty: number; price: number }[]; after?: () => Promise<void> | void }) => void;
  /** Invalidate the app's cached products/invoices after the old code changed them. */
  changed: () => void;
}

interface OldProduct {
  id: string;
  code: string;
  name: string;
  barcode: string;
  cat: string;
  unit: string;
  qty: number;
  cost: number;
  price: number;
  min: number;
  co: string;
  len?: number;
}

const W = () => window as any;
const known = new Set<string>();

const toOld = (p: ProductDto): OldProduct => {
  known.add(p.id);
  return { id: p.id, code: p.code, name: p.name, barcode: p.barcode ?? '', cat: p.category, unit: p.unit, qty: p.qty, cost: p.cost ?? 0, price: p.price, min: p.minQty, co: p.company.toLowerCase() };
};
const coOf = (v: unknown) => (String(v ?? '').toUpperCase() === 'HY' ? 'HY' : 'MK');

async function pages<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page < 100; page++) {
    const r = await api.get<Paginated<T>>(path, { page, pageSize: 200 });
    out.push(...r.items);
    if (out.length >= r.total || !r.items.length) break;
  }
  return out;
}

/** Same as the old waNum(): Egyptian local numbers to 20XXXXXXXXXX. */
function waNum(ph: unknown) {
  let d = String(ph ?? '').replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = `20${d.slice(1)}`;
  else if (d.length === 10 && d.startsWith('1')) d = `20${d}`;
  return d;
}

async function refreshProducts(ids: string[]) {
  const db = W().db;
  for (const id of ids || []) {
    try {
      const r = await api.get<{ product: ProductDto }>(`/products/${id}`);
      const np = toOld(r.product);
      const old = db.products.find((z: OldProduct) => z.id === id);
      if (old) Object.assign(old, np, old.len ? { len: old.len } : {});
      else db.products.push(np);
    } catch {
      /* gone or not reachable: keep what we have */
    }
  }
}

/** Old window.save(): products the old code pushed into db.products locally get created on the server. */
async function syncNow() {
  const db = W().db;
  for (const p of db.products as OldProduct[]) {
    if (known.has(p.id)) continue;
    const r = await api.post<{ product: ProductDto }>('/products', {
      name: p.name,
      category: p.cat || '',
      unit: p.unit || 'قطعة',
      price: +p.price || 0,
      cost: +p.cost || 0,
      minQty: +p.min || 0,
      qty: +p.qty || 0,
      company: coOf(p.co),
    });
    Object.assign(p, toOld(r.product), p.len ? { len: p.len } : {});
  }
}

let saving: Promise<void> | null = null;
function save() {
  saving = (saving ?? Promise.resolve()).then(syncNow).catch((e) => {
    alert(`مقدرتش أحفظ الصنف:\n${errorMessage(e)}`);
  });
  return saving;
}

async function rpc(name: string, args: any) {
  if (name === 'mk_adjust_stock') {
    await api.post(`/products/${args.p_id}/adjust`, { newQty: Math.round((+args.p_qty || 0) * 1e6) / 1e6, note: String(args.p_note || 'تعديل من أنظمة الشغل').slice(0, 300) });
    return { ok: true };
  }
  if (name === 'mk_save_invoice') {
    const p = args.p;
    const r = await api.post<{ invoice: { id: string; no: number | string } }>('/invoices', {
      kind: p.kind === 'purchase' ? 'PURCHASE' : 'SALE',
      company: coOf(p.co),
      date: p.date,
      person: p.person || '',
      phone: p.phone || '',
      address: p.addr || '',
      note: String(p.note || '').slice(0, 1000),
      shipping: +p.ship || 0,
      paid: +p.paid || 0,
      items: (p.items || []).map((x: any) => ({ productId: x.product_id || undefined, name: x.name, qty: +x.qty, price: +x.price || 0 })),
    });
    return { id: r.invoice.id, no: r.invoice.no };
  }
  throw new Error(`مش متاحة: ${name}`);
}

/** Just enough of the Supabase client for the calls work.js makes. */
function sbMock() {
  const from = (table: string) => {
    const st: { op: string; cols?: string; filters: [string, unknown][]; payload?: any } = { op: 'select', filters: [] };
    const run = async (): Promise<{ data: any; error: any }> => {
      try {
        if (table === 'mk_settings') {
          if (st.op === 'select') {
            const key = st.filters.find((f) => f[0] === 'key')?.[1];
            const r = await api.get<{ value: unknown }>(`/work/kv/${key}`);
            return { data: r.value == null ? null : { value: r.value }, error: null };
          }
          if (st.op === 'upsert') {
            for (const row of [].concat(st.payload)) await api.put(`/work/kv/${(row as any).key}`, { value: (row as any).value });
            return { data: null, error: null };
          }
        }
        if (table === 'mk_products' && st.op === 'select') {
          const name = String(st.filters.find((f) => f[0] === 'name')?.[1] ?? '');
          const r = await api.get<Paginated<ProductDto>>('/products', { q: name, pageSize: 50 });
          return { data: r.items.filter((x) => x.name === name).map((x) => ({ id: x.id })), error: null };
        }
        if (table === 'wa_out' && st.op === 'insert') {
          const m = [].concat(st.payload)[0] as any;
          const imgs: string[] = m.imgs || [];
          await api.post('/hy/wa', { to: waNum(m.to_phone), body: [m.body, ...imgs].filter(Boolean).join('\n').slice(0, 4000), byName: W().mkT_user?.name || '' });
          return { data: null, error: null };
        }
        // wa_orders / web_custom_orders belong to the website, which the new system doesn't run yet.
        return { data: null, error: null };
      } catch (e) {
        return { data: null, error: { message: errorMessage(e) } };
      }
    };
    const q: any = {
      select(cols: string) {
        st.op = 'select';
        st.cols = cols;
        return q;
      },
      upsert(rows: any) {
        st.op = 'upsert';
        st.payload = rows;
        return q;
      },
      insert(rows: any) {
        st.op = 'insert';
        st.payload = rows;
        return q;
      },
      update(v: any) {
        st.op = 'update';
        st.payload = v;
        return q;
      },
      eq(k: string, v: unknown) {
        st.filters.push([k, v]);
        return q;
      },
      limit: () => q,
      order: () => q,
      maybeSingle: () => q,
      single: () => q,
      then(ok: (v: any) => any, bad?: (e: any) => any) {
        return run().then(ok, bad);
      },
    };
    return q;
  };
  return { from };
}

function closeModal() {
  document.getElementById('modal')?.remove();
}

function openModal(html: string) {
  closeModal();
  const bg = document.createElement('div');
  bg.id = 'modal';
  bg.className = 'modal-bg';
  bg.style.zIndex = '100000';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  bg.addEventListener('mousedown', (e) => {
    if (e.target === bg) closeModal();
  });
  document.body.appendChild(bg);
}

/** The old ask(): a confirm window with its own button words. */
function ask(msg: string, ok = 'تمام', cancel = 'لأ'): Promise<boolean> {
  return new Promise((resolve) => {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.style.zIndex = '100001';
    const box = document.createElement('div');
    box.className = 'modal';
    box.style.width = 'min(440px,100%)';
    const p = document.createElement('div');
    p.style.cssText = 'white-space:pre-wrap;line-height:1.9;font-size:15px;margin-bottom:16px';
    p.textContent = msg;
    const foot = document.createElement('div');
    foot.className = 'modal-foot';
    const y = document.createElement('button');
    y.type = 'button';
    y.className = 'primary';
    y.textContent = ok;
    const n = document.createElement('button');
    n.type = 'button';
    n.className = 'secondary';
    n.textContent = cancel;
    const done = (v: boolean) => {
      bg.remove();
      resolve(v);
    };
    y.onclick = () => done(true);
    n.onclick = () => done(false);
    foot.append(y, n);
    box.append(p, foot);
    bg.append(box);
    document.body.append(bg);
    y.focus();
  });
}

function blobToB64(b: Blob): Promise<string> {
  return new Promise((ok, bad) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => bad(r.error);
    r.readAsDataURL(b);
  });
}

/** Loads products, contacts and the shop name, then puts every global work.js reads on window. */
export async function installRuntime(h: LegacyHooks) {
  const w = W();
  const [products, contacts, settings] = await Promise.all([
    pages<ProductDto>('/products'),
    h.user.admin ? pages<ContactDto>('/contacts') : Promise.resolve([] as ContactDto[]),
    api.get<{ settings: Record<string, any> }>('/settings').then((r) => r.settings).catch(() => ({}) as Record<string, any>),
  ]);
  const prevLen = new Map<string, number>(((w.db?.products ?? []) as OldProduct[]).filter((p) => p.len).map((p) => [p.id, p.len!]));
  w.db = {
    products: products.map((p) => ({ ...toOld(p), ...(prevLen.has(p.id) ? { len: prevLen.get(p.id) } : {}) })),
    contacts: contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone, type: c.type === 'SUPPLIER' ? 'supplier' : 'customer', balance: c.balance })),
    settings: { companyName: settings.store?.name || 'ميكانيزم' },
    sales: [],
  };
  w.mkT_user = { role: h.user.admin ? 'admin' : 'emp', name: h.user.name };
  w.toast = h.toast;
  w.ask = ask;
  w.openModal = openModal;
  w.closeModal = closeModal;
  w.waNum = waNum;
  w.nextCode = () => '';
  w.curCo = () => {
    try {
      return (localStorage.getItem('mk_co') || 'MK').toLowerCase();
    } catch {
      return 'mk';
    }
  };
  w.mkCoOn = true;
  w.save = save;
  w.mkPrintHTML = printHtml;
  w.mkSB = sbMock();
  w.mkT = {
    api: {
      rpc,
      syncNow: () => save(),
      refreshProducts,
      refreshInvoices: async () => {},
      done: () => h.changed(),
    },
  };
  w.dbAdd = async (x: { name: string; qty: number; price: number; person?: string; note?: string }) => {
    try {
      const r = await api.post('/daybook', { kind: 'ITEM', name: x.name, qty: +x.qty || 1, price: +x.price || 0, person: x.person || '', note: String(x.note || '').slice(0, 300) });
      h.changed();
      h.toast('✔ اتسجّل في اليومية');
      return r;
    } catch (e) {
      alert(`مقدرتش أسجّل في اليومية:\n${errorMessage(e)}`);
      return null;
    }
  };
  w.mkUpload = async (blob: Blob) => {
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'application/pdf' ? 'pdf' : 'jpg';
    const r = await api.post<{ url: string }>('/work/files', { data: await blobToB64(blob), ext });
    return location.origin + r.url;
  };
  w.mkKT = {
    addKit: async (k: { name: string; param: string; def: number; sp: number | string; slots: any[] }) => {
      const r = await api.post<{ kit: KitDto }>('/kits', { name: k.name, param: k.param || '', def: +k.def || 1, sp: +k.sp > 0 ? +k.sp : null, slots: k.slots });
      h.changed();
      return r.kit;
    },
  };
  w.mkOpenSale = (p: Parameters<LegacyHooks['openSale']>[0]) => h.openSale(p);
}
