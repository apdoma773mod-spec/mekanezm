import { z } from 'zod';
import { isoDateSchema } from './common.js';

/** The old mkReports catalogue, same ids, groups, icons, titles and descriptions, in the same order. */
export const REPORTS = [
  { id: 'perf', g: 'المبيعات والأرباح', i: '📈', t: 'ملخص الأداء', d: 'مبيعات وتكلفة وأرباح ومصروفات' },
  { id: 'cmp', g: 'المبيعات والأرباح', i: '⚖️', t: 'مقارنة بالفترة اللي قبلها', d: 'الفترة الحالية مقابل نفس المدة السابقة' },
  { id: 'daily', g: 'المبيعات والأرباح', i: '📅', t: 'المبيعات اليومية', d: 'كل يوم: فواتير ومبيعات وربح وتحصيل' },
  { id: 'byItem', g: 'المبيعات والأرباح', i: '📦', t: 'المبيعات بالصنف', d: 'كمية وإجمالي وربح كل صنف' },
  { id: 'margin', g: 'المبيعات والأرباح', i: '💎', t: 'هامش الربح بالصنف', d: 'مين بيكسّب ومين خسران أو هامشه ضعيف' },
  { id: 'byCat', g: 'المبيعات والأرباح', i: '🗂️', t: 'المبيعات بالتصنيف', d: 'مبيعات وأرباح كل تصنيف' },
  { id: 'byCust', g: 'العملاء والديون', i: '👥', t: 'المبيعات بالعميل', d: 'فواتير وإجمالي وربح ومتبقي كل عميل' },
  { id: 'invSales', g: 'المبيعات والأرباح', i: '🧾', t: 'فواتير البيع', d: 'قائمة الفواتير بالحالة (مدفوعة / متبقي)' },
  { id: 'returns', g: 'المبيعات والأرباح', i: '↩️', t: 'المرتجعات', d: 'مرتجعات البيع والشراء بالتفصيل' },
  { id: 'purSup', g: 'المشتريات', i: '🚚', t: 'المشتريات بالمورد', d: 'كل مورد: فواتير وإجمالي ومدفوع ومتبقي' },
  { id: 'purItem', g: 'المشتريات', i: '🛒', t: 'المشتريات بالصنف', d: 'كمية وتكلفة كل صنف اشتريته وآخر سعر' },
  { id: 'invPur', g: 'المشتريات', i: '🧾', t: 'فواتير الشراء', d: 'قائمة فواتير الشراء بالحالة' },
  { id: 'expCat', g: 'المصروفات', i: '💸', t: 'المصروفات بالبند', d: 'مصروفات كل بند ونسبته' },
  { id: 'expList', g: 'المصروفات', i: '📝', t: 'المصروفات تفصيلي', d: 'كل مصروف بتاريخه وبيانه' },
  { id: 'stockVal', g: 'المخزون', i: '🏬', t: 'قيمة المخزون', d: 'كل صنف: كمية × تكلفة وربح متوقع' },
  { id: 'stockCat', g: 'المخزون', i: '🗂️', t: 'المخزون بالتصنيف', d: 'قيمة وكمية كل تصنيف' },
  { id: 'stockLow', g: 'المخزون', i: '⚠️', t: 'نواقص المخزون', d: 'أصناف وصلت لحد الطلب أو خلصت' },
  { id: 'stockDead', g: 'المخزون', i: '🧊', t: 'الأصناف الراكدة', d: 'عليها رصيد ومتباعتش من ٦٠ يوم أو أكتر' },
  { id: 'stockMove', g: 'المخزون', i: '🔄', t: 'حركة الأصناف', d: 'مشتريات ومبيعات ومرتجعات كل صنف في الفترة' },
  { id: 'debtC', g: 'العملاء والديون', i: '💰', t: 'ديون العملاء وأعمارها', d: 'مين عليه كام ومن إمتى (أعمار الديون)' },
  { id: 'debtS', g: 'العملاء والديون', i: '🏭', t: 'مستحقات الموردين', d: 'اللي عليك للموردين' },
  { id: 'cash', g: 'الحسابات', i: '🏦', t: 'حركة الخزنة', d: 'داخل وخارج ورصيد كل يوم' },
  { id: 'dailyHour', g: 'المبيعات والأرباح', i: '🗓️', t: 'المبيعات بيوم الأسبوع', d: 'أنهي أيام الأسبوع الأقوى' },
] as const;

export type ReportId = (typeof REPORTS)[number]['id'];
export const REPORT_IDS = REPORTS.map((r) => r.id) as [ReportId, ...ReportId[]];

export const reportQuery = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
export const reportParams = z.object({ id: z.enum(REPORT_IDS) });

/** Column types as in the old system: s text, n number, m money, p percent, d day (YYYY-MM-DD). */
export type ReportColType = 's' | 'n' | 'm' | 'p' | 'd';
export type ReportCell = string | number;
export type ReportTone = 'g' | 'r' | 'y' | '';

export interface ReportRow {
  c: ReportCell[];
  /** Where a tap goes: an invoice, a contact file. */
  go?: { kind: 'invoice'; id: string } | { kind: 'contact'; id: string };
  /** Row highlight: r = loss, y = weak margin. */
  warn?: ReportTone;
}

export interface ReportResult {
  id: ReportId;
  from: string | null;
  to: string | null;
  /** Summary boxes: label, value, how to format the value, colour. */
  sum: { l: string; v: ReportCell; t: ReportColType; c?: ReportTone }[];
  cols: { h: string; t: ReportColType }[];
  rows: ReportRow[];
  chart?: [string, number][];
  foot?: ReportCell[];
  nosort?: boolean;
  nofilt?: boolean;
  /** Default sort: column and direction (1 up, -1 down). */
  dsort?: [number, 1 | -1];
}

/** Headline numbers for the reports home (صافي المبيعات / مجمل الربح / صافي الربح). */
export interface ReportHeadline {
  net: number;
  gross: number;
  np: number;
}

export interface PeriodFigures {
  sales: number;
  purch: number;
  ret: number;
  exp: number;
  gross: number;
  net: number;
}
export interface ReportPeriods {
  day: PeriodFigures;
  month: PeriodFigures;
  year: PeriodFigures;
  all: PeriodFigures;
}
