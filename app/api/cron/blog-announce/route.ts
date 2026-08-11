/**
 * Cron: авто-анонс статьи блога в Telegram-канал (1 статья в сутки).
 * Логика и предохранители — lib/content/blog-announce.ts. ?dry=1 — показать,
 * какая статья пошла бы следующей, без отправки и heartbeat.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron-auth';
import { markCronOk } from '@/lib/cron-heartbeat';
import { announceNextBlogPost } from '@/lib/content/blog-announce';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;

  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  const result = await announceNextBlogPost({ dryRun });

  if (!dryRun) await markCronOk('blog-announce');

  return NextResponse.json(result);
}
