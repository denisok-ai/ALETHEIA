/**
 * Уведомление владельца тикета в Telegram при ответе менеджера (портал или бот).
 */
import { prisma } from '@/lib/db';
import { getSystemSettings } from '@/lib/settings';
import { sendTelegramMessageWithResult } from '@/lib/telegram';

type TicketMessageMeta = {
  telegramChatId?: number;
};

type TicketMessageItem = {
  role?: string;
  content?: string;
  meta?: TicketMessageMeta;
};

function parseMessages(raw: string): TicketMessageItem[] {
  try {
    const arr = JSON.parse(raw) as unknown[];
    return Array.isArray(arr) ? (arr as TicketMessageItem[]) : [];
  } catch {
    return [];
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Chat ID для уведомления: Profile.telegramId или meta.telegramChatId из первого сообщения. */
export async function resolveTicketTelegramChatId(
  ticketUserId: string,
  messagesRaw: string
): Promise<number | null> {
  const profile = await prisma.profile.findUnique({
    where: { userId: ticketUserId },
    select: { telegramId: true },
  });
  if (profile?.telegramId) return profile.telegramId;

  for (const m of parseMessages(messagesRaw)) {
    if (typeof m.meta?.telegramChatId === 'number') return m.meta.telegramChatId;
  }
  return null;
}

/** Отправить пользователю уведомление об ответе менеджера по тикету. */
export async function notifyTicketOwnerTelegramReply(params: {
  ticketId: string;
  subject: string;
  replyContent: string;
  ticketUserId: string;
  messagesRaw: string;
}): Promise<{ sent: boolean; chatId?: number }> {
  const chatId = await resolveTicketTelegramChatId(params.ticketUserId, params.messagesRaw);
  if (!chatId) return { sent: false };

  const settings = await getSystemSettings();
  const siteUrl = settings.site_url?.replace(/\/$/, '') || '';
  const preview = params.replyContent.trim().slice(0, 500);
  const ticketUrl = siteUrl ? `${siteUrl}/portal/student/support/${params.ticketId}` : '';

  const lines = [
    '<b>💬 Ответ по вашему обращению</b>',
    '',
    `<b>Тема:</b> ${escapeHtml(params.subject.slice(0, 80))}`,
    '',
    escapeHtml(preview) + (params.replyContent.length > 500 ? '…' : ''),
  ];
  if (ticketUrl) lines.push('', `<a href="${ticketUrl}">Открыть переписку в портале</a>`);

  const r = await sendTelegramMessageWithResult(chatId, lines.join('\n'));
  if (!r.ok) {
    console.error(`[telegram-ticket-notify] chat=${chatId} ticket=${params.ticketId}: ${r.error}`);
    return { sent: false, chatId };
  }
  return { sent: true, chatId };
}
