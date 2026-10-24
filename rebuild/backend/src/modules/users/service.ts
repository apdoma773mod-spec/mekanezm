import type { Prisma, PrismaClient, User } from '@prisma/client';
import type {
  CreateUserInput,
  ListUsersQuery,
  Paginated,
  PublicUser,
  ResetPasswordInput,
  UpdateUserInput,
} from '@mk/shared';
import { writeAudit } from '../../lib/audit.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { hashPassword } from '../../lib/password.js';
import { toPublicUser } from '../../lib/serialize.js';
import { withTx } from '../../lib/tx.js';

export interface Actor {
  id: string;
  ip: string | null;
}

async function getOrThrow(tx: Prisma.TransactionClient, id: string): Promise<User> {
  const user = await tx.user.findUnique({ where: { id } });
  if (!user) throw notFound('المستخدم ده مش موجود');
  return user;
}

export class UsersService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: ListUsersQuery): Promise<Paginated<PublicUser>> {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { phone: { contains: query.q } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map(toPublicUser), total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string): Promise<PublicUser> {
    return toPublicUser(await getOrThrow(this.prisma, id));
  }

  async create(input: CreateUserInput, actor: Actor): Promise<PublicUser> {
    const passwordHash = await hashPassword(input.password);
    const user = await withTx(this.prisma, async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name,
          phone: input.phone,
          email: input.email ?? null,
          role: input.role,
          passwordHash,
        },
      });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'USER_CREATE',
        entity: 'User',
        entityId: created.id,
        after: toPublicUser(created),
        ip: actor.ip,
      });
      return created;
    });
    return toPublicUser(user);
  }

  async update(id: string, input: UpdateUserInput, actor: Actor): Promise<PublicUser> {
    const user = await withTx(this.prisma, async (tx) => {
      const before = await getOrThrow(tx, id);

      if (id === actor.id) {
        if (input.role !== undefined && input.role !== before.role) {
          throw badRequest('مش ممكن تغيّر صلاحيتك بنفسك');
        }
        if (input.active === false) throw badRequest('مش ممكن توقف حسابك بنفسك');
      }

      const losesAdmin =
        before.role === 'ADMIN' &&
        before.active &&
        ((input.role !== undefined && input.role !== 'ADMIN') || input.active === false);
      if (losesAdmin) {
        const otherAdmins = await tx.user.count({
          where: { role: 'ADMIN', active: true, id: { not: id } },
        });
        if (otherAdmins === 0) throw badRequest('لازم يفضل مدير واحد على الأقل');
      }

      const updated = await tx.user.update({ where: { id }, data: input });
      if (input.active === false) {
        await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await writeAudit(tx, {
        userId: actor.id,
        action: input.active === false ? 'USER_DEACTIVATE' : 'USER_UPDATE',
        entity: 'User',
        entityId: id,
        before: toPublicUser(before),
        after: toPublicUser(updated),
        ip: actor.ip,
      });
      return updated;
    });
    return toPublicUser(user);
  }

  deactivate(id: string, actor: Actor): Promise<PublicUser> {
    return this.update(id, { active: false }, actor);
  }

  async resetPassword(id: string, input: ResetPasswordInput, actor: Actor): Promise<void> {
    const passwordHash = await hashPassword(input.newPassword);
    await withTx(this.prisma, async (tx) => {
      await getOrThrow(tx, id);
      await tx.user.update({ where: { id }, data: { passwordHash } });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'USER_PASSWORD_RESET',
        entity: 'User',
        entityId: id,
        ip: actor.ip,
      });
    });
  }
}
