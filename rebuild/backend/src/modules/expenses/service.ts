import type { Expense, Prisma, PrismaClient } from '@prisma/client';
import type { ExpenseDto, ExpenseInput, ListExpensesQuery, Paginated, UpdateExpenseInput } from '@mk/shared';
import type { Actor } from '../../lib/actor.js';
import { writeAudit } from '../../lib/audit.js';
import { dateToDay, dayRange, dayToDate, todayYmd } from '../../lib/dates.js';
import { notFound } from '../../lib/errors.js';
import { num } from '../../lib/money.js';
import { withTx } from '../../lib/tx.js';

type ExpenseWithUser = Expense & { createdBy: { id: string; name: string } | null };

const INCLUDE = { createdBy: { select: { id: true, name: true } } } satisfies Prisma.ExpenseInclude;

function toDto(e: ExpenseWithUser): ExpenseDto {
  return {
    id: e.id,
    category: e.category,
    amount: num(e.amount),
    method: e.method,
    company: e.company,
    date: dateToDay(e.date),
    note: e.note,
    createdBy: e.createdBy,
    createdAt: e.createdAt.toISOString(),
  };
}

const snapshot = (e: Expense) => ({ category: e.category, amount: num(e.amount), date: dateToDay(e.date), note: e.note });

async function liveExpense(tx: Prisma.TransactionClient, id: string) {
  const e = await tx.expense.findUnique({ where: { id } });
  if (!e || e.deletedAt) throw notFound('المصروف ده مش موجود');
  return e;
}

export class ExpensesService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: ListExpensesQuery): Promise<Paginated<ExpenseDto>> {
    const q = query.q?.trim();
    const where: Prisma.ExpenseWhereInput = {
      deletedAt: null,
      ...(query.category ? { category: query.category } : {}),
      ...(query.company ? { company: query.company } : {}),
      ...(query.from || query.to ? { date: dayRange(query.from, query.to) } : {}),
      ...(q ? { OR: [{ note: { contains: q, mode: 'insensitive' } }, { category: { contains: q, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.expense.count({ where }),
    ]);
    return { items: rows.map(toDto), total, page: query.page, pageSize: query.pageSize };
  }

  async categories(): Promise<string[]> {
    const rows = await this.prisma.expense.findMany({
      where: { deletedAt: null },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category);
  }

  async create(input: ExpenseInput, actor: Actor): Promise<ExpenseDto> {
    const id = await withTx(this.prisma, async (tx) => {
      const e = await tx.expense.create({
        data: { ...input, date: dayToDate(input.date ?? todayYmd()), createdById: actor.id },
      });
      await writeAudit(tx, { userId: actor.id, action: 'EXPENSE_CREATE', entity: 'Expense', entityId: e.id, after: snapshot(e), ip: actor.ip });
      return e.id;
    });
    return toDto(await this.prisma.expense.findUniqueOrThrow({ where: { id }, include: INCLUDE }));
  }

  async update(id: string, input: UpdateExpenseInput, actor: Actor): Promise<ExpenseDto> {
    await withTx(this.prisma, async (tx) => {
      const before = await liveExpense(tx, id);
      const { date, ...rest } = input;
      const after = await tx.expense.update({
        where: { id },
        data: { ...rest, ...(date ? { date: dayToDate(date) } : {}) },
      });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'EXPENSE_UPDATE',
        entity: 'Expense',
        entityId: id,
        before: snapshot(before),
        after: snapshot(after),
        ip: actor.ip,
      });
    });
    return toDto(await this.prisma.expense.findUniqueOrThrow({ where: { id }, include: INCLUDE }));
  }

  async remove(id: string, actor: Actor): Promise<void> {
    await withTx(this.prisma, async (tx) => {
      const before = await liveExpense(tx, id);
      await tx.expense.update({ where: { id }, data: { deletedAt: new Date() } });
      await writeAudit(tx, { userId: actor.id, action: 'EXPENSE_DELETE', entity: 'Expense', entityId: id, before: snapshot(before), ip: actor.ip });
    });
  }
}
