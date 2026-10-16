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
import { trackRefVisit } from '@/lib/social/ref-tracking';
import { getBlogPostBySlug } from '@/lib/content/blog-posts';
import { getGlossaryTerm } from '@/lib/content/glossary';
import { getPublicProducts } from '@/lib/shop/public-products';

const PORTAL_PREFIX = '/portal';
const LOGIN_PATH = '/login';

const AUTH_PAGES = ['/login', '/register', '/reset-password'];

/**
 * Адреса контента с динамическим slug: тариф, статья блога, термин глоссария.
 * Страницы сами вызывают notFound(), но корневой layout оборачивает children в
 * <Suspense> — к моменту notFound() статус 200 уже отправлен (мягкий 404 с
 * noindex). Поэтому существование проверяем здесь, до рендера, и отдаём 404.
 */
const CONTENT_PATH = /^\/(services|blog|glossary)\/([^/]+)\/?$/;

/** Внутренний маршрут Next для страницы «не найдено» (app/not-found.tsx) — отдаёт статус 404. */
const NOT_FOUND_REWRITE = '/_not-found';

async function isMissingContentPage(path: string): Promise<boolean> {
  const match = CONTENT_PATH.exec(path);
  if (!match) return false;
  let slug: string;
  try {
    slug = decodeURIComponent(match[2]);
  } catch {
    return true;
  }
  switch (match[1]) {
    case 'services': {
      // getPublicProducts() при сбое БД молча отдаёт []: пустой каталог считаем деградацией,
      // а не «товара нет» — иначе поисковик получил бы 404 на все живые тарифы.
      const products = await getPublicProducts();
      if (products.length === 0) return false;
      return !products.some((p) => p.slug === slug);
    }
    case 'blog':
      return !(await getBlogPostBySlug(slug));
    default:
      return !getGlossaryTerm(slug);
  }
}

/**
 * Статика с платным/приватным контентом (SCORM-курсы, медиатека, видео-верификации):
 * без сессии не отдаём. Тонкая проверка (enrollment) — на nginx auth_request (prod)
 * и в API-маршрутах; здесь отсечка анонимного прямого доступа по URL.
 * /uploads/services/ (обложки товаров) остаётся публичным.
 */
const PROTECTED_UPLOAD_PREFIXES = ['/uploads/scorm/', '/uploads/media/', '/uploads/verifications/'];

export async function proxy(request: NextRequest) {
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
    // Метка ?ref= соцсетей (T3.3): cookie av_ref на публичных страницах и запись перехода.
    if (!path.startsWith(PORTAL_PREFIX)) {
      trackRefVisit(request, response, !isDev);
    }
    return response;
  };

  if (PROTECTED_UPLOAD_PREFIXES.some((p) => path.startsWith(p))) {
    if (!token) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    return withCsp(NextResponse.next());
  }

  if (!path.startsWith(PORTAL_PREFIX) && (await isMissingContentPage(path))) {
    // Адрес — от request.url, НЕ от nextUrl.clone(): NextURL нормализует 127.0.0.1 → localhost,
    // а Next сравнивает origin перезаписи со своим initUrl (протокол из X-Forwarded-Proto + хост
    // из `next start -H 127.0.0.1`). При несовпадении перезапись считается внешней и Next
    // пытается проксировать на https://localhost:3000 — за nginx это 500 (EPROTO), 16.10.2026.
    const url = new URL(NOT_FOUND_REWRITE, request.url);
    return withCsp(NextResponse.rewrite(url, { status: 404 }));
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
