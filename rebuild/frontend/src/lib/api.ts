import type { ApiError, ErrorCode } from '@mk/shared';

const BASE = '/api/v1';

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  /** Field → message map for showing errors under form inputs. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details) out[d.path] ??= d.message;
    return out;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time per tab; parallel 401s wait for the same attempt. */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'same-origin' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ''}`;
}

async function toError(res: Response): Promise<ApiClientError> {
  try {
    const body = (await res.json()) as ApiError;
    return new ApiClientError(res.status, body.error.code, body.error.message, body.error.details);
  } catch {
    return new ApiClientError(res.status, 'INTERNAL_ERROR', 'السيرفر مش بيرد، جرّب تاني');
  }
}

function redirectToLogin() {
  if (typeof window === 'undefined' || window.location.pathname === '/login') return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/login?next=${next}`);
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const send = () =>
    fetch(buildUrl(path, opts.query), {
      method,
      credentials: 'same-origin',
      signal: opts.signal,
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

  let res: Response;
  try {
    res = await send();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiClientError(0, 'INTERNAL_ERROR', 'مفيش اتصال بالسيرفر، اتأكد من النت');
  }

  if (res.status === 401 && !path.startsWith('/auth/')) {
    // A failed refresh may just mean another tab rotated the token first: retry once either way.
    await refreshSession();
    res = await send();
    if (res.status === 401) {
      redirectToLogin();
      throw await toError(res);
    }
  }

  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>('GET', path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body: body ?? {} }),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  return 'حصلت مشكلة غير متوقعة';
}
