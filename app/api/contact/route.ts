import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const notifyEmail = process.env.RESEND_NOTIFY_EMAIL || process.env.RESEND_FROM;

export async function POST(request: NextRequest) {
  try {
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

    const supabase = createClient();
    if (supabase) {
      try {
        await supabase.from('leads').insert({
          name: String(name).slice(0, 200),
          phone: String(phone).slice(0, 50),
          email: email ? String(email).slice(0, 200) : null,
          message: message ? String(message).slice(0, 2000) : null,
        });
      } catch (dbErr) {
        console.error('Lead insert:', dbErr);
      }
    }

    if (resend && notifyEmail) {
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM || 'onboarding@resend.dev',
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
