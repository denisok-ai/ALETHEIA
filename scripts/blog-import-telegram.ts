/**
 * Импорт постов Telegram-канала в черновики блога.
 *
 * Запуск:
 *   npx tsx scripts/blog-import-telegram.ts avaterrapro --dry
 *   npx tsx scripts/blog-import-telegram.ts avaterrapro
 *
 * Посты создаются черновиками — на сайте они не появляются, пока их не
 * опубликуют в админке.
 */
import { importChannelPosts } from '../lib/content/telegram-channel-import';
import { prisma } from '../lib/db';

async function main() {
  const channel = process.argv[2] ?? 'avaterrapro';
  const dryRun = process.argv.includes('--dry');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;

  console.log(`Канал: @${channel}${dryRun ? ' (проверка, без записи)' : ''}`);

  const r = await importChannelPosts(channel, { dryRun, limit });

  console.log(`\nнайдено постов:      ${r.found}`);
  console.log(`${dryRun ? 'импортировал бы:     ' : 'создано черновиков:  '}${r.created}`);
  console.log(`пропущено (уже есть): ${r.skipped}`);
  if (!dryRun) console.log(`сохранено картинок:  ${r.photosSaved}`);
  if (r.createdSlugs.length) {
    console.log('\nадреса статей:');
    for (const s of r.createdSlugs) console.log(`  ${s}`);
  }
  if (r.errors.length) {
    console.log('\nошибки:');
    for (const e of r.errors) console.log(`  ${e}`);
  }

  await prisma.$disconnect();
  process.exit(r.errors.length && r.created === 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
