/**
 * Создание тикетов поддержки из Telegram-бота.
 */
import { prisma } from '@/lib/db';
import { sendTicketCreatedNotifications } from '@/lib/ticket-create-notify';
import { TELEGRAM_TICKET_SUBJECT_PREFIX } from '@/lib/telegram-ticket-source';
import {
  findUserByTelegramId,
  getOrCreateTelegramGuestUser,
  type LinkedPortalUser,
} from './auth';

export type TicketMessageMeta = {
  telegramChatId: number;
  telegramUserId?: number;
  telegramUsername?: string;
  displayName?: string;
};

type TicketMessage = {
  role: 'user' | 'manager';
  content: string;
  at: string;
  meta?: TicketMessageMeta;
};

export async function createTelegramSupportTicket(params: {
  message: string;
  chatId: number;
  telegramUserId?: number;
  telegramUsername?: string;
  displayName: string;
  linkedUser?: LinkedPortalUser | null;
}): Promise<{ ticketId: string; subject: string }> {
  const { message, chatId, telegramUserId, telegramUsername, displayName } = params;
  const linked = params.linkedUser ?? (telegramUserId ? await findUserByTelegramId(telegramUserId) : null);

  let userId: string;
  let subject: string;

  if (linked) {
    userId = linked.id;
    subject = `${TELEGRAM_TICKET_SUBJECT_PREFIX} Обращение`;
  } else {
    userId = await getOrCreateTelegramGuestUser();
    subject = `${TELEGRAM_TICKET_SUBJECT_PREFIX} Обращение (chat ${chatId})`;
  }

  const msg: TicketMessage = {
    role: 'user',
    content: message.trim(),
    at: new Date().toISOString(),
    meta: {
      telegramChatId: chatId,
      telegramUserId,
      telegramUsername,
      displayName,
    },
  };

  const ticket = await prisma.ticket.create({
    data: {
      userId,
      subject,
      messages: JSON.stringify([msg]),
    },
  });

  const guestLine = linked ? undefined : [`Telegram chat: ${chatId}`];
  await sendTicketCreatedNotifications({
    ticketId: ticket.id,
    userId,
    subject,
    message: message.trim(),
    displayName: linked ? (linked.displayName ?? linked.email) : displayName,
    userEmail: linked?.email,
    telegramExtraLines: guestLine,
  });

  return { ticketId: ticket.id, subject };
}
