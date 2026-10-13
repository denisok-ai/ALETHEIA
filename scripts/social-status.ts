/**
 * Состояние очереди соцсетей: сети, паузы и посты (время — МСК).
 *
 * Запуск: npx tsx scripts/social-status.ts [--limit=50]
 */
import { prisma } from '../lib/db';
import { PAUSE_ALL_RULE } from '../lib/social/scheduler';
import { formatMsk } from '../lib/social/moscow-day';

async function main(): Promise<void> {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Math.max(1, Number(limitArg.slice('--limit='.length)) || 50) : 50;

  const pause = await prisma.socialRule.findUnique({ where: { key: PAUSE_ALL_RULE } });
  console.log(`Пауза всех сетей (paused_all): ${pause?.value === '1' ? 'ДА' : 'нет'}`);

  const networks = await prisma.socialNetwork.findMany({ orderBy: { code: 'asc' } });
  console.log('\nСети:');
  if (networks.length === 0) console.log('  (нет записей)');
  for (const n of networks) {
    console.log(
      `  ${n.code.padEnd(10)} enabled=${n.enabled} mode=${n.mode} chat=${n.chatId ?? '—'} ` +
        `ошибок подряд=${n.failStreak}${n.lastError ? ` · последняя: ${n.lastError}` : ''}`,
    );
  }

  const posts = await prisma.socialPost.findMany({
    include: { item: { select: { title: true } } },
    orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    take: limit,
  });
  console.log(`\nПосты (до ${limit}):`);
  if (posts.length === 0) console.log('  (очередь пуста)');
  for (const p of posts) {
    const when = p.scheduledAt ? formatMsk(p.scheduledAt) : 'без времени';
    const tail = p.externalUrl ?? (p.error ? `ошибка: ${p.error}` : '');
    console.log(
      `  #${p.id} ${when} | ${p.networkCode} | ${p.status} | попыток ${p.attempts} | ${p.item.title}` +
        (tail ? ` | ${tail}` : ''),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
