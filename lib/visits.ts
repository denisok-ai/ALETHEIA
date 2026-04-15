/**
 * Трекинг посещений и сессий (VisitLog): создание/обновление, закрытие при выходе.
 * Используется модулем «Мониторинг» и API ping.
 */
import type { NextRequest } from 'next/server';
import { prisma } from './db';

/** Таймаут «онлайн» в минутах: сессия активна, если lastActivityAt в пределах этого интервала. */
export const ONLINE_TIMEOUT_MINUTES = 15;

export interface ClientInfo {
  ipAddress: string | null;
  userAgent: string | null;
}

/** Извлечь IP и User-Agent из запроса (учёт прокси). */
export function getClientInfo(req: NextRequest | Request): ClientInfo {
  const headers = req.headers;
  const forwarded = headers.get('x-forwarded-for');
  const ip =
    (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : null) ||
    headers.get('x-real-ip') ||
    (req as NextRequest & { socket?: { remoteAddress?: string } }).socket?.remoteAddress ||
    null;
  const userAgent = headers.get('user-agent') || null;
  return { ipAddress: ip, userAgent };
}

/**
 * Создать новую запись посещения или обновить lastActivityAt у текущей открытой сессии.
 * Оптимизировано: один updateMany вместо findFirst + update (меньше нагрузка при 300+ пользователях).
 */
export async function recordVisitOrUpdate(
  userId: string,
  client: ClientInfo
): Promise<void> {
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) return;

  const now = new Date();
  const updated = await prisma.visitLog.updateMany({
    where: { userId, logoutAt: null },
    data: {
      lastActivityAt: now,
      ipAddress: client.ipAddress ?? undefined,
      userAgent: client.userAgent ?? undefined,
    },
  });
  if (updated.count > 0) return;
  try {
    await prisma.visitLog.create({
      data: {
        userId,
        loginAt: now,
        lastActivityAt: now,
        ipAddress: client.ipAddress ?? undefined,
        userAgent: client.userAgent ?? undefined,
      },
    });
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code?: string }).code : '';
    if (code === 'P2003') return;
    throw e;
  }
}

/**
 * Закрыть текущую открытую сессию пользователя (установить logoutAt).
 * Вызывается из NextAuth events.signOut.
 */
export async function closeVisit(userId: string): Promise<void> {
  const open = await prisma.visitLog.findFirst({
    where: { userId, logoutAt: null },
    orderBy: { loginAt: 'desc' },
  });
  if (open) {
    await prisma.visitLog.update({
      where: { id: open.id },
      data: { logoutAt: new Date() },
    });
  }
}
