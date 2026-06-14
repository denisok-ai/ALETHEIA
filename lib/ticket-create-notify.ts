/**
 * Уведомления после создания тикета поддержки (email студенту, email менеджеру, Telegram админам).
 */
import { sendTransactionalEmail } from '@/lib/email-service';
import { buildTicketCreatedEmail, buildTicketManagerNotificationEmail } from '@/lib/email-templates';
import { getSystemSettings } from '@/lib/settings';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';

export async function sendTicketCreatedNotifications(params: {
  ticketId: string;
  userId: string;
  subject: string;
  message: string;
  displayName: string;
  userEmail?: string | null;
  orderNumber?: string | null;
  telegramExtraLines?: string[];
}): Promise<void> {
  const settings = await getSystemSettings();
  const siteUrl = settings.site_url?.replace(/\/$/, '') || '';
  const { ticketId, userId, subject, message, displayName, userEmail, orderNumber, telegramExtraLines } = params;

  if (userEmail) {
    try {
      const email = buildTicketCreatedEmail({
        displayName,
        subject,
        ticketId,
        systemTitle: settings.portal_title || 'AVATERRA',
      });
      await sendTransactionalEmail({
        to: userEmail,
        subject: email.subject,
        html: email.html,
        context: { module: 'tickets', entityId: ticketId, userId },
      });
    } catch (e) {
      console.error('Ticket: confirm email to student', e);
    }
  }

  const notifyEmail = settings.resend_notify_email?.trim();
  if (notifyEmail) {
    try {
      const email = buildTicketManagerNotificationEmail({
        displayName,
        email: userEmail ?? '',
        subject,
        message,
        ticketId,
        ticketUrl: siteUrl ? `${siteUrl}/portal/manager/tickets` : undefined,
        orderNumber: orderNumber ?? undefined,
      });
      await sendTransactionalEmail({
        to: notifyEmail,
        subject: email.subject,
        html: email.html,
        context: { module: 'tickets', entityId: ticketId, userId },
      });
    } catch (e) {
      console.error('Ticket: notify manager', e);
    }
  }

  notifyAdminsTelegramAsync('support_ticket', [
    `Тема: ${subject}`,
    `От: ${displayName}${userEmail ? ` (${userEmail})` : ''}`,
    ...(message ? [`Сообщение: ${message.slice(0, 400)}`] : []),
    ...(orderNumber ? [`Заказ: ${orderNumber}`] : []),
    ...(telegramExtraLines ?? []),
    ...(siteUrl ? [`Портал: ${siteUrl}/portal/manager/tickets`] : []),
  ]);
}
