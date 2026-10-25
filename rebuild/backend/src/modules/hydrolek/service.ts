import { randomUUID } from 'node:crypto';
import type { Contract, Prisma, PrismaClient } from '@prisma/client';
import {
  DEFAULT_CO_IDENT,
  PARTY,
  type AlertsConfig,
  type CoIdent,
  type ContractDto,
  type HyRules,
  type HyToday,
  type OutboundDto,
  type PartnerDto,
  type PartnersBoard,
  type VehicleDto,
  type VehicleMeta,
} from '@mk/shared';
import type { Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { addDays, dateToDay, dayToDate, todayYmd } from '../../lib/dates.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { money, num } from '../../lib/money.js';
import { actorName } from '../../lib/names.js';
import { withTx } from '../../lib/tx.js';
import { PaymentsService } from '../payments/service.js';
import { findOrCreateContact } from '../contacts/service.js';
import { ReportsService } from '../reports/service.js';

const r2 = (n: number) => Math.round(n * 100) / 100;
const RULES_KEY = 'hy_rules';
const DEFAULT_RULES: HyRules = { capFirst: true, afterVan: true, rent: 0, debtMax: 0, vanMin: {}, reps: [] };
const MT: Record<string, string> = { cash: 'كاش', transfer: 'تحويل', check: 'شيك' };

const ctDto = (c: Contract): ContractDto => ({
  id: c.id,
  no: c.no,
  client: c.client,
  phone: c.phone,
  kind: c.kind,
  title: c.title,
  total: num(c.total),
  start: c.start,
  due: c.due,
  status: c.status as ContractDto['status'],
  note: c.note,
  pays: c.pays as unknown as ContractDto['pays'],
  costs: c.costs as unknown as ContractDto['costs'],
  orders: c.orders as unknown as string[],
  hist: c.hist as unknown as ContractDto['hist'],
  byName: c.byName,
  createdAt: c.createdAt.toISOString(),
});

/** «🏢 الشركات»: partners, the car, contracts, WhatsApp settings and the companies' identity. */
export class HydrolekService {
  constructor(private readonly prisma: PrismaClient) {}

  private async setting<T extends object>(key: string, fallback: T): Promise<T> {
    const s = await this.prisma.setting.findUnique({ where: { key } });
    return s?.value && typeof s.value === 'object' ? ({ ...fallback, ...(s.value as object) } as T) : fallback;
  }
  private async putSetting(key: string, value: object, actor: Actor) {
    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue, updatedById: actor.id }, update: { value: value as Prisma.InputJsonValue, updatedById: actor.id } });
      await writeAudit(tx, { userId: actor.id, action: 'SETTING_UPDATE', entity: 'Setting', entityId: key, ip: actor.ip });
    });
  }

  rules() {
    return this.setting<HyRules>(RULES_KEY, DEFAULT_RULES);
  }
  async saveRules(patch: Partial<HyRules>, actor: Actor) {
    const v = { ...(await this.rules()), ...patch };
    await this.putSetting(RULES_KEY, v, actor);
    return v;
  }

  async ident(): Promise<Record<'MK' | 'HY', CoIdent>> {
    const v = await this.setting<Record<string, CoIdent>>('co_ident', {});
    return { MK: { ...DEFAULT_CO_IDENT.MK, ...(v.MK ?? {}) }, HY: { ...DEFAULT_CO_IDENT.HY, ...(v.HY ?? {}) } };
  }
  async saveIdent(v: Record<'MK' | 'HY', CoIdent>, actor: Actor) {
    await this.putSetting('co_ident', v, actor);
    return v;
  }

  // ---------- 🤝 partners ----------

  private async partners(): Promise<PartnerDto[]> {
    const rows = await this.prisma.partner.findMany({ include: { moves: { orderBy: { date: 'desc' } } }, orderBy: { createdAt: 'asc' } });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      share: num(p.share),
      note: p.note,
      moves: p.moves.map((m) => ({ id: m.id, kind: m.kind as 'capital', amount: num(m.amount), date: dateToDay(m.date), note: m.note, byName: m.byName })),
    }));
  }

  /** The old VIEW.pt + ptRules: everyone's capital, draws, share of the profit and what they can take now. */
  async board(): Promise<PartnersBoard> {
    const [P, rules, perf, vanExp, firstDay, fund, stock] = await Promise.all([
      this.partners(),
      this.rules(),
      new ReportsService(this.prisma).perf({ company: 'HY' }),
      this.prisma.expense.aggregate({ where: { deletedAt: null, company: 'HY', category: { startsWith: 'سيارة:' } }, _sum: { amount: true } }),
      this.prisma.vehicleLog.findFirst({ orderBy: { date: 'asc' }, select: { date: true } }),
      this.prisma.vanMove.findMany({ where: { funder: { not: '' } }, select: { funder: true, kind: true, qty: true, cost: true } }),
      this.prisma.vanStock.findMany({ where: { funder: { not: '' } } }),
    ]);
    const firstMove = await this.prisma.vanMove.findFirst({ orderBy: { date: 'asc' }, select: { date: true } });
    const d0 = [firstDay?.date, firstMove?.date].filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0];
    const now = dayToDate(todayYmd());
    const months = d0 ? Math.max(1, (now.getUTCFullYear() - d0.getUTCFullYear()) * 12 + now.getUTCMonth() - d0.getUTCMonth() + 1) : 0;
    const rent = rules.rent && months ? rules.rent * months : 0;
    const ve = num(vanExp._sum.amount);
    const pool = r2(perf.np + (rules.afterVan ? 0 : ve) - rent);
    const fv = (name: string, kinds: string[]) => r2(fund.filter((x) => x.funder === name && kinds.includes(x.kind)).reduce((a, x) => a + num(x.qty) * num(x.cost), 0));
    return {
      profit: perf.np,
      vanExpenses: ve,
      rent,
      pool,
      rules,
      partners: P.map((p) => {
        const s = (k: string) => r2(p.moves.filter((m) => m.kind === k).reduce((a, m) => a + m.amount, 0));
        const capital = s('capital');
        const draws = s('draw');
        const paid = s('profit');
        const shareValue = r2((pool * p.share) / 100);
        const onVan = r2(stock.filter((x) => x.funder === p.name).reduce((a, x) => a + num(x.qty) * num(x.cost), 0));
        const balance = r2(capital + shareValue - draws - paid);
        return {
          ...p,
          capital,
          draws,
          paid,
          shareValue,
          due: r2(shareValue - paid),
          loaded: fv(p.name, ['load', 'unload']),
          sold: -fv(p.name, ['sale']),
          adjusted: fv(p.name, ['adjust']),
          onVan,
          balance,
          available: rules.capFirst && onVan > 0.5 ? Math.max(0, r2(capital - onVan - draws - paid)) : Math.max(0, balance),
        };
      }),
    };
  }

  async savePartner(id: string | null, input: { name: string; phone: string; share: number; note: string }, actor: Actor) {
    const data = { ...input, share: money(input.share) };
    const p = id ? await this.prisma.partner.update({ where: { id }, data }) : await this.prisma.partner.create({ data });
    await this.prisma.auditLog.create({ data: { userId: actor.id, action: 'PARTNER_SAVE', entity: 'Partner', entityId: p.id, after: { name: p.name }, ip: actor.ip } });
    return p.id;
  }
  async deletePartner(id: string, actor: Actor) {
    await this.prisma.partner.delete({ where: { id } });
    await this.prisma.auditLog.create({ data: { userId: actor.id, action: 'PARTNER_SAVE', entity: 'Partner', entityId: id, after: { deleted: true }, ip: actor.ip } });
  }
  async addPartnerMove(partnerId: string, input: { kind: string; amount: number; date?: string; note: string }, actor: Actor) {
    const by = await actorName(this.prisma, actor);
    await this.prisma.partnerMove.create({ data: { partnerId, kind: input.kind, amount: money(input.amount), date: dayToDate(input.date ?? todayYmd()), note: input.note, byName: by } });
  }
  async deletePartnerMove(id: string) {
    await this.prisma.partnerMove.delete({ where: { id } });
  }

  // ---------- 🚗 the car ----------

  async vehicles(): Promise<VehicleDto[]> {
    const rows = await this.prisma.vehicle.findMany({ include: { log: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] } }, orderBy: { createdAt: 'asc' } });
    return rows.map((v) => ({
      id: v.id,
      name: v.name,
      plate: v.plate,
      meta: { owner: '', driver: '', lic: '', ins: '', nxt: '', nkm: 0, ...(v.meta as object) } as VehicleMeta,
      log: v.log.map((x) => ({ id: x.id, date: dateToDay(x.date), kind: x.kind, amount: num(x.amount), km: x.km ? num(x.km) : null, liters: x.liters ? num(x.liters) : null, note: x.note, byName: x.byName })),
    }));
  }
  async addVehicle(input: { name: string; plate: string }, actor: Actor) {
    const v = await this.prisma.vehicle.create({ data: input });
    await this.prisma.auditLog.create({ data: { userId: actor.id, action: 'VEHICLE_SAVE', entity: 'Vehicle', entityId: v.id, after: { name: v.name }, ip: actor.ip } });
    return v.id;
  }
  async saveVehicleMeta(id: string, meta: VehicleMeta) {
    await this.prisma.vehicle.update({ where: { id }, data: { meta } });
  }
  /** Each running cost is also a Hydrolek expense «سيارة: <kind>». */
  async addVehicleLog(vehicleId: string, input: { kind: string; amount: number; km: number | null; liters: number | null; date?: string; note: string }, actor: Actor) {
    const v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!v) throw notFound('السيارة دي مش موجودة');
    const by = await actorName(this.prisma, actor);
    const date = dayToDate(input.date ?? todayYmd());
    await withTx(this.prisma, async (tx) => {
      const e = await tx.expense.create({
        data: { category: `سيارة: ${input.kind}`, amount: money(input.amount), company: 'HY', date, note: `🚗 ${v.name}${input.note ? ` — ${input.note}` : ''}`, createdById: actor.id },
      });
      await tx.vehicleLog.create({
        data: { vehicleId, date, kind: input.kind, amount: money(input.amount), km: input.km, liters: input.liters, note: input.note, expenseId: e.id, byName: by },
      });
    });
  }
  async deleteVehicleLog(id: string) {
    await withTx(this.prisma, async (tx) => {
      const x = await tx.vehicleLog.findUnique({ where: { id } });
      if (!x) throw notFound();
      if (x.expenseId) await tx.expense.update({ where: { id: x.expenseId }, data: { deletedAt: new Date() } }).catch(() => undefined);
      await tx.vehicleLog.delete({ where: { id } });
    });
  }

  /** «⏰ قرّب ميعاد» / «⛔ فات ميعاد» for licence, insurance, service date and service km. */
  async carAlerts() {
    const V = await this.vehicles();
    const out: { t: string; d: number; late: boolean }[] = [];
    const t = dayToDate(todayYmd()).getTime();
    for (const v of V) {
      for (const [k, l] of [
        ['lic', 'رخصة'],
        ['ins', 'تأمين'],
        ['nxt', 'صيانة'],
      ] as const) {
        const d = v.meta[k];
        if (!d) continue;
        const days = Math.ceil((dayToDate(d).getTime() - t) / 86_400_000);
        if (days <= 30) out.push({ t: `${l} ${v.name}`, d: days, late: days < 0 });
      }
      const kms = v.log.filter((x) => x.km !== null).map((x) => x.km!);
      if (v.meta.nkm && kms.length && Math.max(...kms) >= v.meta.nkm - 200) out.push({ t: `صيانة بالكيلومتر ${v.name}`, d: 0, late: Math.max(...kms) >= v.meta.nkm });
    }
    return out;
  }

  // ---------- 📑 contracts ----------

  async contracts(): Promise<ContractDto[]> {
    return (await this.prisma.contract.findMany({ orderBy: { createdAt: 'desc' } })).map(ctDto);
  }

  /** A deposit «in the till» is a payment on the customer's Hydrolek account (deducted from a later invoice). */
  private async till(client: string, phone: string, amount: number, note: string, actor: Actor) {
    const c = await withTx(this.prisma, (tx) => findOrCreateContact(tx, 'CUSTOMER', { name: client, phone, address: '' }, actor));
    await new PaymentsService(this.prisma).create({ contactId: c.id, amount, method: 'CASH', company: 'HY', note }, actor);
  }

  async createContract(
    input: { client: string; phone: string; kind: string; title: string; total: number; deposit: number; method: string; record: boolean; start: string; due: string; note: string },
    actor: Actor,
  ): Promise<ContractDto> {
    if (!(input.total > 0) && !(input.deposit > 0)) throw badRequest('اكتب قيمة العقد أو العربون');
    const by = await actorName(this.prisma, actor);
    const n = (await this.prisma.contract.count()) + 1;
    const no = `CT-${String(n).padStart(3, '0')}`;
    if (input.deposit > 0 && input.record) await this.till(input.client, input.phone, input.deposit, `مقدم عقد ${no} — ${input.title.slice(0, 40)} (${MT[input.method]})`, actor);
    const at = new Date().toISOString();
    const c = await this.prisma.contract.create({
      data: {
        no,
        client: input.client,
        phone: input.phone,
        kind: input.kind,
        title: input.title,
        total: money(input.total || input.deposit),
        start: input.start || todayYmd(),
        due: input.due,
        note: input.note,
        pays: input.deposit > 0 ? [{ id: randomUUID(), date: todayYmd(), amt: input.deposit, m: input.method, note: 'مقدم عند التعاقد', rec: input.record, by }] : [],
        costs: [],
        orders: [],
        hist: [{ at, by, txt: 'اتفتح العقد' }],
        byName: by,
      },
    });
    await this.prisma.auditLog.create({ data: { userId: actor.id, action: 'CONTRACT_SAVE', entity: 'Contract', entityId: c.id, after: { no, client: c.client }, ip: actor.ip } });
    return ctDto(c);
  }

  async contractAction(
    id: string,
    a:
      | { do: 'pay'; amount: number; method: string; note: string; record: boolean }
      | { do: 'cost'; amount: number; desc: string }
      | { do: 'link'; order: string }
      | { do: 'status'; status: string }
      | { do: 'due'; due: string },
    actor: Actor,
  ): Promise<ContractDto> {
    const c = await this.prisma.contract.findUnique({ where: { id } });
    if (!c) throw notFound('العقد ده مش موجود');
    const by = await actorName(this.prisma, actor);
    const d = ctDto(c);
    const hist = (txt: string) => [...d.hist, { at: new Date().toISOString(), by, txt }].slice(-60);
    const data: Prisma.ContractUpdateInput = {};
    if (a.do === 'pay') {
      if (a.record) await this.till(c.client, c.phone, a.amount, `دفعة عقد ${c.no} (${MT[a.method]})${a.note ? ` — ${a.note}` : ''}`, actor);
      data.pays = [...d.pays, { id: randomUUID(), date: todayYmd(), amt: a.amount, m: a.method, note: a.note, rec: a.record, by }];
      data.hist = hist(`دفعة ${a.amount} (${MT[a.method]})`);
    } else if (a.do === 'cost') {
      data.costs = [...d.costs, { id: randomUUID(), date: todayYmd(), amt: a.amount, desc: a.desc, by }];
      data.hist = hist(`تكلفة ${a.amount}${a.desc ? ` — ${a.desc}` : ''}`);
    } else if (a.do === 'link') {
      data.orders = [...d.orders, a.order];
      data.hist = hist(`اتربط أوردر ${a.order}`);
    } else if (a.do === 'status') {
      data.status = a.status;
      data.hist = hist(`الحالة: ${{ open: 'مفتوح', work: 'جاري الشغل', done: 'اتسلم / خلص', cancel: 'ملغي' }[a.status] ?? a.status}`);
    } else {
      data.due = a.due;
      data.hist = hist(`ميعاد التسليم: ${a.due || '—'}`);
    }
    const row = await this.prisma.contract.update({ where: { id }, data });
    await this.prisma.auditLog.create({ data: { userId: actor.id, action: 'CONTRACT_SAVE', entity: 'Contract', entityId: id, after: { do: a.do }, ip: actor.ip } });
    return ctDto(row);
  }

  // ---------- 📲 WhatsApp ----------

  alerts() {
    return this.setting<AlertsConfig>('alerts', { on: true, to: ['201119199659'], types: {} });
  }
  async saveAlerts(v: AlertsConfig, actor: Actor) {
    await this.putSetting('alerts', v, actor);
    return v;
  }
  async outbox(): Promise<OutboundDto[]> {
    const rows = await this.prisma.outboundMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 15 });
    return rows.map((x) => ({ id: x.id, toPhone: x.toPhone, body: x.body, status: x.status as OutboundDto['status'], err: x.err, byName: x.byName, createdAt: x.createdAt.toISOString() }));
  }
  /** Queues a message for the shop PC's WhatsApp bridge (it sends from the company number). */
  async queue(to: string, body: string, byName: string, actor: Actor) {
    let d = to.replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('0')) d = `2${d}`;
    if (d.length < 11) throw badRequest(`الرقم مش صح: ${to}`);
    const m = await this.prisma.outboundMessage.create({ data: { toPhone: d, body, byName: byName || (await actorName(this.prisma, actor)) } });
    await this.prisma.auditLog.create({ data: { userId: actor.id, action: 'WA_SEND', entity: 'OutboundMessage', entityId: m.id, after: { to: d }, ip: actor.ip } });
    return m.id;
  }

  // ---------- the chips on top ----------

  async today(): Promise<HyToday> {
    const t = todayYmd();
    const [sales, open, moved, closed, c1, c2, contracts, alerts] = await Promise.all([
      this.prisma.invoice.aggregate({ where: { kind: 'SALE', status: 'ACTIVE', company: 'HY', ic: null, date: dayToDate(t) }, _sum: { total: true }, _count: true }),
      this.prisma.fieldOrder.findMany({ where: { sentAt: { not: null }, status: { in: ['new', 'doing'] } }, select: { lines: true } }),
      this.prisma.vanMove.count({ where: { date: dayToDate(t) } }),
      this.prisma.vanClose.count({ where: { date: dayToDate(t), closed: true } }),
      this.prisma.contact.findFirst({ where: { name: PARTY.HY, type: 'CUSTOMER' }, select: { balance: true } }),
      this.prisma.contact.findFirst({ where: { name: PARTY.MK, type: 'CUSTOMER' }, select: { balance: true } }),
      this.prisma.contract.findMany({ where: { status: { in: ['open', 'work'] }, due: { not: '', lt: t } }, select: { id: true } }),
      this.carAlerts(),
    ]);
    const openRequests = open.reduce((a, o) => a + ((o.lines as unknown as { r: number; st: string }[]) ?? []).filter((l) => l.r > 0 && l.st !== 'done' && l.st !== 'cancel').length, 0);
    return {
      salesToday: num(sales._sum.total),
      salesCount: sales._count,
      openRequests,
      closePending: moved > 0 && closed === 0,
      net: r2((c1 ? num(c1.balance) : 0) - (c2 ? num(c2.balance) : 0)),
      lateContracts: contracts.length,
      carAlerts: alerts.length,
    };
  }

  dayAgo(n: number) {
    return addDays(todayYmd(), -n);
  }
}
