import type { User } from '@prisma/client';
import type { PublicUser } from '@mk/shared';

/** The only shape a user leaves the API in — never includes the password hash. */
export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    email: u.email,
    role: u.role,
    active: u.active,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  };
}
