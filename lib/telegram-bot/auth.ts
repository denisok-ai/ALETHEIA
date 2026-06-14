/**
 * Авторизация админов и привязка Telegram к пользователю портала.
 */
import { randomUUID } from 'crypto';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getTelegramAdminChatIds, parseTelegramChatIds } from '@/lib/telegram-admin-notify';

export const ADMIN_CHAT_IDS_KEY = 'telegram_admin_chat_ids';

export async function isAdminChatId(chatId: number | string): Promise<boolean> {
  const ids = await getTelegramAdminChatIds();
  return ids.includes(String(chatId));
}

/** Админ: chat ID в списке оповещений или роль admin/manager в профиле по telegramId. */
export async function isTelegramAdmin(chatId: number, telegramUserId?: number): Promise<boolean> {
  if (await isAdminChatId(chatId)) return true;
  if (!telegramUserId) return false;
  const profile = await prisma.profile.findFirst({
    where: { telegramId: telegramUserId, role: { in: ['admin', 'manager'] }, status: 'active' },
    select: { id: true },
  });
  return Boolean(profile);
}

export async function appendAdminChatId(chatId: number): Promise<boolean> {
  const idStr = String(chatId);
  const row = await prisma.systemSetting.findUnique({ where: { key: ADMIN_CHAT_IDS_KEY } });
  const existing = parseTelegramChatIds(row?.value);
  if (existing.includes(idStr)) return false;
  const next = [...existing, idStr].join(',');
  await prisma.systemSetting.upsert({
    where: { key: ADMIN_CHAT_IDS_KEY },
    create: { key: ADMIN_CHAT_IDS_KEY, value: next, category: 'env' },
    update: { value: next },
  });
  return true;
}

export type LinkedPortalUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
};

/** Пользователь портала по telegram user id (Profile.telegramId). */
export async function findUserByTelegramId(telegramUserId: number): Promise<LinkedPortalUser | null> {
  const profile = await prisma.profile.findFirst({
    where: { telegramId: telegramUserId, status: 'active' },
    select: {
      role: true,
      displayName: true,
      user: { select: { id: true, email: true } },
    },
  });
  if (!profile?.user) return null;
  return {
    id: profile.user.id,
    email: profile.user.email,
    displayName: profile.displayName,
    role: profile.role,
  };
}

/** Привязать telegram user id к профилю по email (опционально, для /link). */
export async function linkTelegramToUser(email: string, telegramUserId: number): Promise<{ ok: boolean; message: string }> {
  const emailNorm = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: emailNorm },
    select: { id: true, profile: { select: { id: true, telegramId: true } } },
  });
  if (!user?.profile) {
    return { ok: false, message: 'Пользователь с таким email не найден.' };
  }
  const taken = await prisma.profile.findFirst({
    where: { telegramId: telegramUserId, userId: { not: user.id } },
    select: { id: true },
  });
  if (taken) {
    return { ok: false, message: 'Этот Telegram уже привязан к другому аккаунту.' };
  }
  await prisma.profile.update({
    where: { id: user.profile.id },
    data: { telegramId: telegramUserId },
  });
  return { ok: true, message: `Telegram привязан к ${emailNorm}.` };
}

const GUEST_USER_EMAIL = 'telegram-guest@internal.avaterra';

/** Системный пользователь для гостевых тикетов из Telegram (без привязки к порталу). */
export async function getOrCreateTelegramGuestUser(): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email: GUEST_USER_EMAIL },
    select: { id: true },
  });
  if (existing) return existing.id;

  try {
    const passwordHash = await hash(randomUUID(), 10);
    const user = await prisma.user.create({
      data: {
        email: GUEST_USER_EMAIL,
        passwordHash,
        profile: {
          create: {
            id: 'p-telegram-guest-internal',
            role: 'user',
            status: 'active',
            displayName: 'Telegram (гость)',
            email: GUEST_USER_EMAIL,
          },
        },
      },
      select: { id: true },
    });
    return user.id;
  } catch {
    const again = await prisma.user.findUnique({
      where: { email: GUEST_USER_EMAIL },
      select: { id: true },
    });
    if (again) return again.id;
    throw new Error('Не удалось создать гостевого пользователя Telegram');
  }
}
