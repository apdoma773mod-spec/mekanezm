import type { PrismaClient } from '@prisma/client';
import { alertConfig, n2, raiseAlert, userName } from './alerts.js';

interface Who {
  id: string;
  role: 'ADMIN' | 'STAFF';
}

const who = async (db: PrismaClient, a: Who, fallback = 'حد') => (await userName(db, a.id)) || fallback;

/** بيع بأقل من سعر الشراء + خصم كبير على صنف (رسالة لكل نوع لكل فاتورة)، وتنبيه التعديل لو الفاتورة اتعدلت. */
export async function alertInvoiceSaved(db: PrismaClient, invoiceId: string, actor: Who, edit?: { oldTotal: number }): Promise<void> {
  try {
    const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { items: { include: { product: { select: { price: true } } } } } });
    if (!inv) return;
    const name = await who(db, actor);
    if (edit) {
      const total = Number(inv.total);
      await raiseAlert(
        db,
        'edit',
        `✏️ ${name} عدّل فاتورة ${inv.kind === 'PURCHASE' ? 'شراء' : 'بيع'} ${inv.no}${inv.person ? ` (${inv.person})` : ''}\n${
          edit.oldTotal !== total ? `الإجمالي من ${n2(edit.oldTotal)} لـ ${n2(total)}` : `الإجمالي زي ما هو ${n2(total)}`
        }`,
        actor,
      );
    }
    if (inv.kind !== 'SALE') return;
    const d = (await alertConfig(db)).disc;
    const below: string[] = [];
    const disc: string[] = [];
    for (const it of inv.items) {
      const price = Number(it.price);
      const cost = Number(it.unitCost);
      const list = it.product ? Number(it.product.price) : 0;
      if (cost > 0 && price < cost) below.push(`• ${it.name} × ${n2(it.qty)} بـ ${n2(price)} (الشراء ${n2(cost)})`);
      else if (list > 0 && price < list * (1 - d / 100)) disc.push(`• ${it.name} بـ ${n2(price)} بدل ${n2(list)} (خصم ${Math.round((1 - price / list) * 100)}%)`);
    }
    const who2 = `${name}`;
    if (below.length) await raiseAlert(db, 'below', `⚠️ ${who2} باع بأقل من سعر الشراء — فاتورة ${inv.no}${inv.person ? ` (${inv.person})` : ''}${edit ? ' بعد تعديل' : ''}\n${below.join('\n')}`, actor);
    if (disc.length) await raiseAlert(db, 'disc', `🏷️ ${who2} عمل خصم كبير — فاتورة ${inv.no}${inv.person ? ` (${inv.person})` : ''}\n${disc.join('\n')}`, actor);
  } catch {
    /* alerts never break the sale */
  }
}

export async function alertInvoiceVoided(db: PrismaClient, inv: { kind: string; no: string; total: unknown; person: string; createdById: string | null }, actor: Who): Promise<void> {
  const by = await userName(db, inv.createdById);
  await raiseAlert(
    db,
    'void',
    `🗑️ ${await who(db, actor)} لغى فاتورة ${inv.kind === 'PURCHASE' ? 'شراء' : 'بيع'} رقم ${inv.no} بقيمة ${n2(Number(inv.total))} ج${inv.person ? `\nالعميل: ${inv.person}` : ''}${by ? `\nكان كاتبها: ${by}` : ''}`,
    actor,
  );
}

export async function alertStockAdjust(db: PrismaClient, p: { name: string }, before: number, after: number, note: string, actor: Who): Promise<void> {
  const diff = after - before;
  if (!diff) return;
  await raiseAlert(db, 'adjust', `📦 ${await who(db, actor)} عدّل رصيد «${p.name}» يدوي من ${n2(before)} لـ ${n2(after)} (${diff > 0 ? '+' : ''}${n2(diff)})${note ? `\nالسبب: ${note}` : ''}`, actor);
}

export async function alertClosing(db: PrismaClient, c: { cashDiff: number | null; cashExpected: number; cashActual: number | null; note: string }, actor: Who): Promise<void> {
  if (c.cashDiff == null) return;
  const lim = (await alertConfig(db)).short;
  if (Math.abs(c.cashDiff) < lim) return;
  await raiseAlert(
    db,
    'short',
    `${c.cashDiff < 0 ? '💵 عجز في الدرج: ' : '💵 زيادة في الدرج: '}${n2(Math.abs(c.cashDiff))} ج\nالمفروض ${n2(c.cashExpected)} والموجود ${n2(c.cashActual)}\nقفّل: ${await who(db, actor, '')}${c.note ? `\nملاحظة: ${c.note}` : ''}`,
    actor,
  );
}

export async function alertPaymentCancelled(db: PrismaClient, p: { direction: string; amount: unknown; note: string; contactName: string }, actor: Who): Promise<void> {
  await raiseAlert(db, 'pay', `💸 ${await who(db, actor)} مسح ${p.direction === 'IN' ? 'تحصيل' : 'دفعة'} بـ ${n2(Number(p.amount))} ج${p.contactName ? ` — ${p.contactName}` : ''}${p.note ? `\n${p.note}` : ''}`, actor);
}

export async function alertGift(db: PrismaClient, g: { name: string; qty: number; to: string; kind: string; phone: string; value: number; note: string }, actor: Who): Promise<void> {
  await raiseAlert(
    db,
    'gift',
    `🎁 ${await who(db, actor)} ادّى هدية: ${g.name} × ${n2(g.qty)}\nلـ ${g.to}${g.kind ? ` (${g.kind})` : ''}${g.phone ? ` — ${g.phone}` : ''}\nقيمتها بسعر البيع ${n2(g.value)} ج${g.note ? `\n${g.note}` : ''}`,
    actor,
  );
}
