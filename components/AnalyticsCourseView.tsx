'use client';

import { useEffect } from 'react';
import { ANALYTICS, trackGa4AndYm } from '@/lib/analytics-events';

/** Просмотр страницы публичного курса (один раз за монтирование). */
export function AnalyticsCourseView() {
  useEffect(() => {
    trackGa4AndYm(ANALYTICS.PAGE_VIEW_COURSE, ANALYTICS.PAGE_VIEW_COURSE, {
      page_location: typeof window !== 'undefined' ? window.location.href : '',
    });
  }, []);
  return null;
}
