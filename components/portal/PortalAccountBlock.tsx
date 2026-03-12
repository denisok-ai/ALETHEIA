'use client';

/**
 * Блок учётной записи в нижней части сайдбара — светлый стиль 2026.
 */
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortalUI } from './PortalUIProvider';

export function PortalAccountBlock({ collapsed, className }: { collapsed?: boolean; className?: string }) {
  const { user, profile } = usePortalUI();

  if (!user?.email) return null;

  const displayName = profile?.display_name || user.email.split('@')[0] || 'Пользователь';
  const letters = displayName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || '?';

  async function handleLogout() {
    await signOut({ callbackUrl: '/login' });
  }

  return (
    <div className={cn(
      'flex items-center gap-2.5 pt-3',
      collapsed && 'justify-center',
      className
    )}>
      {/* Аватар */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
        bg-[var(--portal-accent-soft)] text-[var(--portal-accent-dark)]
        text-xs font-bold select-none border border-[var(--portal-accent-muted)]">
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
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md
              text-[var(--portal-text-soft)]
              hover:text-red-500 hover:bg-red-50 transition"
            title="Выйти"
            aria-label="Выйти"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
