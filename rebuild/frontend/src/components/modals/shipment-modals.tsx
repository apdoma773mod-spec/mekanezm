'use client';

import { useState } from 'react';
import { CARRIERS, GOVS, SHIP_FLOW, type ShipmentDto, type ShipStatus } from '@mk/shared';
import { errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { useCreateShipment, useDeleteShipment, useShipPaid, useShipments, useUpdateShipment } from '@/lib/phase4-queries';
import { printHtml, shipLabelHtml } from '@/lib/print';
import { useSettings } from '@/lib/queries';
import { useContacts, useInvoice } from '@/lib/trade-queries';
import { Modal } from '../ui/modal';
import { useToast } from '../ui/toast';
import { useIsAdmin } from '../use-role';
import { useModal } from './modal-host';

export function stLabel(s: ShipStatus, k: ShipmentDto['kind']) {
  return (
    {
      new: 'جديدة',
      printed: 'اتطبع الملصق',
      handed: k === 'SHIP' ? 'اتسلمت لشركة الشحن' : 'اتسلمت للمندوب',
      out: k === 'SHIP' ? 'اتشحنت — في الطريق' : 'خرجت مع المندوب',
      delivered: 'العميل استلم',
      paid: 'اتحاسبنا ✔',
      returned: 'مرتجع',
      cancelled: 'ملغية',
    } as const
  )[s];
}
export const kindIc = (k: ShipmentDto['kind']) => (k === 'SHIP' ? '📦 شحن' : '🛵 توصيل');

const waTo = (ph: string, t: string) => {
  let d = ph.replace(/\D/g, '');
  if (d.startsWith('0')) d = `20${d.slice(1)}`;
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(t)}` : '';
};

/** The old shipMsg(): what to tell the customer at each step. */
export function shipMsg(s: ShipmentDto, shop: string) {
  const h = `أهلاً ${s.name} 👋\n`;
  if (s.status === 'out' || s.status === 'handed') {
    if (s.kind === 'SHIP')
      return `${h}طلبك من ${shop} اتشحن 📦${s.carrier ? ` مع ${s.carrier}` : ''}${s.tracking ? `\nرقم البوليصة: ${s.tracking}` : ''}${s.cod > 0 ? `\nالمطلوب عند الاستلام: ${money(s.cod)}` : ''}\n\nلو عندك أي سؤال ردّ علينا هنا.`;
    return `${h}طلبك من ${shop} خرج مع المندوب 🛵${s.driver ? `\nالمندوب: ${s.driver}` : ''}${s.driverPhone ? ` — ${s.driverPhone}` : ''}${s.cod > 0 ? `\nالمطلوب عند الاستلام: ${money(s.cod)}` : ''}\n\nلو عندك أي سؤال ردّ علينا هنا.`;
  }
  if (s.status === 'delivered' || s.status === 'paid') return `${h}نتمنى يكون طلبك من ${shop} وصلك سليم ✅\nشكراً لثقتك — ولو محتاج أي حاجة إحنا موجودين.`;
  return `${h}طلبك من ${shop} بيتجهّز للـ${s.kind === 'SHIP' ? 'شحن 📦' : 'توصيل 🛵'} — هنبلّغك أول ما يخرج.`;
}

export function useShipActions() {
  const settings = useSettings().data;
  const update = useUpdateShipment();
  const toast = useToast();
  const shop = settings?.store.name || 'ميكانيزم';
  const notify = (s: ShipmentDto) => {
    const wa = waTo(s.phone, shipMsg(s, shop));
    if (!wa) return toast('العميل مالوش رقم', 'bad');
    window.open(wa, '_blank');
  };
  const label = async (s: ShipmentDto) => {
    if (!settings) return;
    printHtml(shipLabelHtml(s, settings));
    if (s.status === 'new') await update.mutateAsync({ id: s.id, input: { status: 'printed' } }).catch(() => undefined);
  };
  return { notify, label, shop };
}

const carriersOf = (extra: string[]) => [...new Set([...CARRIERS, ...extra.filter(Boolean)])];

interface EditProps {
  id?: string;
  preset?: Partial<ShipmentDto>;
  /** A sale invoice to ship: its customer, phone, address, content and remaining amount are filled in. */
  invoiceId?: string;
}

/** «🚚 شحنة جديدة / تعديل». */
export function ShipmentEdit({ id, preset, invoiceId }: EditProps) {
  const { close } = useModal();
  const toast = useToast();
  const admin = useIsAdmin();
  const all = useShipments({ tab: 'all' });
  const existing = id ? all.data?.items.find((x) => x.id === id) : undefined;
  const inv = useInvoice(invoiceId ?? null).data;
  const base: Partial<ShipmentDto> = existing ??
    preset ?? {
      kind: 'SHIP',
      ...(inv
        ? {
            invoiceNo: inv.no,
            name: inv.person,
            phone: inv.phone,
            address: inv.address,
            cod: inv.remaining,
            content: inv.items.map((x) => `${x.name} × ${x.qty}`).join('، '),
          }
        : {}),
    };
  const [f, setF] = useState<Partial<ShipmentDto>>({ pieces: 1, cod: 0, fee: 0, ...base });
  const [loadedInv, setLoadedInv] = useState(!invoiceId);
  if (!loadedInv && inv) {
    setF((x) => ({ ...x, invoiceNo: inv.no, name: x.name || inv.person, phone: x.phone || inv.phone, address: x.address || inv.address, cod: inv.remaining, content: inv.items.map((i) => `${i.name} × ${i.qty}`).join('، ') }));
    setLoadedInv(true);
  }
  const contacts = useContacts({ type: 'CUSTOMER', q: f.name?.trim() || undefined, pageSize: 10 });
  const create = useCreateShipment();
  const update = useUpdateShipment();
  const del = useDeleteShipment();
  const { label } = useShipActions();
  const kind = f.kind ?? 'SHIP';
  const set = (p: Partial<ShipmentDto>) => setF((x) => ({ ...x, ...p }));
  const carriers = carriersOf((all.data?.items ?? []).map((x) => x.carrier));

  const go = async (print: boolean) => {
    const o = {
      kind,
      name: (f.name ?? '').trim(),
      invoiceNo: (f.invoiceNo ?? '').trim(),
      phone: (f.phone ?? '').trim(),
      phone2: (f.phone2 ?? '').trim(),
      gov: f.gov ?? '',
      area: (f.area ?? '').trim(),
      address: (f.address ?? '').trim(),
      carrier: (f.carrier ?? '').trim(),
      tracking: kind === 'SHIP' ? (f.tracking ?? '').trim() : '',
      driver: kind === 'DELIVERY' ? (f.driver ?? '').trim() : '',
      driverPhone: kind === 'DELIVERY' ? (f.driverPhone ?? '').trim() : '',
      cod: Number(f.cod) || 0,
      fee: Number(f.fee) || 0,
      pieces: Math.min(50, Math.max(1, Math.round(Number(f.pieces) || 1))),
      content: (f.content ?? '').trim(),
      note: (f.note ?? '').trim(),
      ...(existing && f.status ? { status: f.status } : {}),
    };
    if (!o.name) return toast('اكتب اسم العميل', 'bad');
    if (o.phone.replace(/\D/g, '').length < 8) return toast('اكتب موبايل العميل', 'bad');
    if (kind === 'SHIP' && !o.gov) return toast('اختار المحافظة', 'bad');
    if (kind === 'SHIP' && !o.address) return toast('اكتب العنوان', 'bad');
    try {
      const r = existing ? await update.mutateAsync({ id: existing.id, input: o }) : await create.mutateAsync(o);
      close();
      toast(`✔ الشحنة اتحفظت ${r.no}`);
      if (print) await label(r);
    } catch (e) {
      toast(`ماتحفظتش: ${errorMessage(e)}`, 'bad');
    }
  };

  const remove = async () => {
    if (!existing || !window.confirm(`حذف الشحنة ${existing.no} نهائياً؟`)) return;
    try {
      await del.mutateAsync(existing.id);
      close();
      toast('اتحذفت');
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };

  const busy = create.isPending || update.isPending;
  const inp = (k: keyof ShipmentDto, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input value={String(f[k] ?? '')} onChange={(e) => set({ [k]: e.target.value } as Partial<ShipmentDto>)} {...extra} />
  );

  return (
    <Modal title={`🚚 ${existing ? `شحنة ${existing.no}` : 'شحنة جديدة'}`} onClose={close}>
      <div className="form">
        <div className="field full">
          <label>النوع</label>
          <div className="delopt">
            {(
              [
                ['SHIP', '📦 شحن لمحافظة (شركة شحن)'],
                ['DELIVERY', '🛵 توصيل القاهرة والجيزة (مندوب/أوبر)'],
              ] as const
            ).map(([v, t]) => (
              <label key={v}>
                <input type="radio" name="seK" checked={kind === v} onChange={() => set({ kind: v, ...(v === 'DELIVERY' && !f.gov ? { gov: 'الجيزة' } : {}) })} /> {t}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label>اسم العميل</label>
          <input
            value={f.name ?? ''}
            list="seCust"
            onChange={(e) => {
              const name = e.target.value;
              const c = contacts.data?.items.find((x) => x.name === name);
              set({ name, ...(c && !f.phone && c.phone ? { phone: c.phone } : {}), ...(c && !f.address && c.address ? { address: c.address } : {}) });
            }}
          />
          <datalist id="seCust">{contacts.data?.items.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        </div>
        <div className="field">
          <label>الفاتورة (اختياري)</label>
          {inp('invoiceNo', { dir: 'ltr', placeholder: 'MK-0001' })}
        </div>
        <div className="field">
          <label>الموبايل</label>
          {inp('phone', { type: 'tel', dir: 'ltr' })}
        </div>
        <div className="field">
          <label>موبايل تاني (اختياري)</label>
          {inp('phone2', { type: 'tel', dir: 'ltr' })}
        </div>
        <div className="field">
          <label>المحافظة</label>
          <select value={f.gov ?? ''} onChange={(e) => set({ gov: e.target.value })}>
            <option value="">— اختار —</option>
            {GOVS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>المنطقة / المدينة</label>
          {inp('area')}
        </div>
        <div className="field full">
          <label>العنوان بالتفصيل</label>
          <textarea rows={2} value={f.address ?? ''} onChange={(e) => set({ address: e.target.value })} style={{ padding: 11, border: '1px solid var(--border)', borderRadius: 10 }} />
        </div>
        <div className="field">
          <label>{kind === 'SHIP' ? 'شركة الشحن' : 'شركة التوصيل (اختياري)'}</label>
          {inp('carrier', { list: 'seCars' })}
          <datalist id="seCars">
            {carriers.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        {kind === 'SHIP' ? (
          <div className="field">
            <label>رقم البوليصة / التتبع</label>
            {inp('tracking', { dir: 'ltr' })}
          </div>
        ) : (
          <>
            <div className="field">
              <label>اسم المندوب</label>
              {inp('driver')}
            </div>
            <div className="field">
              <label>موبايل المندوب</label>
              {inp('driverPhone', { type: 'tel', dir: 'ltr' })}
            </div>
          </>
        )}
        <div className="field">
          <label>💰 المطلوب تحصيله من العميل</label>
          {inp('cod', { inputMode: 'decimal' })}
        </div>
        <div className="field">
          <label>مصاريف الشحن علينا (اختياري)</label>
          {inp('fee', { inputMode: 'decimal', placeholder: '0' })}
        </div>
        <div className="field">
          <label>عدد الطرود (كل طرد ليه ملصق)</label>
          {inp('pieces', { type: 'number', min: 1, max: 50 })}
        </div>
        {existing && (
          <div className="field">
            <label>الحالة</label>
            <select value={f.status} onChange={(e) => set({ status: e.target.value as ShipStatus })}>
              {[...SHIP_FLOW[kind], 'returned' as const, 'cancelled' as const].map((x) => (
                <option key={x} value={x}>
                  {stLabel(x, kind)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field full">
          <label>المحتويات</label>
          {inp('content')}
        </div>
        <div className="field full">
          <label>ملاحظات (بتتطبع على الملصق)</label>
          {inp('note', { placeholder: 'مثلاً: قابل للكسر — كلّم العميل قبل الوصول' })}
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={busy} onClick={() => go(true)}>
          💾 حفظ واطبع الملصق
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={() => go(false)}>
          حفظ
        </button>
        {existing && admin && (
          <button type="button" className="secondary danger" onClick={remove}>
            حذف
          </button>
        )}
        <button type="button" className="secondary" onClick={close}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

/** «📦 سلّمتها لمين؟» / «🛵 مين المندوب؟» before moving a parcel on. */
export function ShipWho({ s, next }: { s: ShipmentDto; next: ShipStatus }) {
  const { close } = useModal();
  const toast = useToast();
  const update = useUpdateShipment();
  const all = useShipments({ tab: 'all' });
  const { notify } = useShipActions();
  const ship = s.kind === 'SHIP';
  const [carrier, setCarrier] = useState(s.carrier);
  const [tracking, setTracking] = useState(s.tracking);
  const [driver, setDriver] = useState(s.driver);
  const [driverPhone, setDriverPhone] = useState(s.driverPhone);
  const [fee, setFee] = useState(s.fee ? String(s.fee) : '');
  const go = async () => {
    if (ship && !carrier.trim()) return toast('اكتب اسم شركة الشحن', 'bad');
    try {
      const r = await update.mutateAsync({
        id: s.id,
        input: { status: next, carrier: carrier.trim(), fee: Number(fee) || 0, ...(ship ? { tracking: tracking.trim() } : { driver: driver.trim(), driverPhone: driverPhone.trim() }) },
      });
      close();
      toast(`✔ ${stLabel(next, s.kind)}`);
      if (r.phone && window.confirm('تبعت للعميل رسالة واتساب إن طلبه خرج؟')) notify(r);
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
  return (
    <Modal title={ship ? '📦 سلّمتها لمين؟' : '🛵 مين المندوب؟'} onClose={close}>
      <div className="form">
        <div className="field">
          <label>{ship ? 'شركة الشحن' : 'شركة التوصيل (اختياري)'}</label>
          <input value={carrier} list="swCs" onChange={(e) => setCarrier(e.target.value)} />
          <datalist id="swCs">
            {carriersOf((all.data?.items ?? []).map((x) => x.carrier)).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        {ship ? (
          <div className="field">
            <label>رقم البوليصة / التتبع</label>
            <input dir="ltr" value={tracking} onChange={(e) => setTracking(e.target.value)} />
          </div>
        ) : (
          <>
            <div className="field">
              <label>اسم المندوب</label>
              <input value={driver} onChange={(e) => setDriver(e.target.value)} />
            </div>
            <div className="field">
              <label>موبايل المندوب</label>
              <input type="tel" dir="ltr" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
            </div>
          </>
        )}
        <div className="field">
          <label>مصاريف الشحن علينا (اختياري)</label>
          <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="primary" disabled={update.isPending} onClick={go}>
          ✔ تمام
        </button>
        <button type="button" className="secondary" onClick={close}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

/** «💰 تحصيل الشحنة»: closes the follow-up; the payment and the fee are optional. */
export function ShipPaid({ s }: { s: ShipmentDto }) {
  const { close } = useModal();
  const toast = useToast();
  const admin = useIsAdmin();
  const paid = useShipPaid();
  const contacts = useContacts({ type: 'CUSTOMER', q: s.name, pageSize: 5 });
  const c = contacts.data?.items.find((x) => x.name === s.name);
  const [amount, setAmount] = useState(String(s.cod || 0));
  const [fee, setFee] = useState(s.fee ? String(s.fee) : '');
  const [pay, setPay] = useState<boolean | null>(null);
  const [exp, setExp] = useState(true);
  const payOn = pay ?? (!!c && s.cod > 0 && c.balance > 0);
  const go = async () => {
    try {
      await paid.mutateAsync({ id: s.id, input: { amount: Number(amount) || 0, fee: Number(fee) || 0, recordPayment: !!c && payOn, recordExpense: admin && exp } });
      close();
      toast('✔ الشحنة اتقفلت — اتحاسبنا');
    } catch (e) {
      toast(errorMessage(e), 'bad');
    }
  };
  return (
    <Modal title={`💰 تحصيل الشحنة ${s.no}`} onClose={close}>
      <p style={{ marginTop: 0 }}>
        العميل: <b>{s.name}</b>
        {s.carrier && (
          <>
            {' — مع '}
            <b>{s.carrier}</b>
          </>
        )}
      </p>
      <div className="form">
        <div className="field">
          <label>المبلغ اللي العميل دفعه</label>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        {admin && (
          <div className="field">
            <label>مصاريف الشحن اللي اتخصمت (اختياري)</label>
            <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
        )}
      </div>
      {c ? (
        <label className="chk" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={payOn} onChange={(e) => setPay(e.target.checked)} /> سجّل المبلغ دفعة على حساب <b>{c.name}</b> (عليه دلوقتي {money(c.balance)})
        </label>
      ) : (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>العميل مش متسجل في العملاء — الدفعة مش هتتسجل على حساب.</p>
      )}
      {admin && (
        <label className="chk">
          <input type="checkbox" checked={exp} onChange={(e) => setExp(e.target.checked)} /> سجّل مصاريف الشحن كمصروف في الخزنة
        </label>
      )}
      <div className="modal-foot">
        <button type="button" className="primary" disabled={paid.isPending} onClick={go}>
          ✔ اتحاسبنا — اقفل المتابعة
        </button>
        <button type="button" className="secondary" onClick={close}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}
