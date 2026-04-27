import { redirect } from 'next/navigation';
import { getPortalHomeForRole } from '@/lib/portal-role-home';

/**
 * Корень ЛК студента: без дочернего сегмента Next отдавал бы 404.
 * Редирект на дашборд (как /portal → дашборд по роли).
 */
export default function StudentPortalIndexPage() {
  redirect(getPortalHomeForRole('user').path);
}
