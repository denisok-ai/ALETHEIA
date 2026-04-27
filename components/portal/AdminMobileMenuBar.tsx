'use client';

/**
 * Минимальная полоска для админки на мобильных: только кнопка «Меню» для открытия сайдбара.
 */
import { Menu } from 'lucide-react';
import { usePortalUI } from './PortalUIProvider';

export function AdminMobileMenuBar() {
  const { setMobileMenuOpen } = usePortalUI();

  return (
    <div
      className="lg:hidden flex items-center h-[var(--portal-header-h)] px-4
        bg-[var(--portal-header-bg)] border-b border-[#E2E8F0] shrink-0"
      aria-hidden
    >
      <button
        type="button"
        onClick={() => setMobileMenuOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg
          text-[var(--portal-text-muted)]
          hover:bg-[var(--portal-surface-hover)] hover:text-[var(--portal-accent)]
          transition"
        aria-label="Открыть меню"
      >
        <Menu className="h-5 w-5" />
      </button>
    </div>
  );
}
