/**
 * Admin: превью шаблонов писем об оплате (тестовые данные) и отправка теста на email notify.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getSystemSettings, getPaymentEmailTemplates, renderPaymentEmailTemplate } from '@/lib/settings';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { kind?: string; send?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const kind = body.kind === 'generic' ? 'generic' : 'course';
  const doSend = body.send === true;

  const [settings, tpl] = await Promise.all([getSystemSettings(), getPaymentEmailTemplates()]);
  const siteUrl = settings.site_url?.replace(/\/$/, '') || '';
  const portalTitle = settings.portal_title || 'AVATERRA';
  const loginUrl = siteUrl ? `${siteUrl}/login` : '/login';
  const successUrl = siteUrl ? `${siteUrl}/success` : '/success';
  const vars = {
    orderid: 'ALT-DEMO12345',
    courseTitle: 'Демо-курс «Тело не врёт»',
    userName: 'Иван',
    orderAmount: '25 000 ₽',
    loginUrl,
    successUrl,
    portal_title: portalTitle,
    portalUrl: siteUrl || 'https://example.com',
    ofertaUrl: siteUrl ? `${siteUrl}/oferta` : '/oferta',
    supportEmail: settings.resend_notify_email?.trim() || 'support@example.com',
    company_address: settings.company_legal_address?.trim() || '—',
  };

  if (kind === 'generic') {
    const subject = renderPaymentEmailTemplate(tpl.genericSubject, vars);
    const html = renderPaymentEmailTemplate(tpl.genericBody, vars);
    if (!doSend) {
      return NextResponse.json({ subject, html, kind: 'generic' });
    }
    const to = settings.resend_notify_email?.trim();
    if (!to) {
      return NextResponse.json({ error: 'Заполните email уведомлений (resend_notify_email)' }, { status: 400 });
    }
    const ok = await sendEmail(to, `[Тест] ${subject}`, html);
    if (!ok) return NextResponse.json({ error: 'Не удалось отправить (проверьте Resend API ключ)' }, { status: 502 });
    return NextResponse.json({ ok: true, sentTo: to, kind: 'generic' });
  }

  const subject = renderPaymentEmailTemplate(tpl.courseSubject, vars);
  const html = renderPaymentEmailTemplate(tpl.courseBody, vars);
  if (!doSend) {
    return NextResponse.json({ subject, html, kind: 'course' });
  }
  const to = settings.resend_notify_email?.trim();
  if (!to) {
    return NextResponse.json({ error: 'Заполните email уведомлений (resend_notify_email)' }, { status: 400 });
  }
  const ok = await sendEmail(to, `[Тест] ${subject}`, html);
  if (!ok) return NextResponse.json({ error: 'Не удалось отправить (проверьте Resend API ключ)' }, { status: 502 });
  return NextResponse.json({ ok: true, sentTo: to, kind: 'course' });
}
