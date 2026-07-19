/**
 * Пайплайн подготовки поста: текст (+ опционально картинка).
 */
import { prisma } from '@/lib/db';
import { generateImageForItem } from '@/lib/image-gen';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';
import { getContentConfig } from '../config';
import { generateTextForItem } from '../generator/text-generator';

export async function prepareContentItem(itemId: string, feedback?: string) {
  const textResult = await generateTextForItem(itemId, feedback);
  if (!textResult.ok) return textResult;

  const config = await getContentConfig();
  if (config.imageGenerationEnabled) {
    await generateImageForItem(itemId);
  }

  const item = await prisma.contentItem.findUnique({ where: { id: itemId } });
  return { ok: true, status: item?.status ?? 'ready', text: textResult.text };
}

export async function prepareDueItemsForDate(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const items = await prisma.contentItem.findMany({
    where: {
      publishDate: { gte: start, lte: end },
      status: { in: ['planned', 'quality_failed'] },
    },
  });

  // Каждый пост готовится независимо. Раньше исключение на одном (например 500
  // от LLM) прерывало весь прогон: посты, до которых очередь не дошла, в этот
  // день не готовились вообще, а задача запускается раз в сутки в 11:00 — к
  // следующему запуску их publishDate уже истекала. Канал оставался пустым, и
  // ни одной ошибки в интерфейсе при этом не появлялось.
  const results: { id: string; ok: boolean; status: string; text?: string }[] = [];
  const failures: string[] = [];
  for (const item of items) {
    try {
      const r = await prepareContentItem(item.id);
      results.push({ id: item.id, ok: r.ok, status: r.status, text: r.text });
      if (!r.ok) failures.push(`${item.id.slice(0, 8)} — ${r.status}`);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error(`[content] подготовка поста ${item.id} упала:`, e);
      results.push({ id: item.id, ok: false, status: 'error' });
      failures.push(`${item.id.slice(0, 8)} — ${detail.slice(0, 80)}`);
      await prisma.contentItem
        .update({ where: { id: item.id }, data: { status: 'quality_failed' } })
        .catch(() => undefined);
    }
  }

  if (failures.length > 0) {
    notifyAdminsTelegramAsync('contact_lead', [
      `Подготовка контента: не удалось подготовить ${failures.length} из ${items.length}.`,
      ...failures.slice(0, 5).map((f) => `· ${f}`),
      'Очередь: /quality в боте.',
    ]);
  }

  return results;
}
