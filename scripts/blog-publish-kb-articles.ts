/**
 * Публикация SEO-статей из базы знаний (lib/content/kb-seo-articles.ts).
 *
 * Запуск:
 *   npx tsx scripts/blog-publish-kb-articles.ts --dry   # показать, без записи
 *   npx tsx scripts/blog-publish-kb-articles.ts         # опубликовать
 *
 * Скрипт только СОЗДАЁТ отсутствующие статьи. Существующий slug никогда не
 * перезаписывается: статью после публикации могли править в админке, и запуск
 * скрипта (в том числе повторный, после деплоя) не должен затирать правки.
 *
 * publishedAt разносится по минуте: блог и sitemap сортируются по этой дате,
 * и без разноса порядок десяти статей, созданных одной секундой, был бы
 * случайным при каждом чтении.
 */
import { prisma } from '../lib/db';
import { pingIndexNow } from '../lib/indexnow';
import { KB_SEO_ARTICLES } from '../lib/content/kb-seo-articles';

async function main() {
  const dryRun = process.argv.includes('--dry');
  const now = Date.now();
  const created: string[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < KB_SEO_ARTICLES.length; i++) {
    const a = KB_SEO_ARTICLES[i];
    const existing = await prisma.blogPost.findUnique({ where: { slug: a.slug } });
    if (existing) {
      skipped.push(a.slug);
      continue;
    }
    if (!dryRun) {
      await prisma.blogPost.create({
        data: {
          slug: a.slug,
          title: a.title,
          h1: a.h1,
          description: a.description,
          body: a.markdown,
          bodyFormat: 'markdown',
          status: 'published',
          // Первая статья массива — самая свежая в ленте.
          publishedAt: new Date(now - i * 60_000),
          source: 'kb',
        },
      });
    }
    created.push(a.slug);
  }

  console.log(`Создано: ${created.length}${dryRun ? ' (проверка, без записи)' : ''}`);
  for (const s of created) console.log(`  + /blog/${s}`);
  if (skipped.length) {
    console.log(`Пропущено (уже есть): ${skipped.length}`);
    for (const s of skipped) console.log(`  = /blog/${s}`);
  }

  // Сразу сообщаем поисковикам — иначе статьи ждут планового обхода неделями.
  if (!dryRun && created.length > 0) {
    const row = await prisma.systemSetting.findUnique({ where: { key: 'site_url' } });
    const base = (row?.value || '').trim().replace(/\/$/, '');
    if (base.startsWith('https://') && !base.includes('localhost')) {
      const urls = [...created.map((s) => `${base}/blog/${s}`), `${base}/blog`, `${base}/sitemap.xml`];
      const r = await pingIndexNow(base, urls);
      console.log(`IndexNow: ${r.ok ? `принято (HTTP ${r.status})` : 'НЕ доставлено'}`);
      // IndexNow — лишь сигнал; очередь переобхода Яндекса — гарантированная
      // заявка в пределах квоты (150/день). Дёргаем обе.
      let recrawled = 0;
      for (const slug of created) {
        if (await recrawlUrl(`${base}/blog/${slug}`)) recrawled += 1;
      }
      console.log(`Яндекс.Переобход: принято ${recrawled}/${created.length}`);
    } else {
      console.log('IndexNow: пропущен — site_url не боевой');
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
