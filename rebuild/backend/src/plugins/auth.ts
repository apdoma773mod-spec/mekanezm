import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@prisma/client';
import type { Config } from '../config.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export const ACCESS_COOKIE = 'mk_at';
export const REFRESH_COOKIE = 'mk_rt';

export interface AccessPayload {
  sub: string;
  role: Role;
}

export interface AuthUser {
  id: string;
  name: string;
  role: Role;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    auth: AuthUser | null;
  }
}

export default fp(
  async (app) => {
    await app.register(cookie);
    await app.register(jwt, {
      secret: app.config.JWT_SECRET,
      cookie: { cookieName: ACCESS_COOKIE, signed: false },
      sign: { expiresIn: `${app.config.ACCESS_TOKEN_TTL_MIN}m` },
    });

    app.decorateRequest('auth', null);

    app.decorate('authenticate', async (request: FastifyRequest) => {
      let payload: AccessPayload;
      try {
        payload = await request.jwtVerify<AccessPayload>();
      } catch {
        throw unauthorized();
      }
      // Re-read the user so deactivation and role changes apply immediately.
      const user = await app.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, role: true, active: true },
      });
      if (!user || !user.active) throw unauthorized('الحساب ده موقوف أو مش موجود');
      request.auth = { id: user.id, name: user.name, role: user.role };
    });

    app.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
      await app.authenticate(request, reply);
      if (request.auth?.role !== 'ADMIN') throw forbidden('الشاشة دي للمدير بس');
    });
  },
  { name: 'auth', dependencies: ['prisma'] },
);

/** Narrows `request.auth` after the authenticate pre-handler has run. */
export function currentUser(request: FastifyRequest): AuthUser {
  if (!request.auth) throw unauthorized();
  return request.auth;
}
