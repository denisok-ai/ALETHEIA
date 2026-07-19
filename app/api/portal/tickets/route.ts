/**
 * Student: create support ticket.
 * После создания: автоответ студенту «Обращение принято», уведомление менеджеру (resend_notify_email).
 * 7.4: при оплаченном заказе без доступа — привязка заказа к тикету и тема «Не приходит доступ».
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendTransactionalEmail } from '@/lib/email-service';
import {
  buildTicketAutoReplyEmail,
} from '@/lib/email-templates';
import { getSystemSettings } from '@/lib/settings';
import { claimPaidOrdersForUser } from '@/lib/claim-orders';
import { generateAutoReply, isConfidentReply } from '@/lib/ticket-auto-reply';
import { sendTicketCreatedNotifications } from '@/lib/ticket-create-notify';
import { ticketCreateSchema } from '@/lib/validations/ticket';
import { checkRateLimit } from '@/lib/rate-limit';

/** Найти первый оплаченный заказ по email, по которому у пользователя нет доступа к курсу. */
async function findPaidOrderWithoutAccess(userId: string, emailNorm: string): Promise<string | null> {
  const paidOrders = await prisma.order.findMany({
    where: { status: 'paid' },
  });
  const byEmail = paidOrders.filter((o) => o.clientEmail.trim().toLowerCase() === emailNorm);
  for (const order of byEmail) {
    const service = await prisma.service.findFirst({
      where: { paykeeperTariffId: order.tariffId, isActive: true },
      select: { courseId: true },
    });
    const courseId = service?.courseId;
    if (!courseId) continue;
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) return order.orderNumber;
  }
  return null;
}

export async function POST(request: NextRequest) {
  // каждый тикет запускает LLM-автоответ (деньги)
  const rateLimitRes = checkRateLimit(request, 'ticket-create', 5);
  if (rateLimitRes) return rateLimitRes;

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ticketCreateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Неверные данные';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  let subject = parsed.data.subject.trim();
  const message = (parsed.data.message ?? '').trim();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, profile: { select: { displayName: true } } },
  });
  const emailNorm = user?.email?.trim().toLowerCase() ?? '';
  await claimPaidOrdersForUser(userId, emailNorm);
  const orderWithoutAccess = emailNorm ? await findPaidOrderWithoutAccess(userId, emailNorm) : null;
  if (orderWithoutAccess) {
    subject = subject === 'Не приходит доступ' || subject.startsWith('Не приходит доступ')
      ? subject
      : `Не приходит доступ — ${subject}`;
  }

  const messages = message ? [{ role: 'user' as const, content: message, at: new Date().toISOString() }] : [];

  const ticket = await prisma.ticket.create({
    data: {
      userId,
      subject,
      messages: JSON.stringify(messages),
      orderNumber: orderWithoutAccess ?? undefined,
    },
  });
  const settings = await getSystemSettings();
  const siteUrl = settings.site_url?.replace(/\/$/, '') || '';
  const displayName = user?.profile?.displayName ?? user?.email ?? 'Клиент';

  await sendTicketCreatedNotifications({
    ticketId: ticket.id,
    userId,
    subject,
    message,
    displayName,
    userEmail: user?.email,
    orderNumber: ticket.orderNumber,
  });

  // Опциональный автоответ от AI при включённой настройке
  if (message) {
    const autoReplySetting = await prisma.systemSetting.findUnique({
      where: { key: 'ticket_auto_reply_enabled' },
    });
    const autoReplyEnabled = autoReplySetting?.value === 'true' || autoReplySetting?.value === '1';
    if (autoReplyEnabled) {
      try {
        const autoReply = await generateAutoReply(subject, message);
        if (autoReply && isConfidentReply(autoReply)) {
          const updatedMessages = [
            ...messages,
            { role: 'manager' as const, content: autoReply, at: new Date().toISOString() },
          ];
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: { messages: JSON.stringify(updatedMessages), updatedAt: new Date() },
          });
          if (user?.email) {
            const ticketUrl = siteUrl ? `${siteUrl}/portal/student/support/${ticket.id}` : '';
            const email = buildTicketAutoReplyEmail({
              displayName,
              subject,
              autoReply,
              ticketUrl: ticketUrl || undefined,
              systemTitle: settings.portal_title || 'AVATERRA',
            });
            await sendTransactionalEmail({
              to: user.email,
              subject: email.subject,
              html: email.html,
              context: { module: 'tickets', entityId: ticket.id, userId },
            });
          }
        }
      } catch (e) {
        console.error('Ticket: auto-reply', e);
      }
    }
  }

  return NextResponse.json({
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      created_at: ticket.createdAt.toISOString(),
    },
  });
}
