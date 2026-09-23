/**
 * Темы для еженедельного SEO-цикла: сохраняет понедельничный дайджест
 * Вебмастера, отдаёт read-only роут /api/seo/topics облачному агенту.
 */
import { prisma } from '@/lib/db';

export const SEO_TOPICS_KEY = 'seo_topic_ideas';

export type SeoQuery = { query: string; shows: number; clicks: number };
export type SeoTopics = {
  generatedAt: string;
  /** Показывают (≥2 показа), но не кликают — кандидаты в статьи/термины. */
  topicIdeas: SeoQuery[];
  /** Запросы, которых не было в прошлом дайджесте. */
  newQueries: string[];
  /** Топ-30 запросов по показам — контекст. */
  topQueries: SeoQuery[];
};

export async function saveSeoTopics(t: Omit<SeoTopics, 'generatedAt'>): Promise<void> {
  const value = JSON.stringify({ generatedAt: new Date().toISOString(), ...t } satisfies SeoTopics);
  await prisma.systemSetting.upsert({
    where: { key: SEO_TOPICS_KEY },
    create: { key: SEO_TOPICS_KEY, value, category: 'seo' },
    update: { value },
  });
}

export async function loadSeoTopics(): Promise<SeoTopics | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key: SEO_TOPICS_KEY } });
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as SeoTopics;
  } catch {
    return null;
  }
}
