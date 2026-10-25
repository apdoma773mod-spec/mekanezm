import type { FastifyRequest } from 'fastify';
import type { Role } from '@prisma/client';
import { currentUser } from '../plugins/auth.js';

/** Who is doing a write, for audit rows and permission decisions inside services. */
export interface Actor {
  id: string;
  role: Role;
  ip: string | null;
}

export function actorOf(request: FastifyRequest): Actor {
  const u = currentUser(request);
  return { id: u.id, role: u.role, ip: request.ip ?? null };
}

export const isAdmin = (a: Pick<Actor, 'role'>) => a.role === 'ADMIN';
