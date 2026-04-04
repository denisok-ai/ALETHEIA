import type { GamificationDb } from '@/lib/gamification';

export type GamificationXpSource = 'lesson_complete' | 'admin_delta' | 'admin_set' | 'verification_approved';

export async function recordGamificationXpEvent(
  db: GamificationDb,
  params: {
    userId: string;
    source: GamificationXpSource;
    delta: number;
    balanceAfter: number;
    meta: Record<string, unknown>;
  }
): Promise<void> {
  await db.gamificationXpEvent.create({
    data: {
      userId: params.userId,
      source: params.source,
      delta: params.delta,
      balanceAfter: params.balanceAfter,
      meta: JSON.stringify(params.meta),
    },
  });
}
