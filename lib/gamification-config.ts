/**
 * Чтение порогов геймификации из system_setting (ключи gamification_*).
 */
import { prisma } from '@/lib/db';
import {
  DEFAULT_XP_LESSON_COMPLETE,
  DEFAULT_XP_PER_LEVEL,
  parseGamificationNumbers,
  type GamificationNumbers,
} from '@/lib/gamification';

const KEYS = {
  xpPerLevel: 'gamification_xp_per_level',
  xpLessonComplete: 'gamification_xp_lesson_complete',
  xpVerificationApproved: 'gamification_xp_verification_approved',
} as const;

let mem: { at: number; data: GamificationNumbers } | null = null;
const TTL_MS = 60_000;

export function clearGamificationConfigCache(): void {
  mem = null;
}

export async function getGamificationNumbers(): Promise<GamificationNumbers> {
  const now = Date.now();
  if (mem && now - mem.at < TTL_MS) {
    return mem.data;
  }

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [KEYS.xpPerLevel, KEYS.xpLessonComplete, KEYS.xpVerificationApproved] } },
  });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
  const data = parseGamificationNumbers({
    xpPerLevel: byKey[KEYS.xpPerLevel],
    xpLessonComplete: byKey[KEYS.xpLessonComplete],
    xpVerificationApproved: byKey[KEYS.xpVerificationApproved],
  });

  mem = { at: Date.now(), data };
  return data;
}

/** Синхронные дефолты без БД (тесты, скрипты). */
export function getGamificationNumbersDefaults(): GamificationNumbers {
  return parseGamificationNumbers({});
}
