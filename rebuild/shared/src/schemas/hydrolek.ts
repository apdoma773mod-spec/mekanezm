import { z } from 'zod';
import { normalizeDigits } from '../digits.js';
import { isoDateSchema, moneySchema, positiveQty } from './common.js';

const text = (max: number) => z.string().trim().max(max).default('');
const phone = z
  .string()
  .transform((v) => normalizeDigits(v).trim())
  .pipe(z.string().max(30))
  .default('');
const num = z.coerce.number().finite();

/** The two companies' names as the old CO_NAME, and the contacts that stand for them in each other's books. */
export const CO_NAME = { MK: 'ميكانيزم', HY: 'هيدرولك' } as const;
export const PARTY = { MK: 'ميكانيزم (الشركة الأم)', HY: 'هيدرولك (شركة تابعة)' } as const;

// ---------- 🔁 التعامل بين الشركتين ----------

export const icTransferInput = z.object({
  seller: z.enum(['MK', 'HY']),
  lines: z
    .array(z.object({ productId: z.string().min(1).max(64), qty: positiveQty, price: moneySchema }))
    .min(1, 'ضيف صنف بكمية')
    .max(200),
  /** Paid now in cash; 0 = on the account between the two companies. */
  paid: moneySchema.default(0),
  note: text(300),
  /** The seller's stock is short and the user confirmed going negative. */
  force: z.boolean().default(false),
});
export type IcTransferInput = z.infer<typeof icTransferInput>;

export interface IcTransferResult {
  sale: { id: string; no: string };
  buy: { id: string; no: string };
  /** The buyer's product for each line, in order (created when it didn't exist). */
  buyerProducts: string[];
}

export interface IcDeal {
  ref: string;
  no: string;
  date: string;
  seller: 'MK' | 'HY';
  buyer: 'MK' | 'HY';
  items: string[];
  total: number;
  remaining: number;
  saleId: string;
  buyId: string | null;
}

export interface IcAccount {
  hyTook: number;
  mkTook: number;
  hyOwes: number;
  mkOwes: number;
  net: number;
  /** Statement rows: positive = Hydrolek owes Mekanizm. */
  rows: { d: string; t: string; n: string; v: number; b: number }[];
  payments: { id: string; date: string; name: string; company: 'MK' | 'HY'; note: string; amount: number }[];
}

export const icSettleInput = z.object({
  dir: z.enum(['h2m', 'm2h']),
  amount: moneySchema.pipe(z.number().gt(0, 'اكتب المبلغ')),
  note: text(200),
});

// ---------- 🤝 الشركاء ----------

export const partnerInput = z.object({
  name: z.string().trim().min(1, 'اكتب اسم الشريك').max(120),
  phone,
  share: num.min(0).max(100).default(0),
  note: text(500),
});
export const partnerMoveInput = z.object({
  kind: z.enum(['capital', 'draw', 'profit']),
  amount: moneySchema.pipe(z.number().gt(0, 'اكتب المبلغ')),
  date: isoDateSchema.optional(),
  note: text(300),
});

export interface PartnerDto {
  id: string;
  name: string;
  phone: string;
  share: number;
  note: string;
  moves: { id: string; kind: 'capital' | 'draw' | 'profit'; amount: number; date: string; note: string; byName: string }[];
}

export interface HyRules {
  capFirst: boolean;
  afterVan: boolean;
  rent: number;
  debtMax: number;
  vanMin: Record<string, number>;
  reps: { n: string; p: string }[];
}
export const hyRulesInput = z.object({
  capFirst: z.boolean(),
  afterVan: z.boolean(),
  rent: num.min(0),
  debtMax: num.min(0),
  vanMin: z.record(z.string(), num.min(0)),
  reps: z.array(z.object({ n: z.string().trim().min(1).max(80), p: z.string().trim().max(30) })).max(50),
});

export interface PartnersBoard {
  /** Hydrolek's net profit over all time. */
  profit: number;
  vanExpenses: number;
  rent: number;
  /** What is shared by percentage after the rules. */
  pool: number;
  rules: HyRules;
  partners: (PartnerDto & {
    capital: number;
    draws: number;
    paid: number;
    shareValue: number;
    due: number;
    loaded: number;
    sold: number;
    adjusted: number;
    onVan: number;
    balance: number;
    available: number;
  })[];
}

// ---------- 🚗 السيارة ----------

export const VEHICLE_KINDS = ['بنزين', 'زيت وصيانة', 'إطارات', 'غسيل', 'سواق / مرتب', 'غرامة', 'رخصة وتأمين', 'أخرى'] as const;

export const vehicleInput = z.object({ name: z.string().trim().min(1, 'اكتب اسم السيارة').max(120), plate: text(40) });
export const vehicleMetaInput = z.object({
  owner: text(80),
  driver: text(80),
  lic: z.string().max(10).default(''),
  ins: z.string().max(10).default(''),
  nxt: z.string().max(10).default(''),
  nkm: num.min(0).default(0),
});
export type VehicleMeta = z.infer<typeof vehicleMetaInput>;
export const vehicleLogInput = z.object({
  kind: z.enum(VEHICLE_KINDS),
  amount: moneySchema.pipe(z.number().gt(0, 'اكتب المبلغ')),
  km: num.min(0).nullable().default(null),
  liters: num.min(0).nullable().default(null),
  date: isoDateSchema.optional(),
  note: text(300),
});

export interface VehicleDto {
  id: string;
  name: string;
  plate: string;
  meta: VehicleMeta;
  log: { id: string; date: string; kind: string; amount: number; km: number | null; liters: number | null; note: string; byName: string }[];
}

// ---------- ⚡ الأوردرات الميدانية ----------

export const LINE_STATES = ['new', 'prep', 'short', 'ready', 'sent', 'done', 'hold', 'cancel'] as const;
export type LineState = (typeof LINE_STATES)[number];
export const PRIORITIES = ['urgent', 'today', 'normal'] as const;

export interface FieldLine {
  pid: string;
  n: string;
  q: number;
  pr: number;
  /** Company whose stock the product is in. */
  wh: 'MK' | 'HY' | '';
  nw?: boolean;
  d?: string;
  img?: string;
  pri?: (typeof PRIORITIES)[number];
  st: LineState;
  /** Sold from the van right now. */
  s: number;
  /** Requested from the Mekanizm store. */
  r: number;
  sd?: boolean;
  inv?: string;
  dm?: string;
  dd?: string;
  h?: { st: LineState; by: string; at: string }[];
  /** Listing only: what Mekanizm's store has of it now (null for new items). */
  ms?: number;
}

export const fieldOrderInput = z.object({
  customer: z.string().trim().min(1, 'اكتب اسم العميل').max(120),
  phone,
  addr: text(300),
  eta: text(60),
  /** credit | cash | part — on what is sold from the van now. */
  pay: z.enum(['credit', 'cash', 'part']).default('credit'),
  paid: moneySchema.default(0),
  note: text(300),
  vehicleId: z.string().max(64).default(''),
  lines: z
    .array(
      z.object({
        productId: z.string().max(64).default(''),
        name: z.string().trim().min(1).max(200),
        qty: positiveQty,
        price: moneySchema.default(0),
        nw: z.boolean().default(false),
        d: text(500),
        img: z.string().max(200_000).default(''),
        pri: z.enum(PRIORITIES).default('normal'),
      }),
    )
    .min(1, 'ضيف صنف')
    .max(100),
});
export type FieldOrderInput = z.infer<typeof fieldOrderInput>;

export interface FieldOrderDto {
  id: string;
  no: string;
  company: 'MK' | 'HY';
  date: string;
  customer: string;
  phone: string;
  addr: string;
  eta: string;
  total: number;
  note: string;
  rep: string;
  lines: FieldLine[];
  status: 'new' | 'doing' | 'done' | 'cancel';
  sentAt: string | null;
  invoiceNo: string;
  createdAt: string;
}

export const lineStateInput = z.object({ st: z.enum(LINE_STATES), dm: text(40), dd: z.string().max(10).default('') });
export const fieldReplyInput = z.object({ eta: text(60), note: text(300) });
export const fieldInvoiceInput = z.object({ paid: moneySchema.default(0) });

// ---------- 🚚 العربية + 🧾 التصفية ----------

export interface VanStockRow {
  productId: string;
  name: string;
  qty: number;
  cost: number;
  funder: string;
}

export interface VanState {
  stock: VanStockRow[];
  /** Today's loads. */
  loadsToday: { name: string; qty: number; src: string; funder: string; ref: string }[];
  /** The last day that had loads, for «↻ تحميل نفس أمس». */
  lastLoad: { date: string; lines: { productId: string; name: string; qty: number; src: string; funder: string; cost: number }[] } | null;
  totals: { mkQty: number; mkValue: number; hyQty: number; hyValue: number; vanQty: number; vanValue: number };
}

export const vanLoadInput = z.object({
  vehicleId: z.string().max(64).default(''),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
        qty: positiveQty,
        /** mk = transfer from Mekanizm's stock; hy = Hydrolek's own goods; p:<partnerId> = bought with a partner's capital. */
        src: z.string().max(80),
        price: moneySchema.default(0),
      }),
    )
    .min(1, 'ضيف صنف بكمية')
    .max(200),
});

export interface CloseRow {
  pid: string;
  n: string;
  op: number;
  ld: number;
  sd: number;
  rt: number;
  ot: number;
  ex: number;
  cost: number;
}

export interface CloseDto {
  date: string;
  vehicleId: string;
  record: {
    id: string;
    closed: boolean;
    cash: number;
    credit: number;
    expenses: number;
    expectedCash: number;
    handed: number;
    diffValue: number;
    note: string;
    data: { items?: { pid: string; n: string; ex: number; cnt: number; why: string; back: boolean; cost: number }[]; sales?: number };
    byName: string;
    closedAt: string | null;
    reopenedBy: string;
  } | null;
  rows: CloseRow[];
  sales: number;
  cash: number;
  credit: number;
  collections: number;
  expenses: number;
  expected: number;
  invoices: number;
  history: { date: string; cash: number; ok: boolean }[];
}

export const vanCloseInput = z.object({
  date: isoDateSchema,
  vehicleId: z.string().max(64).default(''),
  handed: moneySchema.nullable().default(null),
  note: text(300),
  items: z.array(z.object({ pid: z.string().min(1).max(64), cnt: z.number().min(0, 'الجرد مايبقاش بالسالب'), why: text(200), back: z.boolean().default(false) })).max(500),
});

// ---------- 📑 العقود والعرابين ----------

export const CONTRACT_KINDS = ['عقد شغل', 'عربون', 'مقدم'] as const;
export const contractInput = z.object({
  client: z.string().trim().min(1, 'اكتب اسم العميل').max(120),
  phone,
  kind: z.enum(CONTRACT_KINDS).default('عقد شغل'),
  title: z.string().trim().min(1, 'اكتب الشغل المطلوب').max(2000),
  total: moneySchema.default(0),
  deposit: moneySchema.default(0),
  method: z.enum(['cash', 'transfer', 'check']).default('cash'),
  record: z.boolean().default(true),
  start: z.string().max(10).default(''),
  due: z.string().max(10).default(''),
  note: text(1000),
});
export const contractActionInput = z.discriminatedUnion('do', [
  z.object({ do: z.literal('pay'), amount: moneySchema.pipe(z.number().gt(0, 'اكتب المبلغ')), method: z.enum(['cash', 'transfer', 'check']), note: text(200), record: z.boolean() }),
  z.object({ do: z.literal('cost'), amount: moneySchema.pipe(z.number().gt(0, 'اكتب مبلغ التكلفة')), desc: text(200) }),
  z.object({ do: z.literal('link'), order: z.string().trim().min(1, 'اختار الأوردر').max(40) }),
  z.object({ do: z.literal('status'), status: z.enum(['open', 'work', 'done', 'cancel']) }),
  z.object({ do: z.literal('due'), due: z.string().max(10) }),
]);

export interface ContractDto {
  id: string;
  no: string;
  client: string;
  phone: string;
  kind: string;
  title: string;
  total: number;
  start: string;
  due: string;
  status: 'open' | 'work' | 'done' | 'cancel';
  note: string;
  pays: { id: string; date: string; amt: number; m: string; note: string; rec: boolean; by: string }[];
  costs: { id: string; date: string; amt: number; desc: string; by: string }[];
  orders: string[];
  hist: { at: string; by: string; txt: string }[];
  byName: string;
  createdAt: string;
}

// ---------- 📲 الواتساب + 🎨 الهوية ----------

export interface AlertsConfig {
  on: boolean;
  to: string[];
  types: Record<string, boolean>;
}
export const alertsInput = z.object({ on: z.boolean(), to: z.array(z.string().trim().min(11).max(15)).min(1, 'اكتب رقم واحد على الأقل').max(20), types: z.record(z.string(), z.boolean()) });
export const waSendInput = z.object({ to: z.string().trim().min(11).max(15), body: z.string().trim().min(1, 'اكتب الرسالة').max(4000), byName: text(120) });

export interface OutboundDto {
  id: string;
  toPhone: string;
  body: string;
  status: 'queued' | 'sent' | 'failed';
  err: string;
  byName: string;
  createdAt: string;
}

export interface CoIdent {
  name: string;
  phone: string;
  wa: string;
  addr: string;
  tax: string;
  foot: string;
  color: string;
}
export const coIdentInput = z.object({
  MK: z.object({ name: text(120), phone: text(40), wa: text(40), addr: text(300), tax: text(40), foot: text(200), color: z.string().regex(/^#[0-9a-f]{6}$/i) }),
  HY: z.object({ name: text(120), phone: text(40), wa: text(40), addr: text(300), tax: text(40), foot: text(200), color: z.string().regex(/^#[0-9a-f]{6}$/i) }),
});
export const DEFAULT_CO_IDENT: Record<'MK' | 'HY', CoIdent> = {
  MK: { name: 'ميكانيزم', phone: '', wa: '', addr: '', tax: '', foot: '', color: '#1d3fb8' },
  HY: { name: 'هيدرولك', phone: '', wa: '', addr: '', tax: '', foot: '', color: '#d97706' },
};

/** Chips at the top of «🏢 الشركات» (the old todayCard). */
export interface HyToday {
  salesToday: number;
  salesCount: number;
  openRequests: number;
  closePending: boolean;
  net: number;
  lateContracts: number;
  carAlerts: number;
}
