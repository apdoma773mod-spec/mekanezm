import { z } from 'zod';
import { AUDIT_ACTIONS } from '../enums.js';
import { paginationQuery } from './common.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'التاريخ لازم يكون YYYY-MM-DD');

export const listAuditQuery = paginationQuery.extend({
  action: z.enum(AUDIT_ACTIONS).optional(),
  userId: z.string().max(64).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type ListAuditQuery = z.infer<typeof listAuditQuery>;

export interface AuditEntry {
  id: string;
  action: (typeof AUDIT_ACTIONS)[number];
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
}
