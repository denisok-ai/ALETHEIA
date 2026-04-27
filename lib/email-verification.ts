/**
 * Токены верификации email (48 ч).
 */
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/db';

const TOKEN_TTL_HOURS = 48;

export async function createEmailVerificationToken(userId: string): Promise<string> {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);
  await prisma.emailVerificationToken.create({
    data: { userId, token, expiresAt },
  });
  return token;
}

export async function getUserIdByEmailVerificationToken(token: string): Promise<string | null> {
  if (!token?.trim()) return null;
  const record = await prisma.emailVerificationToken.findUnique({
    where: { token: token.trim() },
    select: { userId: true, expiresAt: true },
  });
  if (!record || record.expiresAt < new Date()) return null;
  return record.userId;
}

export async function consumeEmailVerificationToken(token: string): Promise<boolean> {
  if (!token?.trim()) return false;
  const result = await prisma.emailVerificationToken.deleteMany({
    where: { token: token.trim() },
  });
  return result.count > 0;
}
