import { z } from 'zod';
import { normalizeDigits } from '../digits.js';
import { isoDateSchema, moneySchema, paginationQuery, positiveQty } from './common.js';

const text = (max: number) => z.string().trim().max(max).default('');
const phone = z
  .string()
  .transform((v) => normalizeDigits(v).trim())
  .pipe(z.string().max(30))
  .default('');

// ---------- 📝 عروض الأسعار ----------

export const quoteItemInput = z.object({
  productId: z.string().max(64).optional(),
  name: z.string().trim().min(1).max(200),
  unit: text(30),
  qty: positiveQty,
  price: moneySchema,
});

export const quoteInput = z.object({
  person: text(120),
  phone,
  address: text(300),
  note: text(500),
  shipping: moneySchema.default(0),
  items: z.array(quoteItemInput).min(1, 'أضف صنف واحد على الأقل').max(300),
});
export type QuoteInput = z.infer<typeof quoteInput>;

export interface QuoteItem {
  productId: string | null;
  name: string;
  unit: string;
  qty: number;
  price: number;
  total: number;
}

export interface QuoteDto {
  id: string;
  no: string;
  date: string;
  person: string;
  phone: string;
  address: string;
  note: string;
  shipping: number;
  total: number;
  items: QuoteItem[];
  status: 'open' | 'converted';
  invoiceId: string | null;
  invoiceNo: string;
  createdBy: string;
  createdAt: string;
}

export const listQuotesQuery = paginationQuery;
export const quoteConvertedInput = z.object({ invoiceId: z.string().min(1).max(64) });

// ---------- 🚚 الشحن والتوصيل ----------

export const SHIP_KINDS = ['SHIP', 'DELIVERY'] as const;
export const SHIP_STATUSES = ['new', 'printed', 'handed', 'out', 'delivered', 'paid', 'returned', 'cancelled'] as const;
export type ShipStatus = (typeof SHIP_STATUSES)[number];
export const SHIP_FLOW: Record<(typeof SHIP_KINDS)[number], ShipStatus[]> = {
  SHIP: ['new', 'printed', 'handed', 'out', 'delivered', 'paid'],
  DELIVERY: ['new', 'printed', 'out', 'delivered', 'paid'],
};
export const SHIP_CLOSED: ShipStatus[] = ['paid', 'returned', 'cancelled'];

export const GOVS = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية', 'الغربية', 'المنوفية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس',
  'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء',
] as const;
export const CARRIERS = ['بوسطة Bosta', 'أرامكس Aramex', 'J&T Express', 'البريد المصري', 'سبيدي', 'مندوب المحل', 'أوبر Uber', 'إن درايف inDrive'] as const;

export const shipmentInput = z.object({
  kind: z.enum(SHIP_KINDS).default('SHIP'),
  status: z.enum(SHIP_STATUSES).optional(),
  invoiceNo: text(30),
  name: z.string().trim().min(1, 'اكتب اسم العميل').max(120),
  phone: phone.refine((v) => v.replace(/\D/g, '').length >= 8, 'اكتب موبايل العميل'),
  phone2: phone,
  gov: text(40),
  area: text(120),
  address: text(400),
  carrier: text(80),
  tracking: text(80),
  driver: text(80),
  driverPhone: phone,
  cod: moneySchema.default(0),
  fee: moneySchema.default(0),
  pieces: z.coerce.number().int().min(1).max(50).default(1),
  content: text(500),
  note: text(300),
});
export type ShipmentInput = z.infer<typeof shipmentInput>;
export const updateShipmentInput = shipmentInput.partial();
export type UpdateShipmentInput = z.infer<typeof updateShipmentInput>;

/** «💰 اتحاسبنا»: closes the parcel, optionally records the payment and the fee as an expense. */
export const shipPaidInput = z.object({
  amount: moneySchema.default(0),
  fee: moneySchema.default(0),
  recordPayment: z.boolean().default(false),
  recordExpense: z.boolean().default(false),
});
export type ShipPaidInput = z.infer<typeof shipPaidInput>;

export interface ShipmentDto {
  id: string;
  no: string;
  kind: (typeof SHIP_KINDS)[number];
  status: ShipStatus;
  invoiceId: string | null;
  invoiceNo: string;
  name: string;
  phone: string;
  phone2: string;
  gov: string;
  area: string;
  address: string;
  carrier: string;
  tracking: string;
  driver: string;
  driverPhone: string;
  cod: number;
  fee: number;
  pieces: number;
  content: string;
  note: string;
  log: { s: ShipStatus; at: string; by: string }[];
  closedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export const listShipmentsQuery = z.object({
  tab: z.enum(['open', 'collect', 'done', 'other', 'all']).default('open'),
  kind: z.enum(SHIP_KINDS).optional(),
  q: z.string().trim().max(120).optional(),
  invoiceId: z.string().max(64).optional(),
});

// ---------- 🎁 هدايا / ⚠️ درجة تانية / 🔁 بدائل ----------

export const GIFT_KINDS = ['صنايعي', 'مساعد صنايعي', 'مهندس', 'عميل', 'أخرى'] as const;

export const giftInput = z.object({
  productId: z.string().min(1).max(64),
  qty: positiveQty,
  toName: z.string().trim().min(1, 'اكتب اسم اللي خد الهدية').max(120),
  toPhone: phone,
  toKind: z.enum(GIFT_KINDS).default('صنايعي'),
  note: text(300),
});
export type GiftInput = z.infer<typeof giftInput>;

export interface GiftDto {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  price: number;
  cost?: number;
  toName: string;
  toPhone: string;
  toKind: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface GiftsSummary {
  gifts: GiftDto[];
  /** Per receiver: how much they got and how much they bought (matched by name on sale invoices). */
  people: { name: string; kind: string; phone: string; count: number; value: number; cost?: number; bought: number }[];
  total: number;
  totalCost?: number;
  last30: number;
}

export const gradeInput = z.object({
  productId: z.string().min(1).max(64),
  qty: positiveQty,
  price: moneySchema,
  note: text(300),
});
export type GradeInput = z.infer<typeof gradeInput>;

export const altsInput = z.object({ ids: z.array(z.string().min(1).max(64)).max(50) });

// ---------- 👷 العمالة والحضور ----------

export const PAY_TYPES = ['month', 'week', 'day'] as const;
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'الساعة غلط');

export const staffInput = z.object({
  name: z.string().trim().min(1, 'اكتب الاسم').max(120),
  job: text(80),
  phone,
  nid: text(20),
  address: text(300),
  payType: z.enum(PAY_TYPES).default('month'),
  salary: moneySchema.default(0),
  shiftStart: hhmm.default('10:00'),
  shiftEnd: hhmm.default('22:00'),
  offDay: z.coerce.number().int().min(-1).max(6).default(5),
  startDate: isoDateSchema.optional(),
  userId: z.string().max(64).nullable().default(null),
  note: text(300),
  active: z.boolean().default(true),
});
export type StaffInput = z.infer<typeof staffInput>;

export interface StaffDto {
  id: string;
  name: string;
  job: string;
  phone: string;
  nid: string;
  address: string;
  payType: (typeof PAY_TYPES)[number];
  salary: number;
  shiftStart: string;
  shiftEnd: string;
  offDay: number;
  startDate: string;
  userId: string | null;
  note: string;
  active: boolean;
}

export interface AttendanceDto {
  id: string;
  staffId: string;
  day: string;
  inAt: string | null;
  outAt: string | null;
  lateMin: number;
  method: 'qr' | 'manual';
  note: string;
}

export const STAFF_MOVE_KINDS = ['advance', 'bonus', 'deduct', 'pay'] as const;
export interface StaffMoveDto {
  id: string;
  staffId: string;
  kind: (typeof STAFF_MOVE_KINDS)[number];
  amount: number;
  month: string;
  note: string;
  createdAt: string;
}

export interface StaffConfig {
  absent: boolean;
  late: number;
}

export interface StaffMonth {
  month: string;
  staff: StaffDto[];
  attendance: AttendanceDto[];
  moves: StaffMoveDto[];
  /** Admins only. */
  config?: StaffConfig;
  /** System accounts that can be linked to an employee (admins only). */
  members?: { id: string; name: string; role: 'ADMIN' | 'STAFF' }[];
}

export const monthQuery = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() });

export const attendanceManualInput = z.object({
  staffId: z.string().min(1).max(64),
  day: isoDateSchema,
  inTime: hhmm,
  outTime: hhmm.optional(),
  note: text(300),
});
export type AttendanceManualInput = z.infer<typeof attendanceManualInput>;

export const staffMoveInput = z.object({
  kind: z.enum(STAFF_MOVE_KINDS),
  amount: moneySchema.pipe(z.number().gt(0, 'اكتب المبلغ')),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  note: text(300),
});
export type StaffMoveInput = z.infer<typeof staffMoveInput>;

export const staffConfigInput = z.object({ absent: z.boolean(), late: z.coerce.number().min(0).max(1000) });

export const punchInput = z.object({ code: z.string().regex(/^[0-9a-f]{6,40}$/i) });
export interface PunchResult {
  kind: 'in' | 'out';
  name: string;
  at: string;
  late: number;
}

// ---------- ⭐ نقاط العمال ----------

export interface PointsConfig {
  rules: { ontime: number; late: number; lateMin: number; absent: number; fullMonth: number };
  reasons: [string, number][];
  rewards: [string, number][];
}
export const DEFAULT_POINTS: PointsConfig = {
  rules: { ontime: 2, late: -1, lateMin: 10, absent: -3, fullMonth: 10 },
  reasons: [
    ['🤝 تعامل ممتاز مع عميل', 5],
    ['💰 بيعة كبيرة / تارجت', 10],
    ['🧹 نضافة وترتيب المحل', 3],
    ['📦 جرد مظبوط', 5],
    ['🙋 ساعد زميله', 3],
    ['⚠️ غلطة في فاتورة', -5],
    ['📵 موبايل وقت الشغل', -3],
    ['😠 شكوى من عميل', -10],
  ],
  rewards: [
    ['☕ فطار على حساب المحل', 50],
    ['🎁 قسيمة ٢٠٠ جنيه', 150],
    ['🏖️ يوم إجازة مدفوع', 300],
    ['💵 مكافأة ٥٠٠ جنيه', 400],
  ],
};
export const pointsConfigInput = z.object({
  rules: z.object({ ontime: z.number(), late: z.number(), lateMin: z.number().min(0), absent: z.number(), fullMonth: z.number() }),
  reasons: z.array(z.tuple([z.string().trim().min(1).max(80), z.number()])).max(50),
  rewards: z.array(z.tuple([z.string().trim().min(1).max(80), z.number().min(0)])).max(50),
});
export const pointsGiveInput = z.object({
  pts: z.number().int().refine((n) => n !== 0, 'اكتب عدد النقاط'),
  why: text(120),
  redeem: z.boolean().default(false),
});

export interface StaffPointDto {
  id: string;
  staffId: string;
  pts: number;
  why: string;
  month: string;
  redeem: boolean;
  byName: string;
  createdAt: string;
}

export interface PointsBoard {
  month: string;
  config: PointsConfig;
  rows: { staff: StaffDto; on: number; late: number; abs: number; auto: number; man: number; month: number; balance: number }[];
  log: StaffPointDto[];
}

// ---------- 🧩 الأطقم ----------

export const kitSlotInput = z.object({
  label: z.string().trim().min(1, 'اكتب اسم المكوّن').max(120),
  mode: z.enum(['fixed', 'param', 'len']).default('fixed'),
  qty: z.number().gt(0, 'كل مكوّن لازم يبقى فيه كمية'),
  per: z.number().gt(0).default(1),
  ulen: z.number().gt(0).default(1),
  opt: z.boolean().default(false),
  products: z.array(z.string().min(1).max(64)).min(1, 'كل مكوّن لازم يبقى فيه صنف').max(30),
});
export type KitSlot = z.infer<typeof kitSlotInput>;

export const kitInput = z.object({
  name: z.string().trim().min(1, 'اكتب اسم الطقم').max(160),
  param: text(40),
  def: z.number().gt(0).default(1),
  sp: moneySchema.nullable().default(null),
  slots: z.array(kitSlotInput).min(1).max(30),
});
export type KitInput = z.infer<typeof kitInput>;

export interface KitDto {
  id: string;
  code: string;
  barcode: string;
  name: string;
  param: string;
  def: number;
  sp: number | null;
  slots: KitSlot[];
}

// ---------- 🧪 العينات ----------

export const SAMPLE_STATUSES = ['out', 'returned', 'sold', 'lost'] as const;
export const sampleInput = z.object({
  productId: z.string().max(64).optional(),
  productName: z.string().trim().min(1, 'اكتب الصنف').max(200),
  qty: positiveQty.default(1),
  customer: text(120),
  date: isoDateSchema.optional(),
  givenBy: text(80),
});
export type SampleInput = z.infer<typeof sampleInput>;
export const sampleStatusInput = z.object({ status: z.enum(['returned', 'sold', 'lost']) });

export interface SampleDto {
  id: string;
  productId: string | null;
  productName: string;
  qty: number;
  customer: string;
  date: string;
  givenBy: string;
  status: (typeof SAMPLE_STATUSES)[number];
  invoiceId: string | null;
  createdAt: string;
}

export interface SamplesDto {
  on: boolean;
  samples: SampleDto[];
}

// ---------- 🔎 مطلوب ومش عندنا ----------

export const wantedInput = z.object({
  descr: z.string().trim().min(1, 'اكتب القطعة').max(500),
  thumb: z.string().max(400_000).optional(),
  source: text(40),
  phone,
});
export type WantedInput = z.infer<typeof wantedInput>;

export interface WantedDto {
  id: string;
  descr: string;
  thumb: string | null;
  source: string;
  phone: string;
  byName: string;
  createdAt: string;
}

