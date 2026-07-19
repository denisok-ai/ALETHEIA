/**
 * Перенос статей блога из файла кода в базу.
 * Запуск: npx tsx scripts/blog-seed-from-code.ts [--dry]
 *
 * Идемпотентен: статьи сопоставляются по slug, уже перенесённые пропускаются.
 * Повторный запуск ничего не портит и не создаёт дублей.
 *
 * Переносится один в один — заголовки, описание и тело сохраняются как есть,
 * включая формат тела (абзацы или markdown), чтобы вид опубликованных страниц
 * не изменился.
 */
import { prisma } from '../lib/db';
import {
  BLOG_DEFAULT_OG_IMAGE,
  blogArticleBodies,
  blogPostsMeta,
} from '../lib/content/course-lynda-teaser';

const dryRun = process.argv.includes('--dry');

async function main() {
  let created = 0;
  let skipped = 0;

  for (const meta of blogPostsMeta) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: meta.slug } });
    if (existing) {
      console.log(`  пропуск (уже в базе): ${meta.slug}`);
      skipped++;
      continue;
    }

    const raw = blogArticleBodies[meta.slug as keyof typeof blogArticleBodies];
    if (!raw) {
      console.log(`  ПРОПУСК (нет тела статьи): ${meta.slug}`);
      skipped++;
      continue;
    }

    const isMarkdown = 'markdown' in raw;
    const body = isMarkdown ? raw.markdown : JSON.stringify(raw.paragraphs);
    const bodyFormat = isMarkdown ? 'markdown' : 'paragraphs';

    if (dryRun) {
      console.log(`  [проверка] перенёс бы: ${meta.slug} (${bodyFormat}, ${body.length} символов)`);
      created++;
      continue;
    }

    await prisma.blogPost.create({
      data: {
        slug: meta.slug,
        title: meta.title,
        h1: raw.h1,
        description: meta.description,
        body,
        bodyFormat,
        ogImage: meta.ogImage ?? BLOG_DEFAULT_OG_IMAGE,
        status: 'published',
        publishedAt: new Date(meta.publishedAt),
        source: 'manual',
      },
    });
    console.log(`  перенесена: ${meta.slug} (${bodyFormat})`);
    created++;
  }

  const total = await prisma.blogPost.count();
  console.log(
    `\n${dryRun ? '[проверка] ' : ''}перенесено: ${created}, пропущено: ${skipped}, всего в базе: ${total}`
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
