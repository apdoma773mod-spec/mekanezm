import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import type { ApiError } from '@mk/shared';
import { AppError } from '../lib/errors.js';

const UNIQUE_FIELD_MESSAGES: Record<string, string> = {
  phone: 'رقم الموبايل ده مستخدم قبل كده',
  email: 'الإيميل ده مستخدم قبل كده',
};

function fromPrisma(err: Prisma.PrismaClientKnownRequestError): AppError | null {
  if (err.code === 'P2002') {
    const target = (err.meta?.target as string[] | string | undefined) ?? [];
    const fields = Array.isArray(target) ? target : [target];
    const details = fields.map((f) => ({
      path: f,
      message: UNIQUE_FIELD_MESSAGES[f] ?? 'القيمة دي مستخدمة قبل كده',
    }));
    return new AppError(409, 'CONFLICT', details[0]?.message ?? 'القيمة دي مستخدمة قبل كده', details);
  }
  if (err.code === 'P2025') return new AppError(404, 'NOT_FOUND', 'مش موجود');
  return null;
}

function body(err: AppError): ApiError {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details?.length ? { details: err.details } : {}),
    },
  };
}

export default fp(
  async (app) => {
    app.setErrorHandler((err, request, reply) => {
      let appErr: AppError | null = null;
      const statusCode =
        typeof err === 'object' && err !== null && 'statusCode' in err && typeof err.statusCode === 'number'
          ? err.statusCode
          : undefined;

      if (err instanceof AppError) appErr = err;
      else if (err instanceof ZodError) {
        appErr = new AppError(
          400,
          'VALIDATION_ERROR',
          err.issues[0]?.message ?? 'البيانات مش صحيحة',
          err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        );
      } else if (err instanceof Prisma.PrismaClientKnownRequestError) appErr = fromPrisma(err);
      else if (statusCode === 429) {
        appErr = new AppError(429, 'RATE_LIMITED', 'محاولات كتير، استنى شوية وجرّب تاني');
      } else if (statusCode && statusCode >= 400 && statusCode < 500) {
        appErr = new AppError(statusCode, 'BAD_REQUEST', 'الطلب مش صحيح');
      }

      if (!appErr) {
        request.log.error({ err }, 'unhandled error');
        appErr = new AppError(500, 'INTERNAL_ERROR', 'حصلت مشكلة في السيرفر');
      }
      return reply.status(appErr.statusCode).send(body(appErr));
    });

    app.setNotFoundHandler((_request, reply) =>
      reply.status(404).send(body(new AppError(404, 'NOT_FOUND', 'المسار ده مش موجود'))),
    );
  },
  { name: 'errors' },
);
