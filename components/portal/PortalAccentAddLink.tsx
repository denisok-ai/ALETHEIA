'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';

/** Основная кнопка «добавить» в шапке (шаблоны и т.п.). */
export function PortalAccentAddLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg bg-[var(--portal-accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--portal-accent-dark)] shadow-sm transition-colors"
    >
      <Plus className="h-4 w-4 shrink-0" aria-hidden />
      {children}
    </Link>
  );
}
