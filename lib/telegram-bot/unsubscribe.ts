/**
 * Отписка от автосообщений бота (прогрев/догоны/офферы).
 *
 * Обязательна для любой автономной рассылки: человек всегда должен иметь
 * возможность прекратить её одной командой. `unsubscribedAt` навсегда исключает
 * лид из всех автокасаний; на прямые вопросы бот отвечать продолжает.
 */
import { prisma } from '@/lib/db';

export const UNSUBSCRIBE_HINT = 'Не хотите напоминаний — напишите «стоп».';

/** Похоже ли сообщение на команду отписки. */
export function isUnsubscribeCommand(text: string): boolean {
  return /^\/?(стоп|stop|отписаться|отписка|не пиши(те)?( больше)?|unsubscribe|хватит|отстаньте)[\s.!]*$/i.test(
    text.trim()
  );
}

/** Пометить отписку. Возвращает true, если лид найден и обновлён. */
export async function markUnsubscribed(chatId: number): Promise<boolean> {
  try {
    const res = await prisma.lead.updateMany({
      where: { telegramChatId: chatId, unsubscribedAt: null },
      data: { unsubscribedAt: new Date() },
    });
    return res.count > 0;
  } catch (e) {
    console.error('[unsubscribe] mark:', e);
    return false;
  }
}

export const UNSUBSCRIBE_CONFIRM =
  'Готово — больше не буду напоминать о себе. Если появятся вопросы по курсам, ' +
  'просто напишите сюда, я на связи.';
