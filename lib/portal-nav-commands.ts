/**
 * Пункты для палитры команд портала (⌘K): те же маршруты, что в сайдбарах по ролям.
 */
export type PortalNavRole = 'admin' | 'manager' | 'user';

export interface PortalNavCommandItem {
  href: string;
  label: string;
  section: string;
  /** Роли, для которых показывать пункт */
  roles: readonly PortalNavRole[];
}

export const PORTAL_NAV_COMMAND_ITEMS: readonly PortalNavCommandItem[] = [
  { href: '/portal/student/dashboard', label: 'Дашборд', section: 'Студент', roles: ['user'] },
  { href: '/portal/student/courses', label: 'Мои курсы', section: 'Студент', roles: ['user'] },
  { href: '/portal/student/certificates', label: 'Сертификаты', section: 'Студент', roles: ['user'] },
  { href: '/portal/student/media', label: 'Медиатека', section: 'Студент', roles: ['user'] },
  { href: '/portal/student/verifications', label: 'Задания на проверку', section: 'Студент', roles: ['user'] },
  { href: '/portal/student/notifications', label: 'Уведомления', section: 'Студент', roles: ['user'] },
  { href: '/portal/student/support', label: 'Поддержка', section: 'Студент', roles: ['user'] },
  { href: '/portal/student/help', label: 'Помощь', section: 'Студент', roles: ['user'] },
  { href: '/portal/student/profile', label: 'Профиль', section: 'Студент', roles: ['user'] },

  { href: '/portal/manager/dashboard', label: 'Дашборд', section: 'Менеджер', roles: ['manager'] },
  { href: '/portal/manager/tickets', label: 'Тикеты', section: 'Менеджер', roles: ['manager', 'admin'] },
  { href: '/portal/manager/users', label: 'Пользователи', section: 'Менеджер', roles: ['manager'] },
  { href: '/portal/manager/verifications', label: 'Верификация заданий', section: 'Менеджер', roles: ['manager'] },
  { href: '/portal/manager/help', label: 'Помощь', section: 'Менеджер', roles: ['manager'] },

  { href: '/portal/admin/dashboard', label: 'Дашборд', section: 'Администрирование', roles: ['admin'] },
  { href: '/portal/admin/groups', label: 'Группы', section: 'Контент и обучение', roles: ['admin'] },
  { href: '/portal/admin/courses', label: 'Курсы', section: 'Контент и обучение', roles: ['admin'] },
  { href: '/portal/admin/certificates', label: 'Сертификаты', section: 'Контент и обучение', roles: ['admin'] },
  { href: '/portal/admin/certificate-templates', label: 'Шаблоны сертификатов', section: 'Контент и обучение', roles: ['admin'] },
  { href: '/portal/admin/publications', label: 'Публикации', section: 'Контент и обучение', roles: ['admin'] },
  { href: '/portal/admin/media', label: 'Медиатека', section: 'Контент и обучение', roles: ['admin'] },
  { href: '/portal/admin/users', label: 'Пользователи', section: 'Пользователи и продажи', roles: ['admin'] },
  { href: '/portal/admin/crm', label: 'CRM', section: 'Пользователи и продажи', roles: ['admin'] },
  { href: '/portal/admin/shop', label: 'Товары', section: 'Пользователи и продажи', roles: ['admin'] },
  { href: '/portal/admin/payments', label: 'Оплаты', section: 'Пользователи и продажи', roles: ['admin'] },
  { href: '/portal/admin/mailings', label: 'Рассылки', section: 'Коммуникации', roles: ['admin'] },
  { href: '/portal/admin/communications', label: 'Коммуникации', section: 'Коммуникации', roles: ['admin'] },
  { href: '/portal/admin/notification-sets', label: 'Наборы уведомлений', section: 'Коммуникации', roles: ['admin'] },
  { href: '/portal/admin/notification-templates', label: 'Шаблоны уведомлений', section: 'Коммуникации', roles: ['admin'] },
  { href: '/portal/admin/notification-logs', label: 'Журнал уведомлений', section: 'Коммуникации', roles: ['admin'] },
  { href: '/portal/admin/reports', label: 'Отчётность', section: 'Аналитика и контроль', roles: ['admin'] },
  { href: '/portal/admin/monitoring', label: 'Мониторинг', section: 'Аналитика и контроль', roles: ['admin'] },
  { href: '/portal/admin/audit', label: 'Журнал аудита', section: 'Аналитика и контроль', roles: ['admin'] },
  { href: '/portal/admin/ai-settings', label: 'Настройки AI', section: 'Настройки', roles: ['admin'] },
  { href: '/portal/admin/settings', label: 'Настройки', section: 'Настройки', roles: ['admin'] },
  { href: '/portal/admin/help', label: 'Помощь', section: 'Настройки', roles: ['admin'] },
] as const;

export function getPortalNavCommandsForRole(role: string | undefined): PortalNavCommandItem[] {
  const r = role?.toLowerCase();
  if (r === 'admin') {
    return PORTAL_NAV_COMMAND_ITEMS.filter((i) => i.roles.includes('admin'));
  }
  if (r === 'manager') {
    return PORTAL_NAV_COMMAND_ITEMS.filter((i) => i.roles.includes('manager'));
  }
  return PORTAL_NAV_COMMAND_ITEMS.filter((i) => i.roles.includes('user'));
}
