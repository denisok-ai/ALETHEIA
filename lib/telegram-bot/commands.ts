/**
 * Список команд Telegram-бота AVATERRA для setMyCommands (BotFather / Bot API).
 * Должен совпадать с обработчиками в router.ts.
 */
import { getEnvOverrides } from '@/lib/settings';
import { telegramApiFetch } from '@/lib/telegram-fetch';

export type TelegramBotCommand = {
  command: string;
  description: string;
};

/** Команды для всех пользователей. */
export const TELEGRAM_USER_COMMANDS: TelegramBotCommand[] = [
  { command: 'start', description: 'Главное меню' },
  { command: 'menu', description: 'Главное меню' },
  { command: 'help', description: 'Справка и FAQ' },
  { command: 'faq', description: 'Частые вопросы по категориям' },
  { command: 'progress', description: 'Прогресс по курсам' },
  { command: 'cert', description: 'Мои сертификаты' },
  { command: 'ticket_status', description: 'Статус обращений в поддержку' },
  { command: 'link', description: 'Привязать аккаунт по email' },
  { command: 'myid', description: 'Показать Chat ID и Telegram user ID' },
];

/** Команды только для администраторов (видны всем, доступ — по роли). */
export const TELEGRAM_ADMIN_COMMANDS: TelegramBotCommand[] = [
  { command: 'admin_on', description: 'Подписаться на оповещения админа' },
  { command: 'admin', description: 'Меню администратора' },
  { command: 'stats', description: 'Статистика портала' },
  { command: 'digest', description: 'Дайджест за сегодня' },
  { command: 'tickets', description: 'Открытые тикеты (админ)' },
  { command: 'ticket', description: 'Ответить на тикет по ID' },
  { command: 'orders', description: 'Последние заказы' },
  { command: 'users', description: 'Поиск пользователя по email' },
  { command: 'user', description: 'Карточка пользователя по email' },
  { command: 'notify_test', description: 'Тест оповещений админов' },
];

export const TELEGRAM_BOT_COMMANDS: TelegramBotCommand[] = [
  ...TELEGRAM_USER_COMMANDS,
  ...TELEGRAM_ADMIN_COMMANDS,
];

export type RegisterTelegramCommandsResult = { ok: true; count: number } | { ok: false; error: string };

/** Зарегистрировать полный список команд через Bot API setMyCommands. */
export async function registerTelegramBotCommands(): Promise<RegisterTelegramCommandsResult> {
  const overrides = await getEnvOverrides();
  const token = overrides.telegram_bot_token;
  if (!token) return { ok: false, error: 'Не настроен токен Telegram-бота' };

  try {
    const res = await telegramApiFetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: TELEGRAM_BOT_COMMANDS }),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!res.ok || data.ok === false) {
      return { ok: false, error: String(data.description ?? res.statusText ?? 'setMyCommands failed') };
    }
    return { ok: true, count: TELEGRAM_BOT_COMMANDS.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка setMyCommands' };
  }
}

/** Префикс темы тикета, созданного из Telegram (для фильтра в админке). */
export { TELEGRAM_TICKET_SUBJECT_PREFIX, isTelegramTicketSubject } from '@/lib/telegram-ticket-source';
