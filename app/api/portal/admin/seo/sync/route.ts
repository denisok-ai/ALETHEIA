/**
 * Admin: ручной синк SEO-метрик за последние 7 дней (кнопка на странице /portal/admin/seo).
 * Возвращает отчёт по источникам; сами коннекторы и журнал прогонов — в lib/seo/sync.ts.
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { runSeoSync } from '@/lib/seo/sync';

export const dynamic = 'force-dynamic';

export async function POST() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const report = await runSeoSync({ days: 7 });
  return NextResponse.json({ report });
}
