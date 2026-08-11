/**
 * Авто-анонс статей блога в Telegram-канал — контур самораскрутки сайта.
 *
 * Отличие от SMM-конвейера (lib/content/pipeline): анонс детерминирован —
 * заголовок, описание и ссылка уже опубликованной на сайте статьи, никакой
 * LLM-генерации, поэтому и отдельного одобрения не требует. Публикует не чаще
 * одной статьи в сутки (cron), только статьи источника 'kb' — статьи,
 * импортированные ИЗ канала (source='telegram'), анонсировать обратно нельзя:
 * подписчики получили бы свой же пост второй раз.
 *
 * Требует заданного канала (content_channel_id / CONTENT_CHANNEL_ID — тот же,
 * что у SMM-конвейера) и прав бота на публикацию. Пока канал не задан — no-op.
 * Выключатель: SystemSetting blog_announce_enabled = 'false'.
 * Идемпотентность: список анонсированных slug в SystemSetting.
 */
import { prisma } from '@/lib/db';
import { sendTelegramMessageWithResult } from '@/lib/telegram';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';
import { getContentConfig } from './config';

const ANNOUNCED_KEY = 'blog_announced_slugs';
const ENABLED_KEY = 'blog_announce_enabled';

async function readAnnounced(): Promise<string[]> {
  const row = await prisma.systemSetting.findUnique({ where: { key: ANNOUNCED_KEY } });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

async function writeAnnounced(slugs: string[]): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: ANNOUNCED_KEY },
    update: { value: JSON.stringify(slugs) },
    create: { key: ANNOUNCED_KEY, value: JSON.stringify(slugs), category: 'content' },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type BlogAnnounceResult = {
  ok: boolean;
  skipped?: 'disabled' | 'paused' | 'no_channel' | 'nothing_to_announce';
  slug?: string;
  dryRun?: boolean;
  error?: string;
};

export async function announceNextBlogPost(opts?: { dryRun?: boolean }): Promise<BlogAnnounceResult> {
  const enabledRow = await prisma.systemSetting.findUnique({ where: { key: ENABLED_KEY } });
  // Включено по умолчанию: контур должен заработать сам, как только задан канал.
  if (enabledRow?.value === 'false') return { ok: true, skipped: 'disabled' };

  const config = await getContentConfig();
  if (config.paused) return { ok: true, skipped: 'paused' };
  const channelId = config.contentChannelId;
  if (!channelId) return { ok: true, skipped: 'no_channel' };

  const announced = await readAnnounced();
  // Старейшая неанонсированная — канал получает статьи в порядке ленты,
  // и однажды догнав её, дальше анонсирует только новые.
  const post = await prisma.blogPost.findFirst({
    where: { status: 'published', source: 'kb', slug: { notIn: announced } },
    orderBy: { publishedAt: 'asc' },
    select: { slug: true, h1: true, title: true, description: true },
  });
  if (!post) return { ok: true, skipped: 'nothing_to_announce' };

  const title = post.h1 || post.title;
  const url = `${config.siteUrl}/blog/${post.slug}`;
  const text = [
    `<b>${escapeHtml(title)}</b>`,
    '',
    escapeHtml(post.description ?? ''),
    '',
    `Читать на сайте: ${url}`,
  ].join('\n');

  if (opts?.dryRun) return { ok: true, slug: post.slug, dryRun: true };

  const r = await sendTelegramMessageWithResult(channelId, text);
  if (!r.ok) {
    notifyAdminsTelegramAsync('blog_announced', [
      `Не удалось анонсировать статью «${title}» в канал: ${r.error ?? 'ошибка отправки'}`,
    ]);
    return { ok: false, slug: post.slug, error: r.error ?? 'send failed' };
  }

  await writeAnnounced([...announced, post.slug]);
  notifyAdminsTelegramAsync('blog_announced', [`«${title}»`, url]);
  return { ok: true, slug: post.slug };
}
