/**
 * POST: установка пароля по одноразовому токену (после конвертации лида или сброс пароля).
 * Body: { token, password }. Токен после использования удаляется.
 */
import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getUserIdByPasswordToken, consumePasswordToken } from '@/lib/password-token';
import { checkRateLimit } from '@/lib/rate-limit';
import { setPasswordSchema } from '@/lib/validations/auth';

export async function POST(request: NextRequest) {
  const rateLimitRes = checkRateLimit(request, 'set-password', 5);
  if (rateLimitRes) return rateLimitRes;
  try {
    const body = await request.json();
    const parsed = setPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Укажите токен и новый пароль';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { token, password } = parsed.data;

    const userId = await getUserIdByPasswordToken(token);
    if (!userId) {
      return NextResponse.json(
        { error: 'Ссылка недействительна или истекла. Запросите новую.' },
        { status: 400 }
      );
    }

    const passwordHash = await hash(password, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await consumePasswordToken(token);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Set password error:', e);
    return NextResponse.json(
      { error: 'Ошибка установки пароля' },
      { status: 500 }
    );
  }
}
