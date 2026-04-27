'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isMinimalPublicShell } from '@/lib/public-shell-paths';

/**
 * Разделяет фон и цвет текста: публичные страницы — токены лендинга; /portal — LMS.
 * Под фиксированный header на лендинге — верхний отступ (иначе контент уезжает под шапку).
 */
export function RootMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const portal = pathname?.startsWith('/portal');
  const minimal = isMinimalPublicShell(pathname);

  const className = cn(
    portal
      ? 'min-h-[100dvh] flex flex-1 flex-col bg-[var(--portal-bg)] text-[var(--portal-text)]'
      : 'min-h-screen bg-[var(--bg)] text-[var(--text)] subpixel-antialiased',
    !portal && !minimal && 'pt-[4.75rem] sm:pt-[5rem] md:pt-[5.5rem]'
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
