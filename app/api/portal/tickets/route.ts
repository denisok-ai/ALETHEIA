/**
 * Student: create support ticket.
 * После создания: автоответ студенту «Обращение принято», уведомление менеджеру (resend_notify_email).
 * 7.4: при оплаченном заказе без доступа — привязка заказа к тикету и тема «Не приходит доступ».
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { getSystemSettings } from '@/lib/settings';
import { claimPaidOrdersForUser } from '@/lib/claim-orders';
import { generateAutoReply, isConfidentReply } from '@/lib/ticket-auto-reply';
import { ticketCreateSchema } from '@/lib/validations/ticket';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

  if (user?.email) {
    try {
      const htmlConfirm = `
        <p>Здравствуйте, ${escapeHtml(displayName)}!</p>
        <p>Ваше обращение в поддержку принято в работу.</p>
        <p><strong>Тема:</strong> ${escapeHtml(subject)}</p>
        <p>Номер обращения: #${ticket.id}. Мы ответим вам в ближайшее время.</p>
        <p>— ${settings.portal_title || 'AVATERRA'}</p>
      `;
      await sendEmail(user.email, 'Обращение в поддержку принято', htmlConfirm);
    } catch (e) {
      console.error('Ticket: confirm email to student', e);
    }
  }

  const notifyEmail = settings.resend_notify_email?.trim();
  if (notifyEmail) {
    try {
      const orderLine = ticket.orderNumber
        ? `<p><strong>Привязан заказ (нет доступа):</strong> ${escapeHtml(ticket.orderNumber)}</p>`
        : '';
      const htmlNotify = `
        <p>Новое обращение в поддержку.</p>
        <p><strong>От:</strong> ${escapeHtml(displayName)} (${escapeHtml(user?.email ?? '')})</p>
        <p><strong>Тема:</strong> ${escapeHtml(subject)}</p>
        ${orderLine}
        ${message ? `<p><strong>Сообщение:</strong><br/>${escapeHtml(message)}</p>` : ''}
        <p>Тикет #${ticket.id}. ${siteUrl ? `<a href="${siteUrl}/portal/manager/tickets">Открыть в портале</a>` : ''}</p>
      `;
      await sendEmail(notifyEmail, `Поддержка: новое обращение — ${subject.slice(0, 50)}`, htmlNotify);
    } catch (e) {
      console.error('Ticket: notify manager', e);
    }
  }

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
            const htmlReply = `
              <p>Здравствуйте, ${escapeHtml(displayName)}!</p>
              <p>По вашему обращению «${escapeHtml(subject)}» подготовлен ответ.</p>
              <p><strong>Ответ:</strong></p>
              <p>${escapeHtml(autoReply).replace(/\n/g, '<br/>')}</p>
              ${ticketUrl ? `<p><a href="${escapeHtml(ticketUrl)}">Открыть обращение</a></p>` : ''}
              <p>— ${settings.portal_title || 'AVATERRA'}</p>
            `;
            await sendEmail(user.email, `Ответ по обращению: ${subject.slice(0, 50)}`, htmlReply);
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
