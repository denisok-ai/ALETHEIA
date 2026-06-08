/**
 * Admin: отправить один email по шаблону на тестовый адрес (журнал isTest=true).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { renderTemplate, sendEmailWithResult } from '@/lib/email';
import { wrapEmailHtml } from '@/lib/email-templates';
import { getSystemSettings } from '@/lib/settings';
import { commsSendTestSchema } from '@/lib/validations/comms';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = commsSendTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const template = await prisma.commsTemplate.findUnique({
    where: { id: parsed.data.templateId },
  });
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  if (template.channel !== 'email') {
    return NextResponse.json(
      { error: 'Тестовая отправка доступна только для шаблонов с каналом email' },
      { status: 400 }
    );
  }

  const settings = await getSystemSettings();
  const subject = template.subject ?? 'Без темы';
  const htmlBody = template.htmlBody ?? '';
  const testEmail = parsed.data.testEmail.trim();
  const renderedHtml = renderTemplate(htmlBody, {
    name: 'Тестовый получатель',
    email: testEmail,
    displayName: 'Тестовый получатель',
    userId: 'test',
  });
  const wrappedHtml = wrapEmailHtml(renderedHtml, { title: subject });
  const mailSubject = `[Тест] ${subject}`;

  const r = await sendEmailWithResult(testEmail, mailSubject, wrappedHtml, {
    from: settings.resend_from || undefined,
  });

  await prisma.commsSend.create({
    data: {
      templateId: template.id,
      channel: 'email',
      recipient: testEmail,
      subject: mailSubject,
      status: r.ok ? 'sent' : 'failed',
      errorMessage: r.ok ? null : r.error,
      sentBy: auth.userId,
      isTest: true,
    },
  });

  if (!r.ok) {
    return NextResponse.json({ error: r.error ?? 'Ошибка отправки' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, message: `Отправлено на ${testEmail}` });
}
