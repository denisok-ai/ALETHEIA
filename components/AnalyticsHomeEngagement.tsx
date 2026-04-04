'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { ANALYTICS, trackGa4AndYm } from '@/lib/analytics-events';

/** Таймер вовлечённости ~2 мин на главной (один раз за сессию вкладки). */
export function AnalyticsHomeEngagement() {
  const pathname = usePathname();
  const fired = useRef(false);

  useEffect(() => {
    if (pathname !== '/') return;
    if (fired.current) return;
    const t = window.setTimeout(() => {
      fired.current = true;
      trackGa4AndYm(ANALYTICS.ENGAGEMENT_2MIN, ANALYTICS.ENGAGEMENT_2MIN);
    }, 120_000);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return null;
}
