/**
 * Аналитика постов канала (PostStat).
 */
import { prisma } from '@/lib/db';
import { getContentConfig } from '@/lib/content/config';

/** Telegram Bot API не отдаёт views для всех типов каналов — сохраняем снимок при наличии. */
export async function refreshPostStatsForItem(contentItemId: string) {
  const item = await prisma.contentItem.findUnique({ where: { id: contentItemId } });
  if (!item?.telegramMsgId) return null;

  const config = await getContentConfig();
  // Заглушка: реальный poll через getMessageStatistics когда доступен.
  const stat = await prisma.postStat.create({
    data: {
      contentItemId: item.id,
      telegramMsgId: item.telegramMsgId,
      channelId: config.contentChannelId || null,
      views: 0,
      forwards: 0,
      reactions: 0,
      rawPayload: JSON.stringify({ note: 'manual_refresh_stub' }),
    },
  });
  return stat;
}

export async function formatPostStatsSummary(): Promise<string> {
  const published = await prisma.contentItem.count({ where: { status: 'published' } });
  const stats = await prisma.postStat.findMany({
    orderBy: { fetchedAt: 'desc' },
    take: 5,
    include: { contentItem: { select: { topic: true, postType: true, publishDate: true } } },
  });
  const lines = stats.map(
    (s, i) =>
      `${i + 1}. msg ${s.telegramMsgId ?? '—'} · views ${s.views} · ${s.contentItem?.topic?.slice(0, 50) ?? '—'}`
  );
  return [`<b>Аналитика постов</b>`, `Опубликовано: <b>${published}</b>`, '', lines.length ? lines.join('\n') : 'Снимков метрик пока нет.'].join('\n');
}

export async function formatSinglePostStat(partialId: string): Promise<string> {
  const item = await prisma.contentItem.findFirst({
    where: { id: { startsWith: partialId } },
    include: { postStats: { orderBy: { fetchedAt: 'desc' }, take: 3 } },
  });
  if (!item) return 'Пост не найден.';
  const stats = item.postStats;
  if (!stats.length) {
    await refreshPostStatsForItem(item.id);
    return `<b>${item.topic.slice(0, 80)}</b>\nСтатус: ${item.status}\nМетрик пока нет (создан пустой снимок).`;
  }
  const last = stats[0];
  return [
    `<b>${item.topic.slice(0, 80)}</b>`,
    `Тип: ${item.postType} · ${item.publishDate.toLocaleDateString('ru-RU')}`,
    `views: ${last.views} · forwards: ${last.forwards} · reactions: ${last.reactions}`,
    `обновлено: ${last.fetchedAt.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`,
  ].join('\n');
}
