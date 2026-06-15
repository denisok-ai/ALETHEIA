/**
 * Пайплайн подготовки поста: текст (+ опционально картинка).
 */
import { prisma } from '@/lib/db';
import { generateImageForItem } from '@/lib/image-gen';
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

  const results = [];
  for (const item of items) {
    results.push({ id: item.id, ...(await prepareContentItem(item.id)) });
  }
  return results;
}
