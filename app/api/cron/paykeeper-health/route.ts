/**
 * Cron: проактивный мониторинг доступности PayKeeper (инцидент 16.07.2026 —
 * PayKeeper не отвечал ~7 минут, клиенты не могли оплатить, узнали от клиентов).
 *
 * Пробник: принудительное обновление токена (GET /info/settings/token/ с basic auth) —
 * проверяет DNS, TLS, доступность и авторизацию одним лёгким запросом.
 * Алерты в Telegram админам: при падении, при восстановлении (с длительностью),
 * повторное напоминание не чаще раза в час. Состояние — в SystemSetting.
 *
 * Расписание: каждые 5 минут (/etc/cron.d/aletheia-http-cron → cron-http-call.sh paykeeper-health).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireCronAuth } from '@/lib/cron-auth';
import { markCronOk } from '@/lib/cron-heartbeat';
import { getPayKeeperConfigFromSettings } from '@/lib/paykeeper';
import { refreshPayKeeperToken } from '@/lib/paykeeper/http';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';
import { writePaykeeperIntegrationLog } from '@/lib/paykeeper-integration-log';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STATE_KEY = 'paykeeper_health_state';
/** Повторное «всё ещё лежит» — не чаще раза в час */
const REMIND_MS = 60 * 60 * 1000;

type HealthState = {
  status: 'ok' | 'fail';
  /** Начало текущего состояния (ISO) */
  since: string;
  /** Последний отправленный алерт (ISO) */
  lastAlertAt?: string;
  lastError?: string;
};

async function readState(): Promise<HealthState | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key: STATE_KEY } });
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as HealthState;
  } catch {
    return null;
  }
}

async function writeState(state: HealthState): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: STATE_KEY },
    update: { value: JSON.stringify(state) },
    create: { key: STATE_KEY, value: JSON.stringify(state), category: 'payments' },
  });
}

function humanDuration(fromIso: string): string {
  const ms = Date.now() - new Date(fromIso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} мин`;
  return `${Math.floor(min / 60)} ч ${min % 60} мин`;
}

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;

  const cfg = await getPayKeeperConfigFromSettings();
  if (!cfg?.server) {
    // «Не настроен» — это тоже отказ мониторинга, а не нейтральное состояние.
    // Раньше здесь молча возвращался 503: если админ очистил или сломал
    // настройки PayKeeper, пробник переставал работать, в логе cron копились
    // ошибки, но Telegram-алерта не было — то есть мониторинг платежей
    // выключался ровно тем же способом, от которого он должен защищать.
    const msg = 'Мониторинг PayKeeper не работает: настройки не заданы или повреждены.';
    console.error(`[paykeeper-health] ${msg}`);
    // Частота — через тот же механизм состояния, что и остальные алерты этого
    // маршрута: иначе при незаданных настройках админам шло бы по сообщению
    // каждые 5 минут, и такие тревоги быстро перестают читать.
    const prev = await readState();
    const nowIso = new Date().toISOString();
    const shouldAlert =
      prev?.status !== 'fail' ||
      !prev.lastAlertAt ||
      Date.now() - new Date(prev.lastAlertAt).getTime() >= REMIND_MS;
    if (shouldAlert) {
      notifyAdminsTelegramAsync('paykeeper_webhook_error', [
        msg,
        'Проверьте Портал → Настройки → PayKeeper. Пока настроек нет, сбои приёма оплаты не отслеживаются.',
      ]);
    }
    await writeState({
      status: 'fail',
      since: prev?.status === 'fail' ? prev.since : nowIso,
      lastAlertAt: shouldAlert ? nowIso : prev?.lastAlertAt,
      lastError: 'not_configured',
    });
    return NextResponse.json({ ok: false, error: 'PayKeeper не настроен' }, { status: 503 });
  }

  const t0 = Date.now();
  let ok = false;
  let errMsg = '';
  try {
    await refreshPayKeeperToken(cfg);
    ok = true;
  } catch (e) {
    errMsg = e instanceof Error ? e.message : String(e);
  }
  const latencyMs = Date.now() - t0;

  const prev = await readState();
  const nowIso = new Date().toISOString();

  if (ok) {
    if (prev?.status === 'fail') {
      // Восстановление
      notifyAdminsTelegramAsync('paykeeper_webhook_error', [
        '✅ PayKeeper снова доступен',
        `Простой: ${humanDuration(prev.since)}`,
        `Ответ за ${latencyMs} мс`,
      ]);
      await writePaykeeperIntegrationLog({
        direction: 'outbound',
        event: 'health.recovered',
        status: 'success',
        message: `PayKeeper восстановился после ${humanDuration(prev.since)}`,
      });
    }
    if (prev?.status !== 'ok') {
      await writeState({ status: 'ok', since: nowIso });
    }
    await markCronOk('paykeeper-health');
    return NextResponse.json({ ok: true, latencyMs });
  }

  // Падение
  const isNewOutage = prev?.status !== 'fail';
  const lastAlert = prev?.lastAlertAt ? new Date(prev.lastAlertAt).getTime() : 0;
  const shouldAlert = isNewOutage || Date.now() - lastAlert > REMIND_MS;

  if (shouldAlert) {
    notifyAdminsTelegramAsync('paykeeper_webhook_error', [
      isNewOutage
        ? '🔴 PayKeeper недоступен — клиенты не смогут оплатить'
        : `🔴 PayKeeper всё ещё недоступен (${humanDuration(prev!.since)})`,
      `Ошибка: ${errMsg.slice(0, 200)}`,
      'Проверка: страница оплаты и статус PayKeeper',
    ]);
  }
  await writeState({
    status: 'fail',
    since: isNewOutage ? nowIso : prev!.since,
    lastAlertAt: shouldAlert ? nowIso : prev?.lastAlertAt,
    lastError: errMsg.slice(0, 300),
  });
  await writePaykeeperIntegrationLog({
    direction: 'outbound',
    event: 'health.fail',
    status: 'error',
    message: errMsg.slice(0, 300),
  });

  return NextResponse.json({ ok: false, error: errMsg.slice(0, 300), latencyMs }, { status: 502 });
}
