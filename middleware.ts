/**
 * Middleware: RBAC для /portal/*.
 * NextAuth session — без Supabase.
 */
import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';
import { getPortalHomeForRole } from '@/lib/portal-role-home';
import {
  buildContentSecurityPolicy,
  buildContentSecurityPolicyReportOnly,
} from '@/lib/csp';

const PORTAL_PREFIX = '/portal';
const LOGIN_PATH = '/login';

const AUTH_PAGES = ['/login', '/register', '/reset-password'];

/**
 * Статика с платным/приватным контентом (SCORM-курсы, медиатека, видео-верификации):
 * без сессии не отдаём. Тонкая проверка (enrollment) — на nginx auth_request (prod)
 * и в API-маршрутах; здесь отсечка анонимного прямого доступа по URL.
 * /uploads/services/ (обложки товаров) остаётся публичным.
 */
const PROTECTED_UPLOAD_PREFIXES = ['/uploads/scorm/', '/uploads/media/', '/uploads/verifications/'];

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
  const isDev = process.env.NODE_ENV !== 'production';

  /**
   * Единый источник CSP: политика зависит от маршрута (unsafe-eval — только на
   * SCORM-плеере и контенте курсов, см. lib/csp.ts), поэтому ставится здесь, а не
   * в next.config — иначе два CSP-заголовка сложились бы в пересечение. Вешаем на
   * КАЖДЫЙ ответ middleware (включая редиректы), чтобы политика зависела строго от
   * запрошенного пути.
   */
  const withCsp = (response: NextResponse): NextResponse => {
    response.headers.set('Content-Security-Policy', buildContentSecurityPolicy(path, isDev));
    if (!isDev) {
      response.headers.set(
        'Content-Security-Policy-Report-Only',
        buildContentSecurityPolicyReportOnly(),
      );
    }
    return response;
  };

  if (PROTECTED_UPLOAD_PREFIXES.some((p) => path.startsWith(p))) {
    if (!token) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    return withCsp(NextResponse.next());
  }

  if (token && AUTH_PAGES.includes(path)) {
    const role = (token.role as string) ?? 'user';
    const home = getPortalHomeForRole(role).path;
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = '';
    return withCsp(NextResponse.redirect(url));
  }

  if (!path.startsWith(PORTAL_PREFIX)) {
    return withCsp(NextResponse.next());
  }

  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.searchParams.set('redirect', path);
    return withCsp(NextResponse.redirect(url));
  }

  if (path.startsWith(`${PORTAL_PREFIX}/admin`)) {
    if (role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/portal/access-denied';
      url.searchParams.set('section', 'admin');
      return withCsp(NextResponse.redirect(url));
    }
  }

  if (path.startsWith(`${PORTAL_PREFIX}/manager`)) {
    if (role !== 'manager' && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/portal/access-denied';
      url.searchParams.set('section', 'manager');
      return withCsp(NextResponse.redirect(url));
    }
  }

  return withCsp(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html)$).*)',
    // Приватная статика — проверка сессии (общий паттерн выше исключает её по расширению)
    '/uploads/scorm/:path*',
    '/uploads/media/:path*',
    '/uploads/verifications/:path*',
  ],
};
