/**
 * Cron (каждые 5 минут): сторож связи сервера с Telegram API.
 *
 * Проба — getMe через прокси (probeTelegramApi). Инцидент 23.10.2026: туннель
 * до Telegram падал по кругу два часа, и все алерты молча не доходили. Проверка
 * Telegram в content-integrity шла раз в сутки — отсюда частота 5 минут.
 *
 * Падение сообщаем ПОЧТОЙ напрямую: при недоступном Telegram алерт в него не
 * дойдёт. Тревога — после 3 неудач подряд, повтор «всё ещё недоступен» — не чаще
 * раза в 6 часов. Восстановление — в Telegram (к этому моменту он снова доступен).
 * Переходы состояния — lib/telegram-egress-health.ts.
 *
 * Heartbeat пишется после каждой завершённой пробы, и при успехе, и при падении:
 * задача отработала, а отсутствие связи уже отражено письмом. Иначе сторож
 * фоновых задач принял бы падение туннеля за остановку крона.
 *
 * ?dry=1 — вернуть пробу и решение без отправки, записи состояния и heartbeat.
 *
 * Расписание: /etc/cron.d/aletheia-http-cron → cron-http-call.sh telegram-egress.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireCronAuth } from '@/lib/cron-auth';
import { markCronOk } from '@/lib/cron-heartbeat';
import { sendEmail } from '@/lib/email';
import { getSystemSettings } from '@/lib/settings';
import { probeTelegramApi } from '@/lib/telegram';
import { escapeHtml, notifyAdminsTelegram } from '@/lib/telegram-admin-notify';
import {
  decideTelegramEgress,
  formatMoscowTime,
  formatTelegramDowntime,
  type TelegramEgressState,
} from '@/lib/telegram-egress-health';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STATE_KEY = 'telegram_egress_state';

async function readState(): Promise<TelegramEgressState | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key: STATE_KEY } });
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as TelegramEgressState;
  } catch {
    return null;
  }
}

async function writeState(state: TelegramEgressState): Promise<void> {
  const value = JSON.stringify(state);
  await prisma.systemSetting.upsert({
    where: { key: STATE_KEY },
    update: { value },
    create: { key: STATE_KEY, value, category: 'monitoring' },
  });
}

/**
 * Письмо о падении связи. Возвращает false, если письмо не ушло: тогда отправка
 * не запоминается, и тревога повторится на следующем прогоне.
 */
async function sendDownEmail(
  action: 'alert_down' | 'remind_down',
  state: TelegramEgressState,
  now: Date
): Promise<boolean> {
  try {
    const { resend_notify_email: to } = await getSystemSettings();
    if (!to) {
      console.error('[telegram-egress] не задан resend_notify_email, письмо о падении не отправлено');
      return false;
    }
    const remind = action === 'remind_down';
    const subject = remind
      ? 'AVATERRA алерт: Telegram с сервера всё ещё недоступен'
      : 'AVATERRA алерт: Telegram с сервера недоступен';
    const lines = [
      remind
        ? `Telegram по-прежнему недоступен с сервера, простой ${formatTelegramDowntime(state.since, now)}.`
        : 'Telegram недоступен с сервера, алерты в Telegram не доходят.',
      `Недоступен с ${formatMoscowTime(state.since)} (первая неудачная проверка, неудач подряд: ${state.failStreak}).`,
      `Последняя ошибка: ${state.lastError ?? 'не указана'}`,
      'Проверьте туннель: systemctl status openconnect-telegram; journalctl -u openconnect-telegram | grep servercert — если пин сертификата не совпал, см. docs/Diary.md 23.10.',
    ];
    const html = lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('\n');
    return await sendEmail(to, subject, html);
  } catch (e) {
    console.error('[telegram-egress] письмо о падении не отправлено:', e);
    return false;
  }
}

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';

  const t0 = Date.now();
  const probe = await probeTelegramApi();
  const latencyMs = Date.now() - t0;
  const now = new Date();

  const prev = await readState();
  const decision = decideTelegramEgress(prev, probe, now);
  const { action } = decision;

  if (dryRun) {
    return NextResponse.json(
      { ok: probe.ok, dryRun: true, action, latencyMs, state: decision.next },
      { status: probe.ok ? 200 : 502 }
    );
  }

  let next = decision.next;
  if (action === 'alert_down' || action === 'remind_down') {
    const sent = await sendDownEmail(action, decision.next, now);
    if (!sent) {
      // Письмо не ушло — отправку не запоминаем, тревога повторится на следующем прогоне.
      next = { ...next, lastAlertAt: prev?.status === 'fail' ? prev.lastAlertAt : undefined };
    }
  } else if (action === 'notify_recovered' && prev) {
    // Восстановление шлём в Telegram: пробу он только что прошёл. Если и сообщение
    // не дошло, notifyAdminsTelegram сам дублирует письмом.
    await notifyAdminsTelegram('telegram_egress', [
      `✅ Telegram с сервера снова доступен, простой ${formatTelegramDowntime(prev.since, now)}`,
      `Ответ за ${latencyMs} мс`,
    ]);
  }

  await writeState(next);
  await markCronOk('telegram-egress');

  if (probe.ok) {
    return NextResponse.json({ ok: true, action, latencyMs });
  }
  return NextResponse.json(
    { ok: false, action, error: next.lastError ?? 'нет ответа', latencyMs },
    { status: 502 }
  );
}
