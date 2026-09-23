/**
 * Темы для еженедельного SEO-цикла облачного агента (read-only).
 *
 * Облачный агент не имеет доступа к серверу и токену Вебмастера. Понедельничный
 * cron yandex-webmaster-digest сохраняет в SystemSetting `seo_topic_ideas`
 * запросы «показывают, но не кликают», новые запросы и топ; этот роут отдаёт
 * только их — по отдельному узкому токену SEO_TOPICS_TOKEN (Authorization:
 * Bearer …), не связанному с CRON_SECRET и доступом к Вебмастеру. Отзыв —
 * сменить/удалить переменную в .env.
 */
import { NextRequest, NextResponse } from 'next/server';
import { loadSeoTopics } from '@/lib/seo/topics';
import { timingSafeStringEqual } from '@/lib/timing-safe';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = process.env.SEO_TOPICS_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!auth || !timingSafeStringEqual(auth, token)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const topics = await loadSeoTopics();
  return NextResponse.json(topics ?? { generatedAt: null, topicIdeas: [], newQueries: [], topQueries: [] });
}
