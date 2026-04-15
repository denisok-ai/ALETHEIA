'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Разделяет фон и цвет текста: публичные страницы — токены лендинга; /portal — LMS.
 */
export function RootMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const portal = pathname?.startsWith('/portal');

  const className = cn(
    portal
      ? 'min-h-[100dvh] flex flex-1 flex-col bg-[var(--portal-bg)] text-[var(--portal-text)]'
      : 'min-h-screen bg-[var(--bg)] text-[var(--text)] subpixel-antialiased'
  );

  /* Портал: внутри shell уже есть <main>; на публичных страницах — один landmark main. */
  if (portal) {
    return (
      <div id="main-content" className={className}>
        {children}
      </div>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className={className}>
      {children}
    </main>
  );
}
