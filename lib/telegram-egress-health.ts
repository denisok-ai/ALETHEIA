/**
 * Сторож связи сервера с Telegram API: чистая логика переходов состояния.
 *
 * Зачем: 23.10.2026 туннель до Telegram (openconnect) падал по кругу два часа —
 * у VPN-сервера сменился сертификат, закреплённый пин не совпал. Все алерты
 * с прода молча не доходили, а проверка Telegram шла раз в сутки. Здесь только
 * решение «что делать» по результату пробы: без сети и без БД, поэтому
 * тестируется отдельно (tests/unit/telegram-egress-health.test.ts).
 * Проба, письмо и сохранение состояния — app/api/cron/telegram-egress/route.ts.
 */

/** Состояние связи. Хранится в SystemSetting `telegram_egress_state`. */
export type TelegramEgressState = {
  status: 'ok' | 'fail';
  /** Начало текущего состояния (ISO). Для fail — время первой неудачной проверки. */
  since: string;
  /** Неудач подряд; сбрасывается первым же успехом. */
  failStreak: number;
  /** Когда отправлено последнее письмо о падении (ISO). */
  lastAlertAt?: string;
  lastError?: string;
};

export type TelegramEgressProbe = { ok: boolean; error?: string };

export type TelegramEgressAction = 'none' | 'alert_down' | 'remind_down' | 'notify_recovered';

/** Одиночные сбои прокси бывают: тревожим после стольких неудач подряд (≈15 мин при шаге 5 мин). */
export const TELEGRAM_EGRESS_FAIL_THRESHOLD = 3;

/** Повтор «всё ещё недоступен» — не чаще раза в 6 часов. */
export const TELEGRAM_EGRESS_REMIND_MS = 6 * 60 * 60 * 1000;

/**
 * Следующее состояние и действие по результату пробы.
 *
 * - успех: failStreak = 0; если о падении уже сообщали (есть lastAlertAt) — notify_recovered;
 * - неудача: подряд меньше порога — молчим; порог достигнут и тревоги ещё не было — alert_down;
 *   тревога была не раньше 6 ч назад — none, иначе remind_down.
 *
 * lastAlertAt в результате выставлен так, будто письмо ушло. Если отправка не удалась,
 * вызывающий откатывает его, и тревога повторится на следующем прогоне.
 */
export function decideTelegramEgress(
  prev: TelegramEgressState | null,
  probe: TelegramEgressProbe,
  now: Date
): { next: TelegramEgressState; action: TelegramEgressAction } {
  const nowIso = now.toISOString();

  if (probe.ok) {
    const reportedDown = prev?.status === 'fail' && Boolean(prev.lastAlertAt);
    return {
      next: {
        status: 'ok',
        since: prev?.status === 'ok' ? prev.since : nowIso,
        failStreak: 0,
      },
      action: reportedDown ? 'notify_recovered' : 'none',
    };
  }

  const ongoing = prev?.status === 'fail' ? prev : null;
  const base: TelegramEgressState = {
    status: 'fail',
    since: ongoing?.since ?? nowIso,
    failStreak: (ongoing?.failStreak ?? 0) + 1,
    lastAlertAt: ongoing?.lastAlertAt,
    lastError: probe.error ? cleanTelegramError(probe.error) : undefined,
  };

  if (base.failStreak < TELEGRAM_EGRESS_FAIL_THRESHOLD) {
    return { next: base, action: 'none' };
  }

  // Отметка тревоги, которую не удалось разобрать, не должна глушить алерт навсегда.
  const lastAlertMs = ongoing?.lastAlertAt ? Date.parse(ongoing.lastAlertAt) : NaN;
  if (!Number.isFinite(lastAlertMs)) {
    return { next: { ...base, lastAlertAt: nowIso }, action: 'alert_down' };
  }
  if (now.getTime() - lastAlertMs >= TELEGRAM_EGRESS_REMIND_MS) {
    return { next: { ...base, lastAlertAt: nowIso }, action: 'remind_down' };
  }
  return { next: base, action: 'none' };
}

/**
 * Текст ошибки для БД и письма. Токен бота попадает в URL запроса
 * (…/bot<id>:<token>/getMe), учётные данные прокси — в адрес HTTPS_PROXY.
 * Ни то ни другое не должно утечь ни в письмо, ни в SystemSetting.
 */
export function cleanTelegramError(raw: string): string {
  return raw
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot<скрыт>')
    .replace(/\/\/[^/\s@]+@/g, '//<скрыто>@')
    .slice(0, 300);
}

/** Длительность простоя для текста: «45 мин», «2 ч 5 мин». */
export function formatTelegramDowntime(sinceIso: string, now: Date): string {
  const ms = now.getTime() - Date.parse(sinceIso);
  if (!Number.isFinite(ms)) return 'неизвестно';
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} мин`;
  return `${Math.floor(min / 60)} ч ${min % 60} мин`;
}

/** Время для письма: «23.10.2026, 14:05 МСК». */
export function formatMoscowTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'неизвестно';
  const local = d.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${local} МСК`;
}
