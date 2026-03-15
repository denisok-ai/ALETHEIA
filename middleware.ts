/**
 * Middleware: RBAC для /portal/*.
 * NextAuth session — без Supabase.
 */
import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

const PORTAL_PREFIX = '/portal';
const LOGIN_PATH = '/login';

const AUTH_PAGES = ['/login', '/register', '/reset-password'];

export async function middleware(request: NextRequest) {
  const secret =
    process.env.NODE_ENV === 'production'
      ? (process.env.NEXTAUTH_SECRET ?? '')
      : process.env.NEXTAUTH_SECRET ?? 'avaterra-dev-secret';
  if (process.env.NODE_ENV === 'production' && !secret) {
    return new NextResponse('Server misconfiguration: NEXTAUTH_SECRET required', { status: 500 });
  }
  const token = await getToken({ req: request, secret });
  const role = (token?.role as string) ?? 'user';
  const path = request.nextUrl.pathname;

  if (token && AUTH_PAGES.includes(path)) {
    return NextResponse.redirect(new URL('/portal', request.url));
  }

  if (!path.startsWith(PORTAL_PREFIX)) {
    return NextResponse.next();
  }

  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.searchParams.set('redirect', path);
    return NextResponse.redirect(url);
  }

  if (path.startsWith(`${PORTAL_PREFIX}/admin`)) {
    if (role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/portal/student/dashboard';
      return NextResponse.redirect(url);
    }
  }

  if (path.startsWith(`${PORTAL_PREFIX}/manager`)) {
    if (role !== 'manager' && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/portal/student/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
