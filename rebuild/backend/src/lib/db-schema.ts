import { Prisma } from '@prisma/client';

/**
 * اسم المخطط (schema) من DATABASE_URL (?schema=mk في الإنتاج، public في غيره) — بيتقري وقت الاستخدام مش وقت التحميل.
 * أي استعلام SQL مباشر ($queryRaw) لازم يكتب اسم الجدول بالمخطط (tbl('StockMove')) —
 * على الاتصال المجمّع (pooler) بتاع Supabase مسار البحث (search_path) مش مضمون،
 * فالاسم من غير مخطط بيرجّع «relation does not exist» في الإنتاج وهو شغال محلي.
 */
export function dbSchema(): string {
  let s: string | null = null;
  try {
    s = new URL(process.env.DATABASE_URL ?? '').searchParams.get('schema');
  } catch {
    /* بدون URL صالح: public */
  }
  return s && /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : 'public';
}

/** اسم جدول مؤهَّل بالمخطط لاستخدامه جوه Prisma.sql */
export const tbl = (name: 'Product' | 'ProductInfo' | 'StockMove' | 'Warehouse' | 'Invoice' | 'InvoiceItem') => Prisma.raw(`"${dbSchema()}"."${name}"`);
