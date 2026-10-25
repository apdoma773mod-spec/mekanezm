import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PrismaClient, User } from '@prisma/client';
import {
  EG_MOBILE_RE,
  normalizePhone,
  type ChangePasswordInput,
  type LoginInput,
  type SetupInput,
} from '@mk/shared';
import { writeAudit } from '../../lib/audit.js';
import { AppError, conflict, unauthorized } from '../../lib/errors.js';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../../lib/password.js';
import { toPublicUser } from '../../lib/serialize.js';
import { withTx } from '../../lib/tx.js';

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
}

export interface IssuedSession {
  user: User;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const ROTATION_GRACE_MS = 30_000;

/** Another tab already rotated this token; its new cookies are valid and must not be cleared. */
export class RefreshRaceError extends AppError {
  constructor() {
    super(401, 'UNAUTHORIZED', 'الجلسة اتجددت من صفحة تانية');
  }
}

const sha256 =(v: string) => createHash('sha256').update(v).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly refreshTtlDays: number,
  ) {}

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000);
  }

  private findByLogin(login: string) {
    if (login.includes('@')) {
      return this.prisma.user.findUnique({ where: { email: login.toLowerCase() } });
    }
    const phone = normalizePhone(login);
    if (!EG_MOBILE_RE.test(phone)) return Promise.resolve(null);
    return this.prisma.user.findUnique({ where: { phone } });
  }

  async login(input: LoginInput, client: ClientInfo): Promise<IssuedSession> {
    const user = await this.findByLogin(input.login);
    if (!user) {
      await burnPasswordCheck(input.password);
      throw unauthorized('رقم الموبايل أو كلمة السر غلط');
    }
    if (!(await verifyPassword(user.passwordHash, input.password))) {
      throw unauthorized('رقم الموبايل أو كلمة السر غلط');
    }
    if (!user.active) throw new AppError(403, 'FORBIDDEN', 'الحساب ده موقوف، كلّم المدير');

    const refreshToken = newToken();
    const refreshExpiresAt = this.refreshExpiry();
    const updated = await withTx(this.prisma, async (tx) => {
      const u = await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(refreshToken),
          familyId: randomUUID(),
          expiresAt: refreshExpiresAt,
          ip: client.ip,
          userAgent: client.userAgent,
        },
      });
      await writeAudit(tx, { userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, ip: client.ip });
      return u;
    });
    return { user: updated, refreshToken, refreshExpiresAt };
  }

  /**
   * Rotates a refresh token. Presenting an already-rotated token means it was copied,
   * so the whole token family is revoked and the user has to log in again.
   */
  async refresh(presented: string, client: ClientInfo): Promise<IssuedSession> {
    const tokenHash = sha256(presented);
    const result = await withTx(this.prisma, async (tx) => {
      const current = await tx.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
      if (!current) return { kind: 'invalid' as const };
      if (current.revokedAt) {
        // Two tabs refreshing at the same moment is normal, not theft.
        const justRotated =
          current.replacedBy !== null && Date.now() - current.revokedAt.getTime() < ROTATION_GRACE_MS;
        if (justRotated) return { kind: 'race' as const };
        await tx.refreshToken.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return { kind: 'invalid' as const };
      }
      if (current.expiresAt <= new Date() || !current.user.active) return { kind: 'invalid' as const };

      const next = newToken();
      const nextExpiry = this.refreshExpiry();
      const created = await tx.refreshToken.create({
        data: {
          userId: current.userId,
          tokenHash: sha256(next),
          familyId: current.familyId,
          expiresAt: nextExpiry,
          ip: client.ip,
          userAgent: client.userAgent,
        },
      });
      await tx.refreshToken.update({
        where: { id: current.id },
        data: { revokedAt: new Date(), replacedBy: created.id },
      });
      return { kind: 'ok' as const, session: { user: current.user, refreshToken: next, refreshExpiresAt: nextExpiry } };
    });
    if (result.kind === 'race') throw new RefreshRaceError();
    if (result.kind !== 'ok') throw unauthorized('الجلسة خلصت، سجّل دخول تاني');
    return result.session;
  }

  async logout(presented: string | undefined, userId: string | null, ip: string | null): Promise<void> {
    if (!presented) return;
    await withTx(this.prisma, async (tx) => {
      const token = await tx.refreshToken.findUnique({ where: { tokenHash: sha256(presented) } });
      if (!token) return;
      await tx.refreshToken.updateMany({
        where: { familyId: token.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await writeAudit(tx, {
        userId: userId ?? token.userId,
        action: 'LOGOUT',
        entity: 'User',
        entityId: token.userId,
        ip,
      });
    });
  }

  async needsSetup(): Promise<boolean> {
    return (await this.prisma.user.count()) === 0;
  }

  /** Creates the owner's admin account on a fresh install. Refused once any account exists. */
  async setup(input: SetupInput, client: ClientInfo): Promise<IssuedSession> {
    const passwordHash = await hashPassword(input.password);
    const refreshToken = newToken();
    const refreshExpiresAt = this.refreshExpiry();
    const user = await withTx(this.prisma, async (tx) => {
      if ((await tx.user.count()) > 0) throw conflict('السيستم متجهّز خلاص، سجّل دخول بحسابك');
      const created = await tx.user.create({
        data: {
          name: input.name,
          phone: input.phone,
          email: input.email ?? null,
          role: 'ADMIN',
          passwordHash,
          lastLoginAt: new Date(),
        },
      });
      await tx.refreshToken.create({
        data: {
          userId: created.id,
          tokenHash: sha256(refreshToken),
          familyId: randomUUID(),
          expiresAt: refreshExpiresAt,
          ip: client.ip,
          userAgent: client.userAgent,
        },
      });
      await writeAudit(tx, {
        userId: created.id,
        action: 'USER_CREATE',
        entity: 'User',
        entityId: created.id,
        after: toPublicUser(created),
        ip: client.ip,
      });
      return created;
    });
    return { user, refreshToken, refreshExpiresAt };
  }

  async me(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw unauthorized();
    return user;
  }

  /** Changes the password and signs out every other device by revoking all refresh tokens. */
  async changePassword(userId: string, input: ChangePasswordInput, client: ClientInfo): Promise<IssuedSession> {
    const user = await this.me(userId);
    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new AppError(400, 'VALIDATION_ERROR', 'كلمة السر الحالية غلط', [
        { path: 'currentPassword', message: 'كلمة السر الحالية غلط' },
      ]);
    }
    const passwordHash = await hashPassword(input.newPassword);
    const refreshToken = newToken();
    const refreshExpiresAt = this.refreshExpiry();
    const updated = await withTx(this.prisma, async (tx) => {
      const u = await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.refreshToken.create({
        data: {
          userId,
          tokenHash: sha256(refreshToken),
          familyId: randomUUID(),
          expiresAt: refreshExpiresAt,
          ip: client.ip,
          userAgent: client.userAgent,
        },
      });
      await writeAudit(tx, { userId, action: 'PASSWORD_CHANGE', entity: 'User', entityId: userId, ip: client.ip });
      return u;
    });
    return { user: updated, refreshToken, refreshExpiresAt };
  }
}
