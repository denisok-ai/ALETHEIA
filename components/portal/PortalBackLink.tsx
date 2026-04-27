'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Кнопка «назад» в шапке страниц портала (lucide только на клиенте). */
export function PortalBackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm font-medium text-[var(--portal-text)] hover:bg-[#F8FAFC] hover:text-[var(--portal-accent)] transition-colors',
        className
      )}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      {children}
    </Link>
  );
}
