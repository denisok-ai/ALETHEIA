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

async function safeRun(label: string, fn: () => Promise<unknown>) {
  try {
    console.log(`[jobs] start ${label}`);
    await fn();
    console.log(`[jobs] done ${label}`);
  } catch (e) {
    console.error(`[jobs] failed ${label}`, e);
  }
}

export function startContentJobScheduler() {
  if (started) return;
  started = true;

  // Site Radar каждые 6 часов
  cron.schedule('0 */6 * * *', () => safeRun('site-radar', () => runSiteRadarCycle(false)), {
    timezone: 'Europe/Moscow',
  });

  // Недельный план: воскресенье 19:00 МСК
  cron.schedule('0 19 * * 0', () => safeRun('weekly-plan', () => buildWeekPlan()), {
    timezone: 'Europe/Moscow',
  });

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
