/**
 * Админ: чтение/сохранение числовых параметров геймификации (заряд / уровень заряда) в system_setting.
 * Поля JSON xpPerLevel / xpLessonComplete — условные единицы заряда; ключи в БД прежние (gamification_xp_*).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { clearGamificationConfigCache } from '@/lib/gamification-config';
import { DEFAULT_XP_LESSON_COMPLETE, DEFAULT_XP_PER_LEVEL, parseGamificationNumbers } from '@/lib/gamification';

const KEY_LEVEL = 'gamification_xp_per_level';
const KEY_LESSON = 'gamification_xp_lesson_complete';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [KEY_LEVEL, KEY_LESSON] } },
  });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
  const nums = parseGamificationNumbers({
    xpPerLevel: byKey[KEY_LEVEL],
    xpLessonComplete: byKey[KEY_LESSON],
  });

  return NextResponse.json({
    xpPerLevel: nums.xpPerLevel,
    xpLessonComplete: nums.xpLessonComplete,
    defaults: {
      xpPerLevel: DEFAULT_XP_PER_LEVEL,
      xpLessonComplete: DEFAULT_XP_LESSON_COMPLETE,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { xpPerLevel?: number; xpLessonComplete?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const xpPerLevel = typeof body.xpPerLevel === 'number' ? Math.round(body.xpPerLevel) : null;
  const xpLessonComplete = typeof body.xpLessonComplete === 'number' ? Math.round(body.xpLessonComplete) : null;

  if (xpPerLevel === null || xpLessonComplete === null) {
    return NextResponse.json({ error: 'xpPerLevel and xpLessonComplete (numbers) required' }, { status: 400 });
  }
  if (xpPerLevel < 1 || xpPerLevel > 1_000_000) {
    return NextResponse.json({ error: 'xpPerLevel must be 1–1000000' }, { status: 400 });
  }
  if (xpLessonComplete < 0 || xpLessonComplete > 100_000) {
    return NextResponse.json({ error: 'xpLessonComplete must be 0–100000' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: KEY_LEVEL },
      create: { key: KEY_LEVEL, value: String(xpPerLevel), category: 'gamification' },
      update: { value: String(xpPerLevel) },
    }),
    prisma.systemSetting.upsert({
      where: { key: KEY_LESSON },
      create: { key: KEY_LESSON, value: String(xpLessonComplete), category: 'gamification' },
      update: { value: String(xpLessonComplete) },
    }),
  ]);

  clearGamificationConfigCache();

  await writeAuditLog({
    actorId: auth.userId,
    action: 'settings.gamification',
    entity: 'SystemSetting',
    entityId: `${KEY_LEVEL},${KEY_LESSON}`,
    diff: { xpPerLevel: String(xpPerLevel), xpLessonComplete: String(xpLessonComplete) },
  });

  return NextResponse.json({ success: true, xpPerLevel, xpLessonComplete });
}
