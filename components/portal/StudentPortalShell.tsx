'use client';

import type { ReactNode } from 'react';
import { LayoutDashboard, BookOpen, Award, FolderOpen, Bell, User, Headphones, HelpCircle, Video } from 'lucide-react';
import { PortalSidebar } from '@/components/portal/PortalSidebar';

const studentNav = [
  { href: '/portal/student/dashboard', label: 'Дашборд', icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: '/portal/student/courses', label: 'Мои курсы', icon: <BookOpen className="h-4 w-4" /> },
  { href: '/portal/student/certificates', label: 'Сертификаты', icon: <Award className="h-4 w-4" /> },
  { href: '/portal/student/media', label: 'Медиатека', icon: <FolderOpen className="h-4 w-4" /> },
  { href: '/portal/student/verifications', label: 'Задания на проверку', icon: <Video className="h-4 w-4" /> },
  { href: '/portal/student/notifications', label: 'Уведомления', icon: <Bell className="h-4 w-4" /> },
  { href: '/portal/student/support', label: 'Поддержка', icon: <Headphones className="h-4 w-4" /> },
  { href: '/portal/student/help', label: 'Помощь', icon: <HelpCircle className="h-4 w-4" /> },
  { href: '/portal/student/profile', label: 'Профиль', icon: <User className="h-4 w-4" /> },
];

export function StudentPortalShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <PortalSidebar items={studentNav} />
      <main
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-5 md:p-7"
        style={{ background: 'var(--portal-bg)' }}
      >
        {children}
      </main>
    </div>
  );
}
