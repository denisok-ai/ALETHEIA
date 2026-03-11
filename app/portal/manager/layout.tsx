/**
 * Manager portal layout: sidebar + main content.
 */
import { LayoutDashboard, MessageSquare, Users, CheckCircle, HelpCircle } from 'lucide-react';
import { PortalSidebar } from '@/components/portal/PortalSidebar';

const managerNav = [
  { href: '/portal/manager/dashboard', label: 'Дашборд', icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: '/portal/manager/tickets', label: 'Тикеты', icon: <MessageSquare className="h-4 w-4" /> },
  { href: '/portal/manager/users', label: 'Пользователи', icon: <Users className="h-4 w-4" /> },
  { href: '/portal/manager/verifications', label: 'Верификация заданий', icon: <CheckCircle className="h-4 w-4" /> },
  { href: '/portal/manager/help', label: 'Помощь', icon: <HelpCircle className="h-4 w-4" /> },
];

export default function ManagerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <PortalSidebar items={managerNav} />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-6">{children}</main>
    </div>
  );
}
