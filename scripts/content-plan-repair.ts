/**
 * Ремонт контент-плана после бага «план на прошедшую неделю» (2026-08-11).
 *
 * 8 недель воскресный планировщик создавал посты с датами в прошлом (якорь
 * startOfWeek(new Date()) в воскресенье — понедельник уходящей недели), и
 * daily-prepare их никогда не видел. Скрипт:
 *   1) возвращает темы просроченных planned-постов в пул (scheduled → pending);
 *   2) удаляет сами просроченные planned-посты;
 *   3) строит план на текущую неделю;
 *   4) зачищает в новом плане дни, которые уже прошли (их prepare не возьмёт).
 *
 * Запуск на сервере: npx tsx scripts/content-plan-repair.ts [--dry]
 */
import { prisma } from '../lib/db';
import { buildWeekPlan } from '../lib/content/planner/weekly-planner';

const dry = process.argv.includes('--dry');

async function purgeStalePlanned(label: string): Promise<number> {
  // Посты с датой раньше завтрашнего дня prepare (11:00 своего дня) уже не возьмёт.
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const stale = await prisma.contentItem.findMany({
    where: { status: 'planned', publishDate: { lt: tomorrow } },
    select: { id: true, themeId: true, publishDate: true, topic: true },
  });
  if (stale.length === 0) return 0;

  console.log(`${label}: просроченных planned-постов — ${stale.length}`);
  for (const s of stale.slice(0, 5)) {
    console.log(`  ${s.publishDate.toISOString().slice(0, 10)} — ${s.topic.slice(0, 60)}`);
  }
  if (stale.length > 5) console.log(`  … и ещё ${stale.length - 5}`);

  if (dry) return stale.length;

  const themeIds = stale.map((s) => s.themeId).filter((t): t is string => !!t);
  if (themeIds.length) {
    const r = await prisma.themePool.updateMany({
      where: { id: { in: themeIds }, status: 'scheduled' },
      data: { status: 'pending' },
    });
    console.log(`  тем возвращено в пул: ${r.count}`);
  }
  await prisma.contentItem.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  return stale.length;
}

async function main() {
  await purgeStalePlanned('Шаг 1 (наследие)');

  if (dry) {
    console.log('[dry] построение плана пропущено');
  } else {
    const plan = await buildWeekPlan(new Date());
    console.log(`Шаг 2: план на текущую неделю — создано/обновлено позиций: ${plan.items.length}`);
    for (const line of plan.items) console.log(`  ${line}`);
    await purgeStalePlanned('Шаг 3 (прошедшие дни новой недели)');
  }

  const left = await prisma.contentItem.groupBy({ by: ['status'], _count: true });
  console.log('Итог по статусам:', left.map((l) => `${l.status}=${l._count}`).join(', '));
  const pool = await prisma.themePool.groupBy({ by: ['status'], _count: true });
  console.log('Пул тем:', pool.map((l) => `${l.status}=${l._count}`).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
