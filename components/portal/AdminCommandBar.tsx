'use client';

/**
 * Компактная полоса над контентом админки: быстрый вызов палитры команд (⌘K).
 */
import { Search } from 'lucide-react';

export function AdminCommandBar() {
  return (
    <div className="hidden shrink-0 border-b border-[var(--portal-sidebar-border)] bg-[var(--portal-sidebar-bg)] px-3 py-2 lg:flex lg:items-center">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('portal-open-command-palette'))}
        className="inline-flex min-h-9 w-full max-w-md items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-left text-sm text-[var(--portal-text-muted)] transition-colors hover:border-[var(--portal-accent-muted)] hover:bg-[var(--portal-accent-soft)] hover:text-[var(--portal-accent-dark)]"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span>Поиск и переход по разделам…</span>
        <kbd className="ml-auto hidden rounded border border-[#E2E8F0] bg-white px-1.5 py-0.5 font-sans text-[10px] text-[var(--portal-text-soft)] sm:inline">
          ⌘K
        </kbd>
      </button>
    </div>
  );
}
