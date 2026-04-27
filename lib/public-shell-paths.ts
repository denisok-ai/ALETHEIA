/**
 * Публичные маршруты без лендингового header/footer в корневом layout.tsx
 * (формы входа, оплата, отписка, служебные страницы next-auth).
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

export function isMinimalPublicShell(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/auth')) return true;
  if (MINIMAL_EXACT.has(pathname)) return true;
  return false;
}
