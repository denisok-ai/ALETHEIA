/**
 * Типы входящих обновлений Telegram и контекста обработчика бота AVATERRA.
 */

export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramChat = {
  id: number;
  type: string;
  first_name?: string;
  last_name?: string;
  username?: string;
};

/** Контакт, которым человек поделился кнопкой `request_contact`. */
export type TelegramContact = {
  phone_number: string;
  first_name?: string;
  last_name?: string;
  user_id?: number;
};

export type TelegramMessage = {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  contact?: TelegramContact;
  date?: number;
};

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  chat_instance?: string;
  data?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export type BotSessionState =
  | 'idle'
  | 'support_compose'
  | 'funnel_freeform'
  | 'admin_user_search'
  | 'admin_ticket_reply'
  | 'admin_broadcast';

export type BotSession = {
  state: BotSessionState;
  data?: Record<string, string>;
};

export type BotContext = {
  chatId: number;
  telegramUserId?: number;
  telegramUsername?: string;
  displayName: string;
  text?: string;
  command?: string;
  callbackData?: string;
  callbackQueryId?: string;
  messageId?: number;
  isAdmin: boolean;
};
