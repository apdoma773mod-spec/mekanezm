import type { ErrorCode } from '@mk/shared';

export interface ErrorDetail {
  path: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthorized = (message = 'لازم تسجّل دخول الأول') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'مش مسموحلك تعمل ده') => new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'مش موجود') => new AppError(404, 'NOT_FOUND', message);

export const conflict = (message: string, details?: ErrorDetail[]) =>
  new AppError(409, 'CONFLICT', message, details);

export const badRequest = (message: string, details?: ErrorDetail[]) =>
  new AppError(400, 'BAD_REQUEST', message, details);
