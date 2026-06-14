/** Префикс темы тикета из Telegram-бота (фильтр и бейдж в админке). */
export const TELEGRAM_TICKET_SUBJECT_PREFIX = '[Telegram]';

export function isTelegramTicketSubject(subject: string): boolean {
  return subject.startsWith(TELEGRAM_TICKET_SUBJECT_PREFIX) || subject === 'Обращение из Telegram';
}
