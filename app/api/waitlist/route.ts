/**
 * Лист ожидания личной работы с мастером (Татьяна Стрельцова).
 *
 * Пишет лид с source = `waitlist_master` — той же моделью Lead, что и остальные
 * формы сайта. Обязательств по записи не даём: это только запись в очередь.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';
import { acqRefFromRequest } from '@/lib/social/ref-tracking';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WAITLIST_SOURCE = 'waitlist_master';

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

  let body: { name?: unknown; contact?: unknown; question?: unknown; website?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
  }

  // Honeypot: скрытое поле должно остаться пустым
  if (body.website && String(body.website).trim() !== '') {
    return NextResponse.json({ error: 'Ошибка отправки' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim().slice(0, 200);
  if (!name) {
    return NextResponse.json({ error: 'Укажите имя' }, { status: 400 });
  }
  const contact = classifyContact(String(body.contact ?? ''));
  if (!contact) {
    return NextResponse.json(
      { error: 'Укажите телефон или e-mail — так мы свяжемся, когда откроется запись' },
      { status: 400 }
    );
  }
  const question = String(body.question ?? '').trim().slice(0, 1000);

  try {
    await prisma.lead.create({
      data: {
        name,
        // Поле телефона обязательное: если оставили только почту, помечаем это явно.
        phone: contact.phone ?? 'нет (только e-mail)',
        email: contact.email ?? null,
        message: ['Лист ожидания: личная работа с мастером.', ...(question ? [`Запрос: ${question}`] : [])].join('\n'),
        status: 'new',
        source: WAITLIST_SOURCE,
        acqRef: acqRefFromRequest(request),
      },
    });
  } catch (e) {
    console.error('[waitlist] запись лида:', e);
    return NextResponse.json({ error: 'Не удалось сохранить заявку' }, { status: 500 });
  }

  notifyAdminsTelegramAsync('contact_lead', [
    'Лист ожидания: личная работа с мастером.',
    `Имя: ${name}`,
    ...(contact.phone ? [`Телефон: ${contact.phone}`] : []),
    ...(contact.email ? [`E-mail: ${contact.email}`] : []),
    ...(question ? [`Запрос: ${question.slice(0, 300)}`] : []),
  ]);

  return NextResponse.json({ ok: true });
}
