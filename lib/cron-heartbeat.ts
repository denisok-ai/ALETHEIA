/**
 * Отметки о последнем успешном выполнении фоновых задач.
 *
 * Зачем: сбой внутри задачи виден (алерты, лог, ненулевой ответ), а вот
 * «задача вообще перестала запускаться» не детектировалось ничем. Если файл
 * /etc/cron.d/aletheia-http-cron исчезнет после деплоя или демон задач уйдёт в
 * рестарт-луп, рассылки не уходят, почта не синхронизируется, сверка оплат не
 * работает — при этом сайт отвечает 200, сторож доступности доволен, алертов
 * ноль. Узнают об этом через дни и от клиента.
 *
 * Отметка пишется в SystemSetting, а проверяет её сторож снаружи приложения
 * (scripts/cron-heartbeat-watchdog.sh) — так же, как сторож доступности:
 * механизм, живущий внутри приложения, не может сообщить о собственной смерти.
 */
import { prisma } from '@/lib/db';

const PREFIX = 'cron_last_ok_';

/** Ожидаемый интервал задачи (минуты) — по нему сторож понимает, что она встала. */
export const CRON_EXPECTED_INTERVAL_MIN: Record<string, number> = {
  'mailings-send': 5,
  'inmail-sync': 15,
  'installment-payments': 60,
  'reconcile-enrollments': 10,
  'paykeeper-health': 5,
  // Раз в сутки; сторож поднимет тревогу, если пропущено двое суток подряд.
  'blog-telegram-sync': 1440,
  // Напоминание «записались, но курс не открыли» — раз в сутки (как blog-sync,
  // в watchdog не заводим: суточные джобы там не отслеживаются во избежание
  // ложных тревог на совпадении запуска с деплоем).
  'nudge-inactive-enrollees': 1440,
  // Целостность контента курсов (demo-пакет в платном курсе и т.п.) — раз в
  // сутки; как и другие суточные, в bash-watchdog не заводится.
  'content-integrity': 1440,
  // Авто-анонс статьи блога в Telegram-канал — раз в сутки.
  'blog-announce': 1440,
  // Догоны лидов Telegram-бота — раз в час (окна касаний считаются внутри задачи).
  'telegram-lead-followup': 60,
  // SEO-дайджест Яндекс.Вебмастера — раз в неделю (пн 09:00).
  'yandex-webmaster-digest': 10080,
};

/** Отметить успешное выполнение. Сбой отметки не должен ронять саму задачу. */
export async function markCronOk(job: string): Promise<void> {
  try {
    const key = `${PREFIX}${job}`;
    const value = new Date().toISOString();
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value, category: 'system' },
    });
  } catch (e) {
    console.error(`[cron-heartbeat] не удалось отметить ${job}:`, e);
  }
}

export type CronHeartbeat = {
  job: string;
  lastOkAt: string | null;
  expectedIntervalMin: number;
  /** Отметка старше двух ожидаемых интервалов — задача считается вставшей. */
  stale: boolean;
};

/** Состояние всех известных задач — для сторожа и админки. */
export async function getCronHeartbeats(): Promise<CronHeartbeat[]> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { startsWith: PREFIX } },
    select: { key: true, value: true },
  });
  const byJob = new Map(rows.map((r) => [r.key.slice(PREFIX.length), r.value]));

  return Object.entries(CRON_EXPECTED_INTERVAL_MIN).map(([job, expectedIntervalMin]) => {
    const lastOkAt = byJob.get(job) ?? null;
    // Порог — два интервала: один пропуск бывает от совпадения деплоя с окном
    // запуска, и тревожить на нём означало бы приучить к ложным срабатываниям.
    const stale = lastOkAt
      ? Date.now() - new Date(lastOkAt).getTime() > expectedIntervalMin * 2 * 60 * 1000
      : true;
    return { job, lastOkAt, expectedIntervalMin, stale };
  });
}
