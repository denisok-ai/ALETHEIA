/**
 * Student portal layout: sidebar + main content.
 */
import { LayoutDashboard, BookOpen, Award, FolderOpen, Bell, User, Headphones } from 'lucide-react';
import { PortalSidebar } from '@/components/portal/PortalSidebar';

const studentNav = [
  { href: '/portal/student/dashboard', label: 'Дашборд', icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: '/portal/student/courses', label: 'Мои курсы', icon: <BookOpen className="h-4 w-4" /> },
  { href: '/portal/student/certificates', label: 'Сертификаты', icon: <Award className="h-4 w-4" /> },
  { href: '/portal/student/media', label: 'Медиатека', icon: <FolderOpen className="h-4 w-4" /> },
  { href: '/portal/student/notifications', label: 'Уведомления', icon: <Bell className="h-4 w-4" /> },
  { href: '/portal/student/support', label: 'Поддержка', icon: <Headphones className="h-4 w-4" /> },
  { href: '/portal/student/profile', label: 'Профиль', icon: <User className="h-4 w-4" /> },
];

export default function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <PortalSidebar items={studentNav} />
      <main className="min-h-[calc(100vh-3.5rem)] flex-1 p-6">{children}</main>
    </div>
  );
}
