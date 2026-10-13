'use client';

import { usePathname } from 'next/navigation';
import { Footer } from '@/components/sections/Footer';
import { isMinimalPublicShell } from '@/lib/public-shell-paths';

/** Рендерит футер только на публичных страницах; в портале (админка, студент, менеджер) футер не показывается. */
export function FooterOnPublicOnly({
  contactPhone,
  acqRef,
}: {
  contactPhone?: string | null;
  acqRef?: string | null;
}) {
  const pathname = usePathname();
  if (pathname?.startsWith('/portal') || isMinimalPublicShell(pathname)) return null;
  return <Footer contactPhone={contactPhone} acqRef={acqRef} />;
}
