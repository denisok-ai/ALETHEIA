/**
 * «Домашняя» страница портала по роли: редирект с /portal, логин и кнопки «в кабинет».
 */
import { PORTAL_PATH } from '@/lib/portal-paths';

export { PORTAL_PATH };

export function getPortalHomeForRole(role: string | undefined | null): { path: string; label: string } {
  const r = role ?? 'user';
  if (r === 'admin') {
    return { path: PORTAL_PATH.adminDashboard, label: 'Админ-панель' };
  }
  if (r === 'manager') {
    return { path: PORTAL_PATH.managerDashboard, label: 'Кабинет менеджера' };
  }
  return { path: PORTAL_PATH.studentDashboard, label: 'Личный кабинет' };
}
