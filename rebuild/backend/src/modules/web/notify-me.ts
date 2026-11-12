import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * «ابلغني لما يتوفر»: the customer left his number on a product that was out of stock (Setting `web_notify`).
 * Every few minutes: for each request whose product is back in stock, the shop's WhatsApp (the bridge) tells him once and the request is removed.
 * The site's product id → our product code comes from the site content document.
 */
const NOTIFY_KEY = 'web_notify';
const SITE_KEY = 'site_content';
const BY = '🌐 رجع المنتج';
const SITE = 'https://mekanezm.vercel.app';

interface Want {
  id: string;
  product: string;
  pname?: string;
  name?: string;
  phone: string;
  at?: string;
}

const intl = (p: string) => {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length < 9) return '';
  if (d.startsWith('20')) return d;
  return '20' + d.replace(/^0/, '');
};

export async function notifyBackInStock(db: PrismaClient): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: NOTIFY_KEY } });
  const list = ((row?.value as unknown as Want[]) ?? []).filter((x) => x && x.product && x.phone);
  if (!list.length) return 0;
  const site = (await db.setting.findUnique({ where: { key: SITE_KEY } }))?.value as unknown as { data?: { products?: { id: string; code?: string; name?: string; hidden?: boolean }[] } } | null;
  const byId = new Map((site?.data?.products ?? []).map((p) => [p.id, p]));
  const codes = [...new Set(list.map((x) => byId.get(x.product)?.code).filter((c): c is string => !!c))];
  const stock = new Map((await db.product.findMany({ where: { code: { in: codes }, deletedAt: null }, select: { code: true, qty: true } })).map((p) => [p.code, p.qty.gt(0)]));

  const left: Want[] = [];
  let sent = 0;
  for (const w of list) {
    const p = byId.get(w.product);
    const to = intl(w.phone);
    if (p?.code && stock.get(p.code) && !p.hidden && to) {
      const name = p.name || w.pname || 'المنتج';
      const body = [`أهلاً${w.name ? ' ' + w.name : ''} 👋`, `المنتج اللي كنت مستنيه رجع متوفر عندنا:`, `🛒 ${name}`, `${SITE}/p/${p.id}`, 'ميكانيزم'].join('\n');
      await db.outboundMessage.create({ data: { toPhone: to, body, byName: BY } });
      sent++;
    } else left.push(w);
  }
  if (sent) await db.setting.update({ where: { key: NOTIFY_KEY }, data: { value: left as unknown as Prisma.InputJsonValue } });
  return sent;
}
