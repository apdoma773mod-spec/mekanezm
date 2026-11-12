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

/** ok = new session; invalid = the session is really gone (401/403); down = the server hiccuped (5xx / no network) — NOT a reason to log out. */
type Refreshed = 'ok' | 'invalid' | 'down';
let refreshing: Promise<Refreshed> | null = null;

/** One refresh at a time per tab; parallel 401s wait for the same attempt. */
function refreshSession(): Promise<Refreshed> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'same-origin' })
    .then((r): Refreshed => (r.ok ? 'ok' : r.status === 401 || r.status === 403 ? 'invalid' : 'down'))
    .catch((): Refreshed => 'down')
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * When the session is really gone we do NOT reload the page to /login (that threw away whatever was being typed):
 * the app shows a small login box on top of the screen (components/relogin.tsx) and the request continues after it.
 * No box registered (login page, tests) → the old behaviour.
 */
let reloginHandler: (() => Promise<boolean>) | null = null;
export const setReloginHandler = (fn: (() => Promise<boolean>) | null) => {
  reloginHandler = fn;
};

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

  // reads are safe to repeat: a server hiccup (5xx) or a dropped connection gets 2 more tries before the user sees an error
  const tries = method === 'GET' ? [600, 1500] : [];
  let res: Response | null = null;
  for (let i = 0; ; i++) {
    try {
      res = await send();
      if (res.status < 500 || i >= tries.length) break;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      if (i >= tries.length) throw new ApiClientError(0, 'INTERNAL_ERROR', 'مفيش اتصال بالسيرفر، اتأكد من النت — اللي كتبته لسه قدامك');
    }
    await sleep(tries[i]!);
  }

  if (res.status === 401 && !path.startsWith('/auth/')) {
    // A failed refresh may just mean another tab rotated the token first. A server hiccup during the refresh is not a logout.
    let st = await refreshSession();
    for (const wait of [1000, 2500, 5000]) {
      if (st !== 'down') break;
      await sleep(wait);
      st = await refreshSession();
    }
    if (st === 'down') throw new ApiClientError(503, 'INTERNAL_ERROR', 'السيرفر مش بيرد دلوقتي — اللي كتبته لسه قدامك، جرّب تاني بعد لحظة');
    res = await send();
    if (res.status === 401) {
      const back = reloginHandler ? await reloginHandler() : false;
      if (back) res = await send();
      if (res.status === 401) {
        if (!reloginHandler) redirectToLogin();
        throw await toError(res);
      }
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
  // رسائلنا العربي (من الكود نفسه) بتظهر زي ما هي بدل الرسالة العامة اللي بتخبّي السبب
  if (err instanceof Error && /[؀-ۿ]/.test(err.message)) return err.message;
  return 'حصلت مشكلة غير متوقعة' + (err instanceof Error && err.message ? ' (' + err.message.slice(0, 80) + ')' : '');
}
