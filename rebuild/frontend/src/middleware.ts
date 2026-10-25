import { NextResponse, type NextRequest } from 'next/server';
import { decodeJwt } from 'jose';

const ADMIN_PATHS = ['/users', '/settings', '/audit'];

/**
 * UX-level gate only: sends signed-out visitors to /login and staff away from admin screens.
 * The backend enforces every permission on its own.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = req.cookies.has('mk_rt');

  if (pathname === '/login' || pathname === '/setup') return NextResponse.next();

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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webmanifest)$).*)'],
};
