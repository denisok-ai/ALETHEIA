/**
 * Публикация SEO-статей из базы знаний (lib/content/kb-seo-articles.ts).
 *
 * Запуск:
 *   npx tsx scripts/blog-publish-kb-articles.ts --dry   # показать, без записи
 *   npx tsx scripts/blog-publish-kb-articles.ts         # опубликовать
 *   npx tsx scripts/blog-publish-kb-articles.ts --refresh=slug1,slug2
 *
 * Скрипт только СОЗДАЁТ отсутствующие статьи. Существующий slug никогда не
 * перезаписывается: статью после публикации могли править в админке, и запуск
 * скрипта (в том числе повторный, после деплоя) не должен затирать правки.
 *
 * Исключение — явный `--refresh=` для переработанных статей: только source=kb,
 * только slug с датой в KB_REVISED (она уходит в dateModified/lastmod), дата
 * публикации сохраняется. Перед запуском сверить, что тело на проде не правили
 * в админке (совпадает с прошлой версией из git), и сделать бэкап БД.
 *
 * publishedAt разносится по минуте: блог и sitemap сортируются по этой дате,
 * и без разноса порядок десяти статей, созданных одной секундой, был бы
 * случайным при каждом чтении.
 */
import { prisma } from '../lib/db';
import { pingIndexNow } from '../lib/indexnow';
import { recrawlUrl } from '../lib/seo/yandex-webmaster';
import { KB_SEO_ARTICLES } from '../lib/content/kb-seo-articles';
import { KB_REVISED } from '../lib/content/kb-revisions';

async function main() {
  const dryRun = process.argv.includes('--dry');
  const refreshArg = process.argv.find((a) => a.startsWith('--refresh='));
  const refresh = new Set(refreshArg ? refreshArg.slice('--refresh='.length).split(',').filter(Boolean) : []);
  const now = Date.now();
  const created: string[] = [];
  const refreshed: string[] = [];
  const skipped: string[] = [];

  for (const slug of refresh) {
    if (!KB_SEO_ARTICLES.some((a) => a.slug === slug)) throw new Error(`--refresh: нет статьи ${slug} в базе знаний`);
    if (!KB_REVISED[slug]) throw new Error(`--refresh: для ${slug} нет даты в KB_REVISED (lib/content/kb-revisions.ts)`);
  }

  for (let i = 0; i < KB_SEO_ARTICLES.length; i++) {
    const a = KB_SEO_ARTICLES[i];
    const existing = await prisma.blogPost.findUnique({ where: { slug: a.slug } });
    if (existing && refresh.has(a.slug)) {
      if (existing.source !== 'kb') throw new Error(`--refresh: ${a.slug} не из базы знаний (source=${existing.source})`);
      if (!dryRun) {
        await prisma.blogPost.update({
          where: { id: existing.id },
          data: { title: a.title, h1: a.h1, description: a.description, body: a.markdown },
        });
      }
      console.log(`  ~ /blog/${a.slug}: ${existing.body.length} → ${a.markdown.length} симв.`);
      refreshed.push(a.slug);
      continue;
    }
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
  if (refresh.size) console.log(`Обновлено (--refresh): ${refreshed.length}`);
  for (const s of created) console.log(`  + /blog/${s}`);
  if (skipped.length) {
    console.log(`Пропущено (уже есть): ${skipped.length}`);
    for (const s of skipped) console.log(`  = /blog/${s}`);
  }

  // Сразу сообщаем поисковикам — иначе статьи ждут планового обхода неделями.
  const touched = [...created, ...refreshed];
  if (!dryRun && touched.length > 0) {
    const row = await prisma.systemSetting.findUnique({ where: { key: 'site_url' } });
    const base = (row?.value || '').trim().replace(/\/$/, '');
    if (base.startsWith('https://') && !base.includes('localhost')) {
      const urls = [...touched.map((s) => `${base}/blog/${s}`), `${base}/blog`, `${base}/sitemap.xml`];
      const r = await pingIndexNow(base, urls);
      console.log(`IndexNow: ${r.ok ? `принято (HTTP ${r.status})` : 'НЕ доставлено'}`);
      // IndexNow — лишь сигнал; очередь переобхода Яндекса — гарантированная
      // заявка в пределах квоты (150/день). Дёргаем обе.
      let recrawled = 0;
      for (const slug of touched) {
        if (await recrawlUrl(`${base}/blog/${slug}`)) recrawled += 1;
      }
      console.log(`Яндекс.Переобход: принято ${recrawled}/${touched.length}`);
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
