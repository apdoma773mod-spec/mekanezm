import { NextResponse, type NextRequest } from 'next/server';
import { decodeJwt } from 'jose';

const ADMIN_PATHS = ['/users', '/settings', '/audit', '/products', '/returns', '/contacts', '/cash', '/theme', '/camera'];

/**
 * UX-level gate only: sends signed-out visitors to /login and staff away from admin screens.
 * The backend enforces every permission on its own.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Behind ngrok's free plan: forward /api/* ourselves so we can send the header that skips its browser warning page.
  if (pathname.startsWith('/api/')) {
    const base = process.env.BACKEND_URL?.replace(/\/$/, '');
    if (!base || !base.includes('ngrok')) return NextResponse.next(); // normal rewrite in next.config.mjs
    const headers = new Headers(req.headers);
    headers.set('ngrok-skip-browser-warning', '1');
    return NextResponse.rewrite(new URL(`${pathname}${search}`, base), { request: { headers } });
  }
  const hasSession = req.cookies.has('mk_rt');

  // the customer's own link opens without any login
  if (pathname === '/login' || pathname === '/setup' || pathname.startsWith('/portal/')) return NextResponse.next();

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const access = req.cookies.get('mk_at')?.value;
    if (access) {
      try {
        if (decodeJwt(access).role !== 'ADMIN') return NextResponse.redirect(new URL('/', req.url));
      } catch {
        // Malformed token: let the page load; its API calls will refresh or bounce to login.
      }
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webmanifest)$).*)'],
};
