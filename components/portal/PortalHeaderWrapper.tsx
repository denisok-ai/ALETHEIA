'use client';

/**
 * Обёртка PortalHeader: скрывает хедер в админке (навигация в сайдбаре).
 */
import { usePathname } from 'next/navigation';
import { PortalHeader } from './PortalHeader';
import type { Profile } from '@/lib/auth';

interface PortalHeaderWrapperProps {
  user: { email?: string | null };
  profile: Profile | null;
  portalTitle?: string;
  unreadNotificationCount?: number;
}

export function PortalHeaderWrapper(props: PortalHeaderWrapperProps) {
  const pathname = usePathname();
  if (pathname?.startsWith('/portal/admin')) return null;
  return <PortalHeader {...props} />;
}
