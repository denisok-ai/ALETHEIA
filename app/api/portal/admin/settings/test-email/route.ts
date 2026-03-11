/**
 * Admin: отправить тестовое письмо на адрес получателя уведомлений (проверка Resend).
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getSystemSettings } from '@/lib/settings';
import { sendEmail } from '@/lib/email';

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

  const ok = await sendEmail(
    to.trim(),
    'AVATERRA: тестовое письмо из настроек',
    '<p>Это тестовое письмо отправлено из раздела Настройки для проверки подключения Resend.</p><p>Если вы получили его — почта настроена корректно.</p>',
    { from: settings.resend_from || undefined }
  );

  if (!ok) {
    return NextResponse.json(
      { error: 'Не удалось отправить письмо. Проверьте Resend API ключ (Переменные окружения) и настройки отправителя.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, sentTo: to.trim() });
}
