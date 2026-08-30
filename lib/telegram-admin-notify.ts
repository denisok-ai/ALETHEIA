/**
 * Оповещения администраторов в Telegram о событиях на сервере.
 * Chat ID задаются в Портал → Настройки → Интеграции (telegram_admin_chat_ids).
 */
import { prisma } from './db';
import { sendTelegramBroadcast, sendTelegramMessageWithResult } from './telegram';

const CHAT_IDS_KEY = 'telegram_admin_chat_ids';

export type AdminTelegramEvent =
  | 'contact_lead'
  | 'user_registered'
  | 'payment_received'
  | 'support_ticket'
  | 'paykeeper_webhook_error'
  | 'payment_needs_attention'
  | 'installment_created'
  | 'installment_payment_received'
  | 'installment_completed'
  | 'installment_payment_failed'
  | 'installment_reminder'
  | 'content_integrity'
  | 'blog_announced'
  | 'email_delivery_failed'
  | 'seo_digest';

const EVENT_LABELS: Record<AdminTelegramEvent, string> = {
  contact_lead: 'Новая заявка с сайта',
  user_registered: 'Регистрация пользователя',
  payment_received: 'Оплата получена',
  support_ticket: 'Новый тикет поддержки',
  paykeeper_webhook_error: 'Ошибка webhook PayKeeper',
  payment_needs_attention: 'Оплата требует ручной проверки',
  installment_created: 'Новая рассрочка',
  installment_payment_received: 'Платёж по рассрочке',
  installment_completed: 'Рассрочка завершена',
  installment_payment_failed: 'Ошибка списания рассрочки',
  installment_reminder: 'Напоминание о рассрочке',
  content_integrity: 'Целостность контента курсов',
  blog_announced: 'Анонс статьи в канал',
  email_delivery_failed: 'Письмо не отправлено',
  seo_digest: 'SEO-дайджест Яндекса',
};

/** Разбор списка chat ID из настроек (через запятую). */
export function parseTelegramChatIds(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Chat ID админов из SystemSetting. */
export async function getTelegramAdminChatIds(): Promise<string[]> {
  const row = await prisma.systemSetting.findUnique({ where: { key: CHAT_IDS_KEY } });
  return parseTelegramChatIds(row?.value);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Сформировать HTML-сообщение для Telegram. */
export function formatAdminTelegramMessage(event: AdminTelegramEvent, lines: string[]): string {
  const label = EVENT_LABELS[event] ?? event;
  const body = lines.map((l) => escapeHtml(l)).join('\n');
  return `<b>AVATERRA</b> · ${escapeHtml(label)}\n${body}`;
}

/**
 * Отправить оповещение всем admin chat ID. Ошибки логируются, не пробрасываются.
 * Возвращает статистику (для тестов и ручной проверки).
 */
export async function notifyAdminsTelegram(
  event: AdminTelegramEvent,
  lines: string[]
): Promise<{ sent: number; failed: number; skipped: boolean }> {
  // Чтение chat ID — тоже внутри try: это обращение к БД, и раньше его отказ
  // ронял промис наружу. Через notifyAdminsTelegramAsync (void, без catch) это
  // становилось unhandled rejection, то есть тревога о поломке платежей могла
  // потеряться ровно тогда, когда она нужнее всего.
  try {
    const chatIds = await getTelegramAdminChatIds();
    if (chatIds.length === 0) {
      return { sent: 0, failed: 0, skipped: true };
    }
    const text = formatAdminTelegramMessage(event, lines);
    const { sent, failed } = await sendTelegramBroadcast(chatIds, text);
    if (failed > 0) {
      console.warn(`[telegram-admin] ${event}: sent=${sent} failed=${failed}`);
    }
    if (sent === 0) {
      // Ни одно сообщение не ушло — вероятно, лежит сам Telegram-канал сервера
      // (инцидент 03–12.08.2026: 9 дней молчали ВСЕ алерты, потому что алерт
      // о падении Telegram слался в Telegram). Дублируем на почту.
      await sendAdminAlertEmailFallback(event, lines).catch((e) =>
        console.error('[telegram-admin] email fallback:', e)
      );
    }
    return { sent, failed, skipped: false };
  } catch (e) {
    console.error(`[telegram-admin] ${event}:`, e);
    return { sent: 0, failed: 0, skipped: false };
  }
}

const EMAIL_FALLBACK_LAST_KEY = 'admin_alert_email_fallback_last_at';
/** Не чаще раза в час: при лежащем Telegram алертов может быть много. */
const EMAIL_FALLBACK_MIN_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Почтовый дублёр: когда Telegram не доставил НИ одного алерта — шлём письмо
 * на resend_notify_email (админская почта). Почта не зависит от Telegram-egress.
 */
async function sendAdminAlertEmailFallback(
  event: AdminTelegramEvent,
  lines: string[]
): Promise<void> {
  const last = await prisma.systemSetting.findUnique({ where: { key: EMAIL_FALLBACK_LAST_KEY } });
  if (last?.value && Date.now() - new Date(last.value).getTime() < EMAIL_FALLBACK_MIN_INTERVAL_MS) {
    return;
  }
  // Ленивая загрузка: обычный путь алертов не должен тянуть почтовый модуль.
  const [{ sendEmail }, { getSystemSettings }] = await Promise.all([
    import('./email'),
    import('./settings'),
  ]);
  const settings = await getSystemSettings();
  const to = settings.resend_notify_email;
  if (!to) return;

  const label = EVENT_LABELS[event] ?? event;
  const html = [
    `<p><strong>Telegram-оповещения не доставляются</strong> — это почтовый дублёр алерта.</p>`,
    `<p><strong>${escapeHtml(label)}</strong></p>`,
    ...lines.map((l) => `<p>${escapeHtml(l)}</p>`),
    `<p style="color:#64748B">Проверьте Telegram-канал сервера (HTTPS_PROXY, мост/VPN). Повторные письма — не чаще раза в час.</p>`,
  ].join('\n');
  const ok = await sendEmail(to, `AVATERRA алерт (Telegram недоступен): ${label}`, html);
  if (ok) {
    await prisma.systemSetting.upsert({
      where: { key: EMAIL_FALLBACK_LAST_KEY },
      update: { value: new Date().toISOString() },
      create: { key: EMAIL_FALLBACK_LAST_KEY, value: new Date().toISOString(), category: 'monitoring' },
    });
  }
}

/**
 * Fire-and-forget обёртка для вызова из API routes.
 * catch обязателен: без него отказ уходит в unhandledRejection и виден только
 * в логе процесса — а это единственный активный канал связи с админами.
 */
export function notifyAdminsTelegramAsync(event: AdminTelegramEvent, lines: string[]): void {
  void notifyAdminsTelegram(event, lines).catch((e) => {
    console.error(`[telegram-admin] ${event}: оповещение не отправлено:`, e);
  });
}

/** Тестовое сообщение одному chat ID (админка). */
export async function sendAdminTelegramTest(chatIds: string[]): Promise<{ sent: number; failed: number; errors: string[] }> {
  const text = formatAdminTelegramMessage('contact_lead', [
    'Тестовое оповещение из настроек портала.',
    `Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`,
  ]);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const id of chatIds) {
    const r = await sendTelegramMessageWithResult(id, text);
    if (r.ok) sent++;
    else {
      failed++;
      errors.push(`${id}: ${r.error}`);
    }
  }
  return { sent, failed, errors };
}
