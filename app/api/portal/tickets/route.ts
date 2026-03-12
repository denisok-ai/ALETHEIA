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

  let body: { subject?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!subject) {
    return NextResponse.json({ error: 'Укажите тему обращения' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: { select: { displayName: true } } },
  });
  const settings = await getSystemSettings();
  const siteUrl = settings.site_url?.replace(/\/$/, '') || '';
  const displayName = user?.profile?.displayName ?? user?.displayName ?? user?.email ?? 'Клиент';

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

  return NextResponse.json({
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      created_at: ticket.createdAt.toISOString(),
    },
  });
}
