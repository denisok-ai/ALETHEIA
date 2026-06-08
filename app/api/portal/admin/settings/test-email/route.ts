/**
 * Admin: отправить тестовое письмо на адрес получателя уведомлений (проверка Resend/SMTP).
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getSystemSettings } from '@/lib/settings';
import { sendTransactionalEmail } from '@/lib/email-service';
import { buildSettingsTestEmail } from '@/lib/email-templates';

export async function POST() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const settings = await getSystemSettings();
  const to = settings.resend_notify_email || settings.resend_from;
  if (!to?.trim()) {
    return NextResponse.json(
      { error: 'Не задан email получателя уведомлений (Почта → Email получателя)' },
      { status: 400 }
    );
  }

  const emailTemplate = buildSettingsTestEmail({
    systemTitle: settings.portal_title || 'AVATERRA',
  });
  const result = await sendTransactionalEmail({
    to: to.trim(),
    subject: emailTemplate.subject,
    html: emailTemplate.html,
    from: settings.resend_from || undefined,
    context: { module: 'settings', sentBy: auth.userId },
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.error ||
          'Не удалось отправить письмо. Проверьте транспорт почты (Resend/SMTP), ключи и адрес отправителя в разделе «Исходящая почта».',
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, sentTo: to.trim() });
}
