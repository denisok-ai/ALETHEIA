/**
 * Контакт, оставленный в чате на сайте.
 *
 * До этого разговор в виджете нигде не оседал: человек спрашивал, получал
 * ответ и уходил без следа в CRM. Теперь он может оставить телефон или почту
 * прямо в чате — карточка лида создаётся сразу, вместе с его вопросом.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function classifyContact(raw: string): { phone?: string; email?: string } | null {
  const value = raw.trim();
  if (!value || value.length > 200) return null;
  if (EMAIL_RE.test(value)) return { email: value.toLowerCase() };
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 15) return { phone: value.slice(0, 50) };
  return null;
}

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(request, 'contact', 5);
  if (limited) return limited;

  let body: { contact?: unknown; question?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
  }

  const contact = classifyContact(String(body.contact ?? ''));
  if (!contact) {
    return NextResponse.json(
      { error: 'Укажите телефон или e-mail — так специалист сможет ответить' },
      { status: 400 }
    );
  }

  const question = String(body.question ?? '').slice(0, 1000);
  const name = String(body.name ?? '').trim().slice(0, 200);

  let leadId: number | null = null;
  try {
    // Тот же контакт из того же чата не должен плодить карточки.
    const existing = await prisma.lead.findFirst({
      where: contact.email ? { email: contact.email, source: 'web_chat' } : { phone: contact.phone, source: 'web_chat' },
      orderBy: { createdAt: 'desc' },
    });

    const message = [
      'Контакт оставлен в чате на сайте.',
      ...(question ? [`Вопрос: ${question}`] : []),
    ].join('\n');

    if (existing) {
      await prisma.lead.update({
        where: { id: existing.id },
        data: { message: `${message}\n\n— ранее —\n${existing.message ?? ''}`.slice(0, 2000) },
      });
      leadId = existing.id;
    } else {
      const lead = await prisma.lead.create({
        data: {
          name: name || 'Гость чата',
          // Поле телефона обязательное: если оставили почту, помечаем это явно.
          phone: contact.phone ?? 'нет (только e-mail)',
          email: contact.email ?? null,
          message,
          status: 'new',
          source: 'web_chat',
          entrySource: 'chat',
        },
      });
      leadId = lead.id;
    }
  } catch (e) {
    console.error('[chat-lead] запись лида:', e);
    return NextResponse.json({ error: 'Не удалось сохранить контакт' }, { status: 500 });
  }

  notifyAdminsTelegramAsync('contact_lead', [
    'Контакт из чата на сайте.',
    ...(name ? [`Имя: ${name}`] : []),
    ...(contact.phone ? [`Телефон: ${contact.phone}`] : []),
    ...(contact.email ? [`E-mail: ${contact.email}`] : []),
    ...(question ? [`Вопрос: ${question.slice(0, 300)}`] : []),
    ...(leadId ? [`CRM: лид ${leadId}`] : []),
  ]);

  return NextResponse.json({ ok: true });
}
