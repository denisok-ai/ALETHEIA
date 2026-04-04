/**
 * Админ: сумма начисленного заряда и число событий по курсам (meta.courseId в журнале).
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getGamificationXpAggregatesByCourse } from '@/lib/gamification-by-course-stats';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { rows, warning } = await getGamificationXpAggregatesByCourse();
  return NextResponse.json({ rows, warning });
}
