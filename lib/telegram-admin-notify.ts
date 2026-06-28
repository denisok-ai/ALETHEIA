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
  | 'installment_created'
  | 'installment_payment_received'
  | 'installment_completed'
  | 'installment_payment_failed'
  | 'installment_reminder';

const EVENT_LABELS: Record<AdminTelegramEvent, string> = {
  contact_lead: 'Новая заявка с сайта',
  user_registered: 'Регистрация пользователя',
  payment_received: 'Оплата получена',
  support_ticket: 'Новый тикет поддержки',
  paykeeper_webhook_error: 'Ошибка webhook PayKeeper',
  installment_created: 'Новая рассрочка',
  installment_payment_received: 'Платёж по рассрочке',
  installment_completed: 'Рассрочка завершена',
  installment_payment_failed: 'Ошибка списания рассрочки',
  installment_reminder: 'Напоминание о рассрочке',
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
  const chatIds = await getTelegramAdminChatIds();
  if (chatIds.length === 0) {
    return { sent: 0, failed: 0, skipped: true };
  }
  const text = formatAdminTelegramMessage(event, lines);
  try {
    const { sent, failed } = await sendTelegramBroadcast(chatIds, text);
    if (failed > 0) {
      console.warn(`[telegram-admin] ${event}: sent=${sent} failed=${failed}`);
    }
    return { sent, failed, skipped: false };
  } catch (e) {
    console.error(`[telegram-admin] ${event}:`, e);
    return { sent: 0, failed: chatIds.length, skipped: false };
  }
}

/** Fire-and-forget обёртка для вызова из API routes. */
export function notifyAdminsTelegramAsync(event: AdminTelegramEvent, lines: string[]): void {
  void notifyAdminsTelegram(event, lines);
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
