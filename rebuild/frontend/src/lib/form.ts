import type { ZodTypeAny, z } from 'zod';
import { ApiClientError } from './api';

export type FieldErrors = Record<string, string>;

/** Validates on the client with the same schema the server uses; returns errors keyed by field path. */
export function validate<S extends ZodTypeAny>(
  schema: S,
  data: unknown,
): { ok: true; data: z.output<S> } | { ok: false; errors: FieldErrors } {
  const r = schema.safeParse(data);
  if (r.success) return { ok: true, data: r.data };
  const errors: FieldErrors = {};
  for (const issue of r.error.issues) errors[issue.path.join('.') || '_'] ??= issue.message;
  return { ok: false, errors };
}

/** Server errors: field-level when the server sent details, otherwise a form-level message under "_". */
export function serverErrors(err: unknown): FieldErrors {
  if (err instanceof ApiClientError) {
    const fields = err.fieldErrors();
    return Object.keys(fields).length ? { ...fields, _: err.message } : { _: err.message };
  }
  return { _: 'حصلت مشكلة غير متوقعة' };
}
