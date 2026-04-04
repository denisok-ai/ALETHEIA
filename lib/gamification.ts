/**
 * Единый источник правил геймификации (уровни заряда, бейджи, начисление заряда за уроки).
 * В коде и БД поля userEnergy.xp — условные единицы накопленного заряда (метафора «батарейки»).
 * Числовые параметры по умолчанию переопределяются через БД (см. getGamificationNumbers).
 */
import type { PrismaClient } from '@prisma/client';

export const DEFAULT_XP_PER_LEVEL = 100;
export const DEFAULT_XP_LESSON_COMPLETE = 25;

export interface GamificationBadge {
  /** Порог по суммарному накопленному заряду (условные единицы; поле в БД — xp). */
  minXp: number;
  label: string;
  emoji: string;
}

/** Пороги бейджей по суммарному заряду (отсортированы по minXp). */
export const GAMIFICATION_BADGES: readonly GamificationBadge[] = [
  { minXp: 0, label: 'Новичок', emoji: '🌱' },
  { minXp: 50, label: 'Практик', emoji: '💪' },
  { minXp: 100, label: 'Уверенный', emoji: '⭐' },
  { minXp: 200, label: 'Мастер', emoji: '🏆' },
  { minXp: 500, label: 'Эксперт', emoji: '👑' },
] as const;

export function levelFromTotalXp(totalXp: number, xpPerLevel: number): number {
  if (xpPerLevel < 1) return 1;
  const xp = Math.max(0, Math.floor(totalXp));
  return Math.floor(xp / xpPerLevel) + 1;
}

/** Доля заполнения полосы «текущий уровень» 0–100. */
export function xpProgressPercentInCurrentLevel(totalXp: number, xpPerLevel: number): number {
  if (xpPerLevel < 1) return 0;
  const xp = Math.max(0, Math.floor(totalXp));
  return ((xp % xpPerLevel) / xpPerLevel) * 100;
}

export function getEarnedBadges(totalXp: number): GamificationBadge[] {
  const xp = Math.max(0, Math.floor(totalXp));
  return GAMIFICATION_BADGES.filter((b) => xp >= b.minXp);
}

export function getNextBadge(totalXp: number): GamificationBadge | undefined {
  const xp = Math.max(0, Math.floor(totalXp));
  return GAMIFICATION_BADGES.find((b) => xp < b.minXp);
}

export interface GamificationNumbers {
  xpPerLevel: number;
  xpLessonComplete: number;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Парсинг настроек из строк БД. */
export function parseGamificationNumbers(raw: { xpPerLevel?: string | null; xpLessonComplete?: string | null }): GamificationNumbers {
  const xpPerLevel = clampInt(parseInt(raw.xpPerLevel ?? '', 10) || DEFAULT_XP_PER_LEVEL, 1, 1_000_000);
  const xpLessonComplete = clampInt(parseInt(raw.xpLessonComplete ?? '', 10) || DEFAULT_XP_LESSON_COMPLETE, 0, 100_000);
  return { xpPerLevel, xpLessonComplete };
}

/**
 * Начисляет заряд (поле `userEnergy.xp`) за первое завершение урока (переход в completed/passed).
 * Только для роли student (`user`). Идемпотентно: повторные сохранения с тем же «завершён» не добавляют заряд.
 */
export async function awardXpForLessonCompletedIfNew(
  prisma: PrismaClient,
  opts: {
    userId: string;
    role: string | undefined;
    previousCompletionStatus: string | null | undefined;
    newCompletionStatus: string | null | undefined;
    xpDelta: number;
    xpPerLevel: number;
  }
): Promise<{ awarded: boolean; newXp?: number; newLevel?: number }> {
  const { userId, role, previousCompletionStatus, newCompletionStatus, xpDelta, xpPerLevel } = opts;

  if (role !== 'user') {
    return { awarded: false };
  }
  if (xpDelta <= 0) {
    return { awarded: false };
  }

  const wasCompleted =
    previousCompletionStatus === 'completed' || previousCompletionStatus === 'passed';
  const nowCompleted = newCompletionStatus === 'completed' || newCompletionStatus === 'passed';
  if (wasCompleted || !nowCompleted) {
    return { awarded: false };
  }

  const existing = await prisma.userEnergy.findUnique({ where: { userId } });
  const oldXp = existing?.xp ?? 0;
  const newXp = oldXp + xpDelta;

  const newLevel = levelFromTotalXp(newXp, xpPerLevel);

  await prisma.userEnergy.upsert({
    where: { userId },
    create: {
      userId,
      xp: newXp,
      level: newLevel,
      lastPracticeAt: new Date(),
    },
    update: {
      xp: newXp,
      level: newLevel,
      lastPracticeAt: new Date(),
    },
  });

  return { awarded: true, newXp, newLevel };
}
