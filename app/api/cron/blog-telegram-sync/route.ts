/**
 * Cron: перенос новых постов Telegram-канала в блог сайта.
 * GET с заголовком Authorization: Bearer CRON_SECRET — см. docs/Env-Config.md.
 *
 * Запускается раз в сутки. Новые посты канала забираются и сразу публикуются.
 *
 * Канал задаётся настройкой `blog_telegram_channel` (Портал → Настройки).
 * Пока она пуста, задача ничего не делает — так автопубликацию можно выключить,
 * не трогая расписание.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron-auth';
import { prisma } from '@/lib/db';
import { importChannelPosts } from '@/lib/content/telegram-channel-import';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';
import { markCronOk } from '@/lib/cron-heartbeat';
import { pingIndexNowForPathsAsync } from '@/lib/indexnow';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const CHANNEL_KEY = 'blog_telegram_channel';

/**
 * Короткие посты не публикуются: в канале это анонсы и однострочники вроде
 * «сегодня эфир в 19:00». Отдельной страницей сайта они выглядят пусто, а для
 * поиска это тонкий контент, который вредит, а не помогает.
 */
const MIN_PUBLISH_LENGTH = 400;

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;

  const row = await prisma.systemSetting.findUnique({ where: { key: CHANNEL_KEY } });
  const channel = row?.value?.trim();
  if (!channel) {
    await markCronOk('blog-telegram-sync');
    return NextResponse.json({ skipped: 'канал не задан', imported: 0, published: 0 });
  }

  try {
    // Импорт создаёт черновики и не трогает уже перенесённые посты.
    const imported = await importChannelPosts(channel);

    // Публикуем только то, что пришло этим прогоном: черновики, созданные
    // человеком вручную, автоматика трогать не должна.
    const fresh = await prisma.blogPost.findMany({
      where: {
        source: 'telegram',
        status: 'draft',
        slug: { in: imported.createdSlugs },
      },
      select: { id: true, slug: true, body: true },
    });

    const tooShort: string[] = [];
    const toPublish: string[] = [];
    const publishedSlugs: string[] = [];
    for (const p of fresh) {
      if (p.body.trim().length < MIN_PUBLISH_LENGTH) tooShort.push(p.slug);
      else {
        toPublish.push(p.id);
        publishedSlugs.push(p.slug);
      }
    }

    if (toPublish.length > 0) {
      await prisma.blogPost.updateMany({
        where: { id: { in: toPublish } },
        data: { status: 'published', publishedAt: new Date() },
      });

      /**
       * Сразу сообщаем поисковикам о новых статьях.
       *
       * Без этого свежая статья ждала планового обхода — для нового раздела
       * это недели, и ежедневная публикация теряла смысл: к моменту, когда
       * робот доходил до статьи, она была уже не новой. IndexNow — протокол
       * Яндекса и Bing, обычно они забирают URL в течение часов.
       *
       * Кроме самих статей пингуем список блога и карту сайта: на них
       * изменились ссылки и lastmod, иначе робот увидит новый URL, но не
       * поймёт, что раздел обновился.
       */
      pingIndexNowForPathsAsync([
        ...publishedSlugs.map((s) => `/blog/${s}`),
        '/blog',
        '/sitemap.xml',
      ]);
    }

    if (imported.created > 0 || imported.errors.length > 0) {
      notifyAdminsTelegramAsync('contact_lead', [
        `Блог: перенесено из канала @${channel} — ${imported.created}`,
        `Опубликовано: ${toPublish.length}`,
        ...(tooShort.length
          ? [`Оставлено черновиками (короткие): ${tooShort.length} — ${tooShort.slice(0, 3).join(', ')}`]
          : []),
        ...(imported.photosSaved ? [`Картинок сохранено: ${imported.photosSaved}`] : []),
        ...(imported.errors.length ? [`Ошибки: ${imported.errors.slice(0, 3).join('; ')}`] : []),
      ]);
    }

    await markCronOk('blog-telegram-sync');
    return NextResponse.json({
      channel,
      found: imported.found,
      imported: imported.created,
      published: toPublish.length,
      keptAsDraft: tooShort.length,
      photosSaved: imported.photosSaved,
      errors: imported.errors,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[cron blog-telegram-sync]', e);
    notifyAdminsTelegramAsync('contact_lead', [
      'Перенос постов из канала в блог не отработал.',
      `Ошибка: ${msg}`,
    ]);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
