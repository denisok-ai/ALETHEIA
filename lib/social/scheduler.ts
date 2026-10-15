/**
 * Планировщик автопубликации (T3.4). Образец: audio-mastering-web/backend/app/social/scheduler.py.
 *
 * Один проход tick(now) (крон каждые 10 минут, app/api/cron/social-publish):
 *  - стоит пауза всех сетей (SocialRule paused_all = '1') → ничего не делаем;
 *  - для каждой включённой сети с mode=auto берём самый ранний пост status=scheduled,
 *    scheduledAt <= now, материал в статусе ready;
 *  - не больше ОДНОЙ публикации в сеть за календарный день по Москве;
 *  - неудача: attempts+1; после 3 попыток — failed. Две неудачи подряд в сети —
 *    сеть выключается (enabled=false) и владелец получает алерт в Telegram.
 *
 * Блокировка от двойной публикации:
 *  1. Захват поста транзакцией: проверка «сегодня уже было» + updateMany(status scheduled → publishing).
 *     Два параллельных прохода не могут захватить один пост и не могут взять два поста в один день
 *     (SQLite пишет последовательно, транзакция откатывается при конфликте).
 *  2. Пост в статусе publishing не берётся никем. Если процесс умер на середине, через 10 минут
 *     такой пост переводится в failed, а владелец получает алерт «проверьте канал».
 *     Автоматического повтора нет: пост мог уже уйти в канал.
 *  3. Неоднозначный сбой (запрос ушёл, ответ потерян) — тоже без авто-повтора.
 */
import type { SocialItem, SocialPost } from '@prisma/client';
import { prisma } from '@/lib/db';
import { notifyAdminsTelegram } from '@/lib/telegram-admin-notify';
import * as max from './connectors/max';
import { SocialPublishError, type SocialPublished } from './connectors/publish-error';
import * as telegram from './connectors/telegram';
import { DEFAULT_SOCIAL_MEDIA_DIR, resolveSocialMediaPath } from './media-path';
import { mskDayBounds } from './moscow-day';

export const PAUSE_ALL_RULE = 'paused_all';
export const MEDIA_DIR_RULE = 'social_media_dir';

export const SCHEDULER_LIMITS = {
  /** Публикаций в сеть за календарный день (МСК). */
  perNetworkPerDay: 1,
  /** Подряд неудачных попыток, после которых сеть выключается. */
  stopAfterFailures: 2,
  /** Попыток на пост, после которых он уходит в failed. */
  maxAttempts: 3,
  /** Пост, висящий в publishing дольше этого, считаем прерванным. */
  staleLockMs: 10 * 60 * 1000,
} as const;

/** Что вернул коннектор: Telegram даёт числовой id сообщения, MAX — строковый mid. */
type Published = Omit<SocialPublished, 'messageId'> & { messageId: number | string };
type Connector = {
  publishVideo(p: { chatId: string; filePath: string; caption: string }): Promise<Published>;
  publishText(p: { chatId: string; text: string }): Promise<Published>;
};

/** Коннекторы по коду сети. Остальные сети (vk, youtube…) пока не публикуются. */
const CONNECTORS: Readonly<Record<string, Connector>> = { telegram, max };
const CONNECTED_NETWORKS = new Set(Object.keys(CONNECTORS));

/** Название площадки для текстов алертов. */
const PLATFORM_NAMES: Readonly<Record<string, string>> = { telegram: 'Telegram', max: 'MAX' };
const platformName = (code: string) => PLATFORM_NAMES[code] ?? code;

export type TickReport = {
  published: number[];
  failed: number[];
  /** Пост остался в очереди: почему (для лога и ответа cron). */
  held: string[];
  /** Сети, которые выключил планировщик из-за ошибок подряд. */
  stopped: string[];
  /** Посты, зависшие в publishing и переведённые в failed. */
  recovered: number[];
};

export function emptyReport(): TickReport {
  return { published: [], failed: [], held: [], stopped: [], recovered: [] };
}

type Claim =
  | { kind: 'claimed'; post: SocialPost & { item: SocialItem } }
  | { kind: 'day_taken' }
  | { kind: 'lost' };

function errorText(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 500);
}

async function alertOwner(lines: string[]): Promise<void> {
  // notifyAdminsTelegram не бросает: сбой алерта не должен ломать проход.
  await notifyAdminsTelegram('social_autopublish', lines);
}

export async function getMediaDir(): Promise<string> {
  const row = await prisma.systemSetting.findUnique({ where: { key: MEDIA_DIR_RULE } });
  return row?.value?.trim() || DEFAULT_SOCIAL_MEDIA_DIR;
}

/** Захват поста: атомарно проверяем «сегодня уже публиковали» и переводим пост в publishing. */
async function claimPost(networkCode: string, postId: number, now: Date): Promise<Claim> {
  return prisma.$transaction(async (tx) => {
    const { start, end } = mskDayBounds(now);
    const takenToday = await tx.socialPost.count({
      where: {
        networkCode,
        status: { in: ['publishing', 'published'] },
        publishedAt: { gte: start, lt: end },
      },
    });
    if (takenToday >= SCHEDULER_LIMITS.perNetworkPerDay) return { kind: 'day_taken' } as const;

    const res = await tx.socialPost.updateMany({
      where: { id: postId, status: 'scheduled' },
      data: {
        status: 'publishing',
        attempts: { increment: 1 },
        // Время попытки: по нему же считается «публикация сегодня» (см. выше).
        publishedAt: now,
        error: null,
        updatedAt: now,
      },
    });
    if (res.count !== 1) return { kind: 'lost' } as const;

    const post = await tx.socialPost.findUniqueOrThrow({ where: { id: postId }, include: { item: true } });
    return { kind: 'claimed', post } as const;
  });
}

/** Посты, зависшие в publishing дольше порога, — в failed. Повтора нет: владелец проверяет канал. */
async function recoverStalePosts(now: Date, report: TickReport): Promise<void> {
  const cutoff = new Date(now.getTime() - SCHEDULER_LIMITS.staleLockMs);
  const stale = await prisma.socialPost.findMany({
    where: { status: 'publishing', updatedAt: { lt: cutoff } },
    select: { id: true, networkCode: true },
  });
  for (const post of stale) {
    const res = await prisma.socialPost.updateMany({
      where: { id: post.id, status: 'publishing' },
      data: {
        status: 'failed',
        publishedAt: null,
        error: 'Публикация прервана (пост завис в статусе publishing). Возможно, он уже в канале: проверьте канал, повтор — вручную.',
        updatedAt: now,
      },
    });
    if (res.count === 1) {
      report.recovered.push(post.id);
      await alertOwner([
        `Публикация прервана: пост ${post.id} (${post.networkCode}) завис в статусе publishing.`,
        'Пост мог уже уйти в канал. Проверьте канал вручную; повтор — только после проверки.',
      ]);
    }
  }
}

async function publishClaimed(
  net: { id: number; code: string; title: string },
  chatId: string,
  post: SocialPost & { item: SocialItem },
  now: Date,
  mediaDir: string,
  report: TickReport,
): Promise<void> {
  try {
    const connector = CONNECTORS[net.code];
    let res: Published;
    if (post.item.mediaPath) {
      const filePath = resolveSocialMediaPath(post.item.mediaPath, mediaDir);
      res = await connector.publishVideo({ chatId, filePath, caption: post.caption });
    } else {
      res = await connector.publishText({ chatId, text: post.caption });
    }
    const { messageId, url } = res;
    await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: 'published',
        publishedAt: now,
        externalId: String(messageId),
        externalUrl: url,
        error: null,
        updatedAt: now,
      },
    });
    await prisma.socialNetwork.update({ where: { id: net.id }, data: { failStreak: 0, lastError: null } });
    report.published.push(post.id);
  } catch (e) {
    await handlePublishError(net, post, e, now, report);
  }
}

async function handlePublishError(
  net: { id: number; code: string; title: string },
  post: SocialPost & { item: SocialItem },
  e: unknown,
  now: Date,
  report: TickReport,
): Promise<void> {
  // Лимит площадки: это не ошибка поста. Попытку не засчитываем, пост ждёт следующего прохода.
  if (e instanceof SocialPublishError && e.kind === 'flood') {
    await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: 'scheduled',
        attempts: { decrement: 1 },
        publishedAt: null,
        error: errorText(e),
        updatedAt: now,
      },
    });
    report.held.push(`${net.code}: лимит ${platformName(net.code)}, повтор позже (${e.retryAfterSec ?? '?'} с)`);
    return;
  }

  const message = errorText(e);
  const ambiguous = e instanceof SocialPublishError && e.ambiguous;
  const exhausted = post.attempts >= SCHEDULER_LIMITS.maxAttempts;
  const toFailed = ambiguous || exhausted;

  await prisma.socialPost.update({
    where: { id: post.id },
    data: {
      status: toFailed ? 'failed' : 'scheduled',
      publishedAt: null,
      error: message,
      updatedAt: now,
    },
  });
  report.failed.push(post.id);

  if (ambiguous) {
    await alertOwner([
      `Публикация в «${net.title}» (пост ${post.id}): ответ ${platformName(net.code)} не получен.`,
      'Пост мог уйти в канал. Проверьте канал вручную; автоматического повтора не будет.',
      message,
    ]);
  }

  const network = await prisma.socialNetwork.update({
    where: { id: net.id },
    data: { failStreak: { increment: 1 }, lastError: message },
  });
  if (network.failStreak >= SCHEDULER_LIMITS.stopAfterFailures) {
    // Счётчик сбрасываем: при ручном включении сети снова нужны две ошибки подряд.
    await prisma.socialNetwork.update({ where: { id: net.id }, data: { enabled: false, failStreak: 0 } });
    report.stopped.push(net.code);
    await alertOwner([
      `Автопубликация в канал остановлена: ${message}`,
      `Ошибок подряд: ${SCHEDULER_LIMITS.stopAfterFailures}. Включить снова: SocialNetwork «${net.code}» enabled=true, после проверки причины.`,
    ]);
  }
}

async function tickNetwork(
  net: { id: number; code: string; title: string; chatId: string | null },
  now: Date,
  mediaDir: string,
  report: TickReport,
): Promise<void> {
  if (!net.chatId) {
    report.held.push(`${net.code}: не задан chat id канала`);
    return;
  }
  const due = await prisma.socialPost.findFirst({
    where: {
      networkCode: net.code,
      status: 'scheduled',
      scheduledAt: { lte: now },
      item: { status: 'ready' },
    },
    orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (!due) return;

  const claim = await claimPost(net.code, due.id, now);
  if (claim.kind === 'day_taken') {
    report.held.push(`${net.code}: сегодня уже публиковали, пост ждёт следующего дня (МСК)`);
    return;
  }
  if (claim.kind === 'lost') return;

  await publishClaimed(net, net.chatId, claim.post, now, mediaDir, report);
}

/** Один проход расписания. Все ошибки внутри сетей перехватываются: сбой одной сети не останавливает другие. */
export async function tick(now: Date = new Date()): Promise<TickReport> {
  const report = emptyReport();
  const pause = await prisma.socialRule.findUnique({ where: { key: PAUSE_ALL_RULE } });
  if (pause?.value === '1') {
    report.held.push('пауза всех сетей (paused_all)');
    return report;
  }

  await recoverStalePosts(now, report);
  const mediaDir = await getMediaDir();
  const networks = await prisma.socialNetwork.findMany({
    where: { enabled: true, mode: 'auto' },
    select: { id: true, code: true, title: true, chatId: true },
  });

  for (const net of networks) {
    if (!CONNECTED_NETWORKS.has(net.code)) {
      report.held.push(`${net.code}: нет коннектора`);
      continue;
    }
    try {
      await tickNetwork(net, now, mediaDir, report);
    } catch (e) {
      report.held.push(`${net.code}: сбой прохода (${errorText(e)})`);
      console.error(`[social-publish] ${net.code}:`, e);
    }
  }
  return report;
}
