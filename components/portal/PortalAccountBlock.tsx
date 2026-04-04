'use client';

/**
 * Блок учётной записи в нижней части сайдбара — светлый стиль 2026.
 * Для admin/manager показываются ссылки переключения: Админка, Кабинет менеджера, ЛК студента.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { LogOut, LayoutDashboard, Users, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PORTAL_PATH } from '@/lib/portal-paths';
import { usePortalUI } from './PortalUIProvider';

const SWITCH_LINKS = [
  { href: PORTAL_PATH.adminDashboard, label: 'Админка', role: 'admin' as const, icon: LayoutDashboard },
  { href: PORTAL_PATH.managerDashboard, label: 'Кабинет менеджера', role: 'manager' as const, icon: Users },
  { href: PORTAL_PATH.studentDashboard, label: 'ЛК студента', role: 'user' as const, icon: BookOpen },
];

export function PortalAccountBlock({ collapsed, className }: { collapsed?: boolean; className?: string }) {
  const { user, profile } = usePortalUI();
  const pathname = usePathname() ?? '';

  if (!user?.email) return null;

  const role = (profile?.role as string) ?? 'user';
  const displayName = profile?.display_name || user.email.split('@')[0] || 'Пользователь';
  const letters = displayName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || '?';

  const showSwitcher = !collapsed && (role === 'admin' || role === 'manager');
  const visibleLinks = showSwitcher
    ? SWITCH_LINKS.filter((l) => {
        if (l.role === 'admin' && role !== 'admin') return false;
        if (l.role === 'manager' && (role !== 'manager' && role !== 'admin')) return false;
        const prefix = l.href.replace(/\/dashboard$/, '').replace(/\/$/, '');
        const isCurrentSection = pathname === prefix || pathname.startsWith(prefix + '/');
        return !isCurrentSection;
      })
    : [];

  async function handleLogout() {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login';
    await signOut({ callbackUrl: url });
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {visibleLinks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visibleLinks.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[0.7rem] font-medium
                  text-[var(--portal-text-muted)] hover:bg-[var(--portal-surface-hover)] hover:text-[var(--portal-accent)] transition"
                title={l.label}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[90px]">{l.label}</span>
              </Link>
            );
          })}
        </div>
      )}
      <div
        className={cn(
          'flex items-center gap-2.5 pt-1',
          collapsed && 'justify-center'
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--portal-accent-soft)] text-[var(--portal-accent-dark)] text-xs font-bold select-none border border-[var(--portal-accent-muted)]">
          {letters}
        </span>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] font-semibold text-[var(--portal-text)] truncate leading-tight">
                {displayName}
              </p>
              <p className="text-[0.7rem] text-[var(--portal-text-soft)] truncate leading-tight mt-0.5">
                {user.email}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--portal-text-soft)] hover:text-red-500 hover:bg-red-50 transition"
              title="Выйти"
              aria-label="Выйти"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
