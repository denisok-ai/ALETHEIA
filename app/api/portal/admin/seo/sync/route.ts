/**
 * Admin: ручной синк SEO-метрик за последние 7 дней (кнопка на странице /portal/admin/seo).
 * Возвращает отчёт по источникам; сами коннекторы и журнал прогонов — в lib/seo/sync.ts.
 *
 * Параллельный запуск запрещён: 409, если уже идёт прогон (в журнале SeoSyncRun — открытый
 * моложе 10 минут) либо этот же процесс обрабатывает другой запрос (двойной клик до записи в журнал).
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { hasRunningSeoSync } from '@/lib/seo/store';
import { runSeoSync } from '@/lib/seo/sync';
import { SYNC_BUSY_MESSAGE } from '@/lib/seo/sync-messages';

export const dynamic = 'force-dynamic';

/** Флаг на уровне процесса: закрывает окно между проверкой журнала и открытием прогона. */
let localRunInFlight = false;

export async function POST() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (localRunInFlight || (await hasRunningSeoSync())) {
    return NextResponse.json({ error: SYNC_BUSY_MESSAGE }, { status: 409 });
  }

  localRunInFlight = true;
  try {
    const report = await runSeoSync({ days: 7 });
    return NextResponse.json({ report });
  } finally {
    localRunInFlight = false;
  }
}
