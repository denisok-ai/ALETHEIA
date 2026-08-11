/**
 * Планировщик фоновых задач SMM (node-cron, Europe/Moscow).
 */
import cron from 'node-cron';
import { runSiteRadarCycle } from '@/lib/content/site-radar/orchestrator';
import { buildWeekPlan } from '@/lib/content/planner/weekly-planner';
import { prepareDueItemsForDate } from '@/lib/content/pipeline/prepare-item';
import { publishDueToday } from '@/lib/content/publisher/channel-publisher';
import { getContentConfig } from '@/lib/content/config';

let started = false;

/**
 * Задачи, выполняющиеся прямо сейчас.
 *
 * node-cron не ждёт завершения предыдущего запуска: если цикл Site Radar
 * затянулся дольше 6 часов (обход всего sitemap с таймаутом 15 с на страницу),
 * поверх него стартовал второй. Оба видели одну и ту же изменённую страницу до
 * записи версии — и создавали дублирующиеся сигналы и темы контент-плана,
 * а админам уходили задвоенные оповещения.
 */
const running = new Set<string>();

async function safeRun(label: string, fn: () => Promise<unknown>) {
  if (running.has(label)) {
    console.warn(`[jobs] skip ${label} — предыдущий запуск ещё идёт`);
    return;
  }
  running.add(label);
  try {
    console.log(`[jobs] start ${label}`);
    await fn();
    console.log(`[jobs] done ${label}`);
  } catch (e) {
    console.error(`[jobs] failed ${label}`, e);
  } finally {
    running.delete(label);
  }
}

export function startContentJobScheduler() {
  if (started) return;
  started = true;

  // Site Radar каждые 6 часов
  cron.schedule('0 */6 * * *', () => safeRun('site-radar', () => runSiteRadarCycle(false)), {
    timezone: 'Europe/Moscow',
  });

  // Недельный план: воскресенье 19:00 МСК — на СЛЕДУЮЩУЮ неделю.
  // Якорь «завтра» обязателен: в воскресенье startOfWeek(new Date()) — это
  // понедельник УХОДЯЩЕЙ недели, и до 10.08.2026 планировщик 8 недель подряд
  // создавал посты с датами в прошлом — ежедневная подготовка их не видела,
  // канал не получил ни одного поста, ошибок при этом не было нигде.
  cron.schedule(
    '0 19 * * 0',
    () =>
      safeRun('weekly-plan', () => buildWeekPlan(new Date(Date.now() + 24 * 60 * 60 * 1000))),
    {
      timezone: 'Europe/Moscow',
    }
  );

  // Ежедневная подготовка + публикация 11:00 МСК
  cron.schedule('0 11 * * *', async () => {
    await safeRun('daily-prepare', async () => {
      await prepareDueItemsForDate(new Date());
    });
    await safeRun('daily-publish', async () => {
      const config = await getContentConfig();
      if (config.paused) {
        console.log('[jobs] publish skipped — paused');
        return;
      }
      await publishDueToday(false);
    });
  }, { timezone: 'Europe/Moscow' });

  console.log('[jobs] scheduler started (Europe/Moscow)');
}

export async function runJobNow(job: 'radar' | 'radar-priority' | 'weekly-plan' | 'daily-publish' | 'daily-prepare') {
  switch (job) {
    case 'radar':
      return runSiteRadarCycle(false);
    case 'radar-priority':
      return runSiteRadarCycle(true);
    case 'weekly-plan':
      return buildWeekPlan();
    case 'daily-prepare':
      return prepareDueItemsForDate(new Date());
    case 'daily-publish':
      return publishDueToday(false);
  }
}
