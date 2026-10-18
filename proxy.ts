/**
 * Middleware: RBAC для /portal/*.
 * NextAuth session — без Supabase.
 */
import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';
import { getPortalHomeForRole } from '@/lib/portal-role-home';
import { isValidServerActionId } from '@/lib/next-action';
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

/** Короткая страница 404 для несуществующих услуг/статей/терминов (стили — inline: CSP разрешает). */
const NOT_FOUND_HTML = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Страница не найдена | АВАТЕРРА</title></head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#faf8f5;color:#2b2233">
<main style="max-width:560px;margin:15vh auto;padding:0 16px;text-align:center">
<p style="font-size:56px;margin:0;color:#6b4a7a">404</p>
<h1 style="font-size:24px;font-weight:600">Страница не найдена</h1>
<p style="color:#6b6372">Возможно, материал переехал или адрес набран с ошибкой.</p>
<p><a href="/" style="color:#6b4a7a">На главную</a> · <a href="/blog" style="color:#6b4a7a">Блог</a> · <a href="/glossary" style="color:#6b4a7a">Глоссарий</a> · <a href="/services" style="color:#6b4a7a">Программы</a></p>
</main></body></html>`;

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
  // Битый Next-Action (сканеры шлют «x»): Next отвергает его только после рендера, с ошибкой
  // в журнале. Настоящие ID — 42 hex-символа (lib/next-action.ts). Ответ — напрямую, без rewrite.
  const nextAction = request.headers.get('next-action');
  if (nextAction !== null && !isValidServerActionId(nextAction)) {
    return new NextResponse(null, { status: 400 });
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
    // Отдаём 404 прямо отсюда, без перезаписи на /_not-found: за nginx Next считал такую
    // перезапись внешней и проксировал на https://localhost:3000 → 500 (EPROTO), 16.10.2026.
    return withCsp(
      new NextResponse(NOT_FOUND_HTML, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
      }),
    );
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
