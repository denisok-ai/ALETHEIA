'use client';

/**
 * Portal header — burger, logo, уведомления. Профиль и выход — в сайдбаре.
 */
import Link from 'next/link';
import { Menu, Bell } from 'lucide-react';
import type { Profile } from '@/lib/auth';
import { usePortalUI } from './PortalUIProvider';

interface PortalHeaderProps {
  user: { email?: string | null };
  profile: Profile | null;
  portalTitle?: string;
  /** Unread notification count (students only); dot shown when > 0 */
  unreadNotificationCount?: number;
}

export function PortalHeader({ profile, portalTitle = 'Аватера', unreadNotificationCount = 0 }: PortalHeaderProps) {
  const { setMobileMenuOpen } = usePortalUI();
  const role = (profile?.role as string) ?? 'user';

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between gap-3
        h-[var(--portal-header-h)] px-4 md:px-6
        bg-[var(--portal-header-bg)] border-b border-[#E2E8F0]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden flex h-9 w-9 shrink-0 items-center justify-center
            rounded-lg text-[var(--portal-text-muted)]
            hover:bg-[var(--portal-surface-hover)] hover:text-[var(--portal-accent)]
            transition"
          aria-label="Открыть меню"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link
          href="/"
          className="hidden lg:flex items-center gap-2 font-heading font-bold text-[var(--portal-primary)]
            text-lg tracking-tight select-none hover:opacity-80 transition"
        >
          {portalTitle}
        </Link>
      </div>

      <div className="flex items-center gap-1.5">
        {role !== 'admin' && (
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
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--portal-accent)] ring-2 ring-white" aria-hidden />
            )}
          </Link>
        )}
      </div>
    </header>
  );
}
