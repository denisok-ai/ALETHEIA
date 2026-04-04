import { triggerNotification } from '@/lib/notifications';
import {
  getEarnedBadges,
  levelFromTotalXp,
} from '@/lib/gamification';

/**
 * Уведомления при росте уровня заряда и при получении новых бейджей (после изменения суммарного XP).
 */
export async function notifyGamificationAfterXpChange(opts: {
  userId: string;
  oldXp: number;
  newXp: number;
  xpPerLevel: number;
}): Promise<void> {
  const { userId, oldXp, newXp, xpPerLevel } = opts;
  const oldLevel = levelFromTotalXp(oldXp, xpPerLevel);
  const newLevel = levelFromTotalXp(newXp, xpPerLevel);
  if (newLevel > oldLevel) {
    await triggerNotification({
      eventType: 'gamification_level_up',
      userId,
      metadata: { level: newLevel, total_xp: newXp },
    });
  }

  const oldBadges = getEarnedBadges(oldXp);
  const oldMin = new Set(oldBadges.map((b) => b.minXp));
  for (const b of getEarnedBadges(newXp)) {
    if (!oldMin.has(b.minXp)) {
      await triggerNotification({
        eventType: 'gamification_badge_unlocked',
        userId,
        metadata: {
          badgename: b.label,
          badgeemoji: b.emoji,
          minXp: b.minXp,
        },
      });
    }
  }
}
