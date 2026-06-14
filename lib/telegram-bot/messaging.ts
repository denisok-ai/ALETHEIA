/**
 * Отправка и редактирование сообщений бота с единообразными ошибками на русском.
 */
import {
  editTelegramMessageWithResult,
  sendTelegramMessageWithResult,
  type SendTelegramMessageOptions,
  type TelegramSendResult,
} from '@/lib/telegram';
import type { BotContext } from './types';

function humanizeTelegramError(error: string): string {
  const e = error.toLowerCase();
  if (e.includes('message is not modified')) return '';
  if (e.includes('message to edit not found') || e.includes('message can\'t be edited')) {
    return 'Сообщение устарело — откройте меню заново (/menu).';
  }
  if (e.includes('bot was blocked')) return 'Бот заблокирован в этом чате.';
  if (e.includes('chat not found')) return 'Чат не найден.';
  if (e.includes('too many requests')) return 'Слишком много запросов. Подождите немного.';
  return 'Не удалось отправить сообщение. Попробуйте позже.';
}

export async function botReply(
  ctx: BotContext,
  text: string,
  options?: SendTelegramMessageOptions & { forceNew?: boolean }
): Promise<TelegramSendResult> {
  if (!options?.forceNew && ctx.messageId) {
    const edited = await editTelegramMessageWithResult(ctx.chatId, ctx.messageId, text, options);
    if (edited.ok) return edited;
    const hint = humanizeTelegramError(edited.error);
    if (!hint) return edited;
  }
  const sent = await sendTelegramMessageWithResult(ctx.chatId, text, options);
  if (!sent.ok) {
    const hint = humanizeTelegramError(sent.error);
    if (hint && hint !== sent.error) {
      return sendTelegramMessageWithResult(ctx.chatId, `❌ ${hint}`);
    }
  }
  return sent;
}
