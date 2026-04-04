'use client';

/**
 * Только мобильная полоса: меню + колокольчик. На lg+ скрыта — дублирования с сайдбаром нет.
 */
import Link from 'next/link';
import { Menu, Bell } from 'lucide-react';
import type { Profile } from '@/lib/auth';
import { usePortalUI } from './PortalUIProvider';

interface PortalStudentManagerMobileBarProps {
  profile: Profile | null;
  unreadNotificationCount?: number;
}

export function PortalStudentManagerMobileBar({
  profile,
  unreadNotificationCount = 0,
}: PortalStudentManagerMobileBarProps) {
  const { setMobileMenuOpen } = usePortalUI();
  const role = (profile?.role as string) ?? 'user';

  return (
    <header
      className="sticky top-0 z-40 flex lg:hidden items-center justify-between gap-3
        h-[var(--portal-header-h)] px-4 md:px-6
        bg-[var(--portal-header-bg)] border-b border-[#E2E8F0]"
    >
      <button
        type="button"
        onClick={() => setMobileMenuOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
          text-[var(--portal-text-muted)]
          hover:bg-[var(--portal-surface-hover)] hover:text-[var(--portal-accent)]
          transition"
        aria-label="Открыть меню"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-1.5 shrink-0">
        <Link
          href={role === 'manager' ? '/portal/manager/tickets' : '/portal/student/notifications'}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg
            text-[var(--portal-text-muted)]
            hover:bg-[var(--portal-surface-hover)] hover:text-[var(--portal-accent)]
            transition"
          aria-label={role === 'manager' ? 'Тикеты' : 'Уведомления'}
        >
          <Bell className="h-5 w-5" />
          {role === 'user' && unreadNotificationCount > 0 && (
            <span
              className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--portal-accent)] ring-2 ring-white"
              aria-hidden
            />
          )}
        </Link>
      </div>
    </header>
  );
}
