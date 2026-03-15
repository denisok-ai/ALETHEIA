'use client';

/**
 * Portal header — redesigned: avatar, role badge, notifications bell, user dropdown.
 */
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { LogOut, Menu, Bell, User, Settings, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/auth';
import { usePortalUI } from './PortalUIProvider';

interface PortalHeaderProps {
  user: { email?: string | null };
  profile: Profile | null;
  portalTitle?: string;
  /** Unread notification count (students only); dot shown when > 0 */
  unreadNotificationCount?: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin:   'Администратор',
  manager: 'Менеджер',
  user:    'Слушатель',
};

const PROFILE_HREFS: Record<string, string> = {
  admin:   '/portal/admin/settings',
  manager: '/portal/manager/dashboard',
  user:    '/portal/student/profile',
};

function AvatarCircle({ name }: { name: string }) {
  const letters = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
        bg-[var(--portal-accent-soft)] text-[var(--portal-accent-dark)]
        text-xs font-bold select-none border border-[var(--portal-accent-muted)]"
      aria-hidden
    >
      {letters}
    </span>
  );
}

export function PortalHeader({ user, profile, portalTitle = 'AVATERRA', unreadNotificationCount = 0 }: PortalHeaderProps) {
  const [open, setOpen] = useState(false);
  const ref        = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { setMobileMenuOpen } = usePortalUI();

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Пользователь';
  const email       = user?.email ?? '';
  const role        = (profile?.role as string) ?? 'user';
  const roleLabel   = ROLE_LABELS[role] ?? role;
  const profileHref = PROFILE_HREFS[role] ?? '/portal/student/profile';

  /* close on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  /* focus trap in dropdown */
  useEffect(() => {
    if (!open || !dropdownRef.current) return;
    const el = dropdownRef.current;
    const focusables = el.querySelectorAll<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    const url = typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login';
    await signOut({ callbackUrl: url });
  }

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between gap-3
        h-[var(--portal-header-h)] px-4 md:px-6
        bg-[var(--portal-header-bg)] border-b border-[#E2E8F0]"
    >
      {/* Left: burger + logo */}
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

      {/* Right: notifications + user */}
      <div className="flex items-center gap-1.5">

        {/* Уведомления / Тикеты / Журнал */}
        <Link
          href={role === 'admin' ? '/portal/admin/notification-logs' : role === 'manager' ? '/portal/manager/tickets' : '/portal/student/notifications'}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg
            text-[var(--portal-text-muted)]
            hover:bg-[var(--portal-surface-hover)] hover:text-[var(--portal-accent)]
            transition"
          aria-label={role === 'admin' ? 'Журнал уведомлений' : role === 'manager' ? 'Тикеты' : 'Уведомления'}
        >
          <Bell className="h-5 w-5" />
          {role === 'user' && unreadNotificationCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--portal-accent)] ring-2 ring-white" aria-hidden />
          )}
        </Link>

        {/* Аватар + дропдаун */}
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-xl px-2 py-1.5
              hover:bg-[var(--portal-surface-hover)] transition"
            aria-expanded={open}
            aria-haspopup="true"
          >
            <AvatarCircle name={displayName} />
            <span className="hidden md:flex flex-col items-start leading-none">
              <span className="text-sm font-semibold text-[var(--portal-text)] max-w-[120px] truncate">
                {displayName}
              </span>
              <span className="text-[0.7rem] text-[var(--portal-text-muted)] mt-0.5">
                {roleLabel}
              </span>
            </span>
            <ChevronDown className={cn(
              'hidden md:block h-4 w-4 text-[var(--portal-text-muted)] transition-transform',
              open && 'rotate-180'
            )} />
          </button>

          {open && (
            <div
              ref={dropdownRef}
              role="menu"
              className="absolute right-0 top-full mt-2 w-56
                rounded-[var(--portal-radius-lg)] border border-[#E2E8F0]
                bg-white shadow-[var(--portal-shadow-md)]
                overflow-hidden z-50"
            >
              {/* Шапка дропдауна */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F1F5F9] bg-[#F8FAFC]">
                <AvatarCircle name={displayName} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--portal-text)] truncate">{displayName}</p>
                  <p className="text-xs text-[var(--portal-text-muted)] truncate">{email}</p>
                </div>
              </div>

              <div className="py-1">
                <Link
                  href={profileHref}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm
                    text-[var(--portal-text)] hover:bg-[#F8FAFC] transition"
                >
                  <User className="h-4 w-4 text-[var(--portal-text-muted)]" />
                  Мой профиль
                </Link>

                {role === 'admin' && (
                  <Link
                    href="/portal/admin/settings"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm
                      text-[var(--portal-text)] hover:bg-[#F8FAFC] transition"
                  >
                    <Settings className="h-4 w-4 text-[var(--portal-text-muted)]" />
                    Настройки
                  </Link>
                )}

                <div className="my-1 h-px bg-[#F1F5F9]" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm
                    text-red-500 hover:bg-red-50 transition"
                >
                  <LogOut className="h-4 w-4" />
                  Выйти
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
