import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { changePasswordInput, loginInput, setupInput } from '@mk/shared';
import { ACCESS_COOKIE, REFRESH_COOKIE, currentUser } from '../../plugins/auth.js';
import { toPublicUser } from '../../lib/serialize.js';
import { unauthorized } from '../../lib/errors.js';
import { parse } from '../../lib/validate.js';
import { AuthService, RefreshRaceError, type IssuedSession } from './service.js';

export default async function authRoutes(app: FastifyInstance) {
  const service = new AuthService(app.prisma, app.config.REFRESH_TOKEN_TTL_DAYS);
  const cookieBase = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: app.config.COOKIE_SECURE,
    path: '/',
  };

  const client = (request: FastifyRequest) => ({
    ip: request.ip ?? null,
    userAgent: request.headers['user-agent']?.slice(0, 300) ?? null,
  });

  const startSession = async (reply: FastifyReply, session: IssuedSession) => {
    const accessToken = await reply.jwtSign({ sub: session.user.id, role: session.user.role });
    reply
      .setCookie(ACCESS_COOKIE, accessToken, { ...cookieBase, maxAge: app.config.ACCESS_TOKEN_TTL_MIN * 60 })
      .setCookie(REFRESH_COOKIE, session.refreshToken, { ...cookieBase, expires: session.refreshExpiresAt });
    return { user: toPublicUser(session.user) };
  };

  const endSession = (reply: FastifyReply) =>
    reply.clearCookie(ACCESS_COOKIE, cookieBase).clearCookie(REFRESH_COOKIE, cookieBase);

  app.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: app.config.LOGIN_RATE_LIMIT_MAX,
          timeWindow: '15 minutes',
          keyGenerator: (request: FastifyRequest) => request.ip,
        },
      },
    },
    async (request, reply) => {
      const input = parse(loginInput, request.body);
      return startSession(reply, await service.login(input, client(request)));
    },
  );

  app.get('/setup', async () => ({ needsSetup: await service.needsSetup() }));

  app.post(
    '/setup',
    { config: { rateLimit: { max: app.config.LOGIN_RATE_LIMIT_MAX, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const input = parse(setupInput, request.body);
      const result = await startSession(reply, await service.setup(input, client(request)));
      return reply.status(201).send(result);
    },
  );

  app.post('/refresh', async (request, reply) => {
    const presented = request.cookies[REFRESH_COOKIE];
    if (!presented) throw unauthorized('الجلسة خلصت، سجّل دخول تاني');
    try {
      return await startSession(reply, await service.refresh(presented, client(request)));
    } catch (err) {
      if (!(err instanceof RefreshRaceError)) endSession(reply);
      throw err;
    }
  });

  app.post('/logout', async (request, reply) => {
    let userId: string | null = null;
    try {
      userId = (await request.jwtVerify<{ sub: string }>()).sub;
    } catch {
      userId = null;
    }
    await service.logout(request.cookies[REFRESH_COOKIE], userId, request.ip ?? null);
    endSession(reply);
    return { ok: true };
  });

  app.get('/me', { preHandler: app.authenticate }, async (request) => {
    return { user: toPublicUser(await service.me(currentUser(request).id)) };
  });

  app.post('/change-password', { preHandler: app.authenticate }, async (request, reply) => {
    const input = parse(changePasswordInput, request.body);
    return startSession(reply, await service.changePassword(currentUser(request).id, input, client(request)));
  });
}
