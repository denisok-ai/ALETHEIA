/**
 * Manager portal layout: sidebar + main content.
 */
import { LayoutDashboard, MessageSquare, Users, CheckCircle } from 'lucide-react';
import { PortalSidebar } from '@/components/portal/PortalSidebar';

const managerNav = [
  { href: '/portal/manager/dashboard', label: 'Дашборд', icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: '/portal/manager/tickets', label: 'Тикеты', icon: <MessageSquare className="h-4 w-4" /> },
  { href: '/portal/manager/users', label: 'Пользователи', icon: <Users className="h-4 w-4" /> },
  { href: '/portal/manager/verifications', label: 'Верификация заданий', icon: <CheckCircle className="h-4 w-4" /> },
];

export default function ManagerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <PortalSidebar items={managerNav} />
      <main className="min-h-[calc(100vh-3.5rem)] flex-1 p-6">{children}</main>
    </div>
  );
}
