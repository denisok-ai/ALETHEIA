/**
 * Публичные маршруты без лендингового header/footer в корневом layout.tsx
 * (формы входа, оплата, отписка, служебные страницы next-auth, страница согласования).
 */
const MINIMAL_EXACT = new Set([
  '/login',
  '/register',
  '/reset-password',
  '/set-password',
  '/verify-email',
  '/verify-email-required',
  '/signout',
  '/success',
  '/unsubscribe',
]);

/**
 * Служебная страница согласования контента (/soglasovanie/<токен>): секретный адрес, его смотрят
 * с телефона. Без шапки, подвала, чата и баннера cookie, а счётчики (Метрика, GA, Clarity) здесь
 * не грузятся: иначе токен из адреса уходит в аналитику, а запись сессий видит правки текстов.
 */
export function isPrivateToolPage(pathname: string | null | undefined): boolean {
  return !!pathname && (pathname === '/soglasovanie' || pathname.startsWith('/soglasovanie/'));
}

export function isMinimalPublicShell(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/auth')) return true;
  if (isPrivateToolPage(pathname)) return true;
  if (MINIMAL_EXACT.has(pathname)) return true;
  return false;
}
