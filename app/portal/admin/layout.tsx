/**
 * Admin portal layout: sidebar + main content.
 */
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Award,
  FolderOpen,
  CreditCard,
  MessageSquare,
  Bot,
  FileText,
  Settings,
  Mail,
} from 'lucide-react';
import { PortalSidebar } from '@/components/portal/PortalSidebar';

const adminNav = [
  { href: '/portal/admin/dashboard', label: 'Дашборд', icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: '/portal/admin/users', label: 'Пользователи', icon: <Users className="h-4 w-4" /> },
  { href: '/portal/admin/courses', label: 'Курсы', icon: <BookOpen className="h-4 w-4" /> },
  { href: '/portal/admin/certificates', label: 'Сертификаты', icon: <Award className="h-4 w-4" /> },
  { href: '/portal/admin/media', label: 'Медиатека', icon: <FolderOpen className="h-4 w-4" /> },
  { href: '/portal/admin/payments', label: 'Оплаты', icon: <CreditCard className="h-4 w-4" /> },
  { href: '/portal/admin/crm', label: 'CRM', icon: <MessageSquare className="h-4 w-4" /> },
  { href: '/portal/admin/communications', label: 'Коммуникации', icon: <Mail className="h-4 w-4" /> },
  { href: '/portal/admin/ai-settings', label: 'Настройки AI', icon: <Bot className="h-4 w-4" /> },
  { href: '/portal/admin/audit', label: 'Журнал аудита', icon: <FileText className="h-4 w-4" /> },
  { href: '/portal/admin/settings', label: 'Настройки', icon: <Settings className="h-4 w-4" /> },
];

export default function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <PortalSidebar items={adminNav} />
      <main className="min-h-[calc(100vh-3.5rem)] flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
