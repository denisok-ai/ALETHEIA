/**
 * Агрегаты журнала GamificationXpEvent по courseId из JSON meta (SQLite json_extract).
 * При смене БД на PostgreSQL заменить сырой SQL на эквивалент для jsonb.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export type GamificationXpByCourseRow = {
  courseId: string;
  courseTitle: string | null;
  totalXp: number;
  eventCount: number;
};

function toNum(v: unknown): number {
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'number') return v;
  return Number(v);
}

export async function getGamificationXpAggregatesByCourse(): Promise<{
  rows: GamificationXpByCourseRow[];
  warning?: string;
}> {
  try {
    const raw = await prisma.$queryRaw<
      { courseId: string | null; totalDelta: unknown; eventCount: unknown }[]
    >(Prisma.sql`
      SELECT
        json_extract(meta, '$.courseId') AS courseId,
        SUM(delta) AS totalDelta,
        COUNT(*) AS eventCount
      FROM "GamificationXpEvent"
      WHERE json_extract(meta, '$.courseId') IS NOT NULL
        AND trim(cast(json_extract(meta, '$.courseId') AS TEXT)) != ''
      GROUP BY json_extract(meta, '$.courseId')
      ORDER BY totalDelta DESC
    `);

    const ids = raw.map((r) => r.courseId).filter((id): id is string => Boolean(id));
    const courses =
      ids.length > 0
        ? await prisma.course.findMany({
            where: { id: { in: ids } },
            select: { id: true, title: true },
          })
        : [];
    const titleMap = Object.fromEntries(courses.map((c) => [c.id, c.title]));

    const rows: GamificationXpByCourseRow[] = raw
      .filter((r): r is typeof r & { courseId: string } => Boolean(r.courseId))
      .map((r) => ({
        courseId: r.courseId,
        courseTitle: titleMap[r.courseId] ?? null,
        totalXp: toNum(r.totalDelta),
        eventCount: Math.round(toNum(r.eventCount)),
      }));

    return { rows };
  } catch (e) {
    console.warn('[gamification-by-course-stats]', e);
    return {
      rows: [],
      warning: 'Не удалось загрузить агрегаты (проверьте миграции БД).',
    };
  }
}
