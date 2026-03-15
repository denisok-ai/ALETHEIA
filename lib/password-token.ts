/**
 * Одноразовые токены для установки/сброса пароля (конвертация лида, восстановление).
 */
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/db';

const TOKEN_TTL_HOURS = 48;

export async function createPasswordToken(userId: string): Promise<string> {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);
  await prisma.passwordToken.create({
    data: { userId, token, expiresAt },
  });
  return token;
}

/**
 * Проверяет токен, возвращает userId или null. Токен не удаляется (удаление при успешной смене пароля).
 */
export async function getUserIdByPasswordToken(token: string): Promise<string | null> {
  if (!token?.trim()) return null;
  const record = await prisma.passwordToken.findUnique({
    where: { token: token.trim() },
    select: { userId: true, expiresAt: true },
  });
  if (!record || record.expiresAt < new Date()) return null;
  return record.userId;
}

/**
 * Удаляет токен после успешной установки пароля (одноразовое использование).
 */
export async function consumePasswordToken(token: string): Promise<boolean> {
  if (!token?.trim()) return false;
  const result = await prisma.passwordToken.deleteMany({
    where: { token: token.trim() },
  });
  return result.count > 0;
}
