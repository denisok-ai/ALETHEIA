'use client';

/**
 * Верхняя полоса с логотипом/названием убрана — навигация в сайдбаре.
 * Студент и менеджер: только узкая мобильная полоса (бургер + колокольчик, `lg:hidden`).
 */
import { usePathname } from 'next/navigation';
import { PortalStudentManagerMobileBar } from './PortalStudentManagerMobileBar';
import type { Profile } from '@/lib/auth';

interface PortalHeaderWrapperProps {
  user: { email?: string | null };
  profile: Profile | null;
  portalTitle?: string;
  unreadNotificationCount?: number;
}

export function PortalHeaderWrapper(props: PortalHeaderWrapperProps) {
  const pathname = usePathname();
  if (pathname?.startsWith('/portal/student') || pathname?.startsWith('/portal/manager')) {
    return (
      <PortalStudentManagerMobileBar
        profile={props.profile}
        unreadNotificationCount={props.unreadNotificationCount}
      />
    );
  }
  return null;
}
