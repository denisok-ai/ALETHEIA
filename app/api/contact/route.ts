import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSystemSettings } from '@/lib/settings';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendTransactionalEmail } from '@/lib/email-service';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';
import {
  buildContactConfirmationEmail,
  buildContactNotificationEmail,
} from '@/lib/email-templates';

export async function POST(request: NextRequest) {
  const rateLimitRes = checkRateLimit(request, 'contact', 5);
  if (rateLimitRes) return rateLimitRes;

  try {
    const settings = await getSystemSettings();
    const fromEmail = settings.resend_from || 'onboarding@resend.dev';
    const notifyEmail = settings.resend_notify_email || settings.resend_from;
    const body = await request.json();
    const { name, phone, email, message, website } = body;
    // Защита от спама: honeypot-поле должно быть пустым
    if (website && String(website).trim() !== '') {
      return NextResponse.json({ error: 'Ошибка отправки' }, { status: 400 });
    }
    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Укажите имя и телефон' },
        { status: 400 }
      );
    }
    const phoneDigits = String(phone).replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return NextResponse.json(
        { error: 'Укажите корректный номер телефона' },
        { status: 400 }
      );
    }

    let leadId: string | null = null;
    try {
      const lead = await prisma.lead.create({
        data: {
          name: String(name).slice(0, 200),
          phone: String(phone).slice(0, 50),
          email: email ? String(email).slice(0, 200) : null,
          message: message ? String(message).slice(0, 2000) : null,
        },
      });
      leadId = String(lead.id);
    } catch (dbErr) {
      console.error('Lead insert:', dbErr);
    }

    if (notifyEmail) {
      const emailTemplate = buildContactNotificationEmail({
        name: String(name).slice(0, 200),
        phone: String(phone).slice(0, 50),
        email: email ? String(email).slice(0, 200) : null,
        message: message ? String(message).slice(0, 2000) : null,
      });
      const notifyResult = await sendTransactionalEmail({
        from: fromEmail,
        to: notifyEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        context: { module: 'contact', entityId: leadId },
      });
      if (!notifyResult.ok) {
        console.error('Contact notify email failed:', notifyResult.error);
      }
    }

    notifyAdminsTelegramAsync('contact_lead', [
      `Имя: ${String(name).slice(0, 200)}`,
      `Телефон: ${String(phone).slice(0, 50)}`,
      ...(email ? [`Email: ${String(email).slice(0, 200)}`] : []),
      ...(message ? [`Сообщение: ${String(message).slice(0, 500)}`] : []),
    ]);

    // Письмо клиенту «Заявка принята» (если указан email)
    const clientEmail = email ? String(email).trim() : '';
    if (clientEmail && /@/.test(clientEmail)) {
      const emailTemplate = buildContactConfirmationEmail({
        name: String(name).slice(0, 100),
        systemTitle: settings.portal_title || 'AVATERRA',
      });
      const clientResult = await sendTransactionalEmail({
        from: fromEmail,
        to: clientEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        context: { module: 'contact', entityId: leadId },
      });
      if (!clientResult.ok) {
        console.error('Contact client confirm email failed:', clientResult.error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact API error:', error);
    return NextResponse.json(
      { error: 'Ошибка отправки' },
      { status: 500 }
    );
  }
}
