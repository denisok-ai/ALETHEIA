/**
 * Админ: чтение/сохранение числовых параметров геймификации (заряд / уровень заряда) в system_setting.
 * Поля JSON — условные единицы заряда; ключи в БД gamification_xp_*.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { clearGamificationConfigCache } from '@/lib/gamification-config';
import {
  DEFAULT_XP_LESSON_COMPLETE,
  DEFAULT_XP_PER_LEVEL,
  DEFAULT_XP_VERIFICATION_APPROVED,
  parseGamificationNumbers,
} from '@/lib/gamification';

const KEY_LEVEL = 'gamification_xp_per_level';
const KEY_LESSON = 'gamification_xp_lesson_complete';
const KEY_VERIFICATION = 'gamification_xp_verification_approved';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [KEY_LEVEL, KEY_LESSON, KEY_VERIFICATION] } },
  });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
  const nums = parseGamificationNumbers({
    xpPerLevel: byKey[KEY_LEVEL],
    xpLessonComplete: byKey[KEY_LESSON],
    xpVerificationApproved: byKey[KEY_VERIFICATION],
  });

  return NextResponse.json({
    xpPerLevel: nums.xpPerLevel,
    xpLessonComplete: nums.xpLessonComplete,
    xpVerificationApproved: nums.xpVerificationApproved,
    defaults: {
      xpPerLevel: DEFAULT_XP_PER_LEVEL,
      xpLessonComplete: DEFAULT_XP_LESSON_COMPLETE,
      xpVerificationApproved: DEFAULT_XP_VERIFICATION_APPROVED,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { xpPerLevel?: number; xpLessonComplete?: number; xpVerificationApproved?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rowsExisting = await prisma.systemSetting.findMany({
    where: { key: { in: [KEY_LEVEL, KEY_LESSON, KEY_VERIFICATION] } },
  });
  const byKeyExisting = Object.fromEntries(rowsExisting.map((r) => [r.key, r.value])) as Record<string, string>;
  const cur = parseGamificationNumbers({
    xpPerLevel: byKeyExisting[KEY_LEVEL],
    xpLessonComplete: byKeyExisting[KEY_LESSON],
    xpVerificationApproved: byKeyExisting[KEY_VERIFICATION],
  });

  const xpPerLevel =
    typeof body.xpPerLevel === 'number' ? Math.round(body.xpPerLevel) : cur.xpPerLevel;
  const xpLessonComplete =
    typeof body.xpLessonComplete === 'number' ? Math.round(body.xpLessonComplete) : cur.xpLessonComplete;
  const xpVerificationApproved =
    typeof body.xpVerificationApproved === 'number'
      ? Math.round(body.xpVerificationApproved)
      : cur.xpVerificationApproved;

  if (xpPerLevel < 1 || xpPerLevel > 1_000_000) {
    return NextResponse.json({ error: 'xpPerLevel must be 1–1000000' }, { status: 400 });
  }
  if (xpLessonComplete < 0 || xpLessonComplete > 100_000) {
    return NextResponse.json({ error: 'xpLessonComplete must be 0–100000' }, { status: 400 });
  }
  if (xpVerificationApproved < 0 || xpVerificationApproved > 100_000) {
    return NextResponse.json({ error: 'xpVerificationApproved must be 0–100000' }, { status: 400 });
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
    prisma.systemSetting.upsert({
      where: { key: KEY_VERIFICATION },
      create: { key: KEY_VERIFICATION, value: String(xpVerificationApproved), category: 'gamification' },
      update: { value: String(xpVerificationApproved) },
    }),
  ]);

  clearGamificationConfigCache();

  await writeAuditLog({
    actorId: auth.userId,
    action: 'settings.gamification',
    entity: 'SystemSetting',
    entityId: `${KEY_LEVEL},${KEY_LESSON},${KEY_VERIFICATION}`,
    diff: {
      xpPerLevel: String(xpPerLevel),
      xpLessonComplete: String(xpLessonComplete),
      xpVerificationApproved: String(xpVerificationApproved),
    },
  });

  return NextResponse.json({
    success: true,
    xpPerLevel,
    xpLessonComplete,
    xpVerificationApproved,
  });
}
