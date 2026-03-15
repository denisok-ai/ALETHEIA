import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/db';
import { getSystemSettings, getEnvOverrides } from '@/lib/settings';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const rateLimitRes = checkRateLimit(request, 'contact', 5);
  if (rateLimitRes) return rateLimitRes;

  try {
    const settings = await getSystemSettings();
    const fromEmail = settings.resend_from || process.env.RESEND_FROM || 'onboarding@resend.dev';
    const notifyEmail = settings.resend_notify_email || settings.resend_from || process.env.RESEND_NOTIFY_EMAIL || process.env.RESEND_FROM;
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

    try {
      await prisma.lead.create({
        data: {
          name: String(name).slice(0, 200),
          phone: String(phone).slice(0, 50),
          email: email ? String(email).slice(0, 200) : null,
          message: message ? String(message).slice(0, 2000) : null,
        },
      });
    } catch (dbErr) {
      console.error('Lead insert:', dbErr);
    }

    const overrides = await getEnvOverrides();
    const apiKey = overrides.resend_api_key || process.env.RESEND_API_KEY;
    if (apiKey) {
      const resend = new Resend(apiKey);
      if (notifyEmail) {
        try {
          await resend.emails.send({
            from: fromEmail,
            to: notifyEmail,
            subject: `AVATERRA: новая заявка от ${String(name).slice(0, 50)}`,
            html: [
              `<p><strong>Имя:</strong> ${escapeHtml(name)}</p>`,
              `<p><strong>Телефон:</strong> ${escapeHtml(phone)}</p>`,
              email ? `<p><strong>Email:</strong> ${escapeHtml(email)}</p>` : '',
              message ? `<p><strong>Сообщение:</strong><br/>${escapeHtml(message)}</p>` : '',
            ].join(''),
          });
        } catch (mailErr) {
          console.error('Resend notify:', mailErr);
        }
      }
      // Письмо клиенту «Заявка принята» (если указан email)
      const clientEmail = email ? String(email).trim() : '';
      if (clientEmail && /@/.test(clientEmail)) {
        try {
          await resend.emails.send({
            from: fromEmail,
            to: clientEmail,
            subject: 'AVATERRA: заявка принята',
            html: [
              `<p>Здравствуйте, ${escapeHtml(String(name).slice(0, 100))}!</p>`,
              '<p>Мы получили вашу заявку и свяжемся с вами в ближайшее время.</p>',
              '<p>Если у вас есть вопросы, вы можете написать нам или ознакомиться с форматами работы на сайте.</p>',
              '<p>— Школа AVATERRA</p>',
            ].join(''),
          });
        } catch (clientMailErr) {
          console.error('Resend client confirm:', clientMailErr);
        }
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
