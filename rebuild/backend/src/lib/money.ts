import { Prisma } from '@prisma/client';

export type Dec = Prisma.Decimal;
export const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
export const ZERO = D(0);

/** Money is always rounded half-up to 2 decimals before it is stored. */
export const money = (v: Prisma.Decimal.Value) => D(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export const qty = (v: Prisma.Decimal.Value) => D(v).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);

/** Decimal → number for JSON responses (values are already rounded to 2–3 places). */
export const num = (v: Prisma.Decimal | null | undefined): number => (v == null ? 0 : v.toNumber());

export const sum = (values: Prisma.Decimal[]) => values.reduce((a, b) => a.plus(b), ZERO);
