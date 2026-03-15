/**
 * Admin portal layout: sidebar with grouped sections + main content.
 */
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Award,
  Newspaper,
  FolderOpen,
  CreditCard,
  MessageSquare,
  Bot,
  FileText,
  Settings,
  Send,
  Mail,
  Bell,
  BarChart3,
  Activity,
  LayoutTemplate,
  HelpCircle,
  FolderTree,
} from 'lucide-react';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import type { NavSection } from '@/components/portal/PortalSidebar';

const icon = (El: React.ComponentType<{ className?: string }>) => <El className="h-4 w-4" />;

const adminSections: NavSection[] = [
  {
    items: [{ href: '/portal/admin/dashboard', label: 'Дашборд', icon: icon(LayoutDashboard) }],
  },
  {
    sectionLabel: 'Контент и обучение',
    items: [
      { href: '/portal/admin/groups', label: 'Группы', icon: icon(FolderTree) },
      { href: '/portal/admin/courses', label: 'Курсы', icon: icon(BookOpen) },
      { href: '/portal/admin/certificates', label: 'Сертификаты', icon: icon(Award) },
      { href: '/portal/admin/certificate-templates', label: 'Шаблоны сертификатов', icon: icon(LayoutTemplate) },
      { href: '/portal/admin/publications', label: 'Публикации', icon: icon(Newspaper) },
      { href: '/portal/admin/media', label: 'Медиатека', icon: icon(FolderOpen) },
    ],
  },
  {
    sectionLabel: 'Пользователи и продажи',
    items: [
      { href: '/portal/admin/users', label: 'Пользователи', icon: icon(Users) },
      { href: '/portal/admin/crm', label: 'CRM', icon: icon(MessageSquare) },
      { href: '/portal/admin/payments', label: 'Оплаты', icon: icon(CreditCard) },
    ],
  },
  {
    sectionLabel: 'Коммуникации',
    items: [
      { href: '/portal/manager/tickets', label: 'Тикеты', icon: icon(MessageSquare) },
      { href: '/portal/admin/mailings', label: 'Рассылки', icon: icon(Send) },
      { href: '/portal/admin/communications', label: 'Коммуникации', icon: icon(Mail) },
      { href: '/portal/admin/notification-sets', label: 'Наборы уведомлений', icon: icon(Bell) },
      { href: '/portal/admin/notification-templates', label: 'Шаблоны уведомлений', icon: icon(LayoutTemplate) },
      { href: '/portal/admin/notification-logs', label: 'Журнал уведомлений', icon: icon(FileText) },
    ],
  },
  {
    sectionLabel: 'Аналитика и контроль',
    items: [
      { href: '/portal/admin/reports', label: 'Отчётность', icon: icon(BarChart3) },
      { href: '/portal/admin/monitoring', label: 'Мониторинг', icon: icon(Activity) },
      { href: '/portal/admin/audit', label: 'Журнал аудита', icon: icon(FileText) },
    ],
  },
  {
    sectionLabel: 'Настройки',
    items: [
      { href: '/portal/admin/ai-settings', label: 'Настройки AI', icon: icon(Bot) },
      { href: '/portal/admin/settings', label: 'Настройки', icon: icon(Settings) },
      { href: '/portal/admin/help', label: 'Помощь', icon: icon(HelpCircle) },
    ],
  },
];

export default function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <PortalSidebar sections={adminSections} collapsible />
      <main
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-5 md:p-7"
        style={{ background: 'var(--portal-bg)' }}
      >{children}</main>
    </div>
  );
}
