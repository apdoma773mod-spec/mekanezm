import type { ZodTypeAny, z } from 'zod';

/** Parses untrusted input; a ZodError is turned into a 400 response by the error handler. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  return schema.parse(data);
}
