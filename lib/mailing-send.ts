/**
 * Общая логика отправки рассылки: построение списка адресатов, исключение отписавшихся, отправка писем.
 * Используется ручной отправкой (POST .../send) и планировщиком (cron).
 */
import path from 'path';
import { readFile } from 'fs/promises';
import { prisma } from './db';
import { sendEmail, type EmailAttachment } from './email';
import { wrapEmailHtml, renderMailingTemplate } from './email-templates';
import { getSystemSettings } from './settings';
import { writeAuditLog } from './audit';

function splitName(displayName: string | null): { firstName: string; lastName: string } {
  if (!displayName?.trim()) return { firstName: '', lastName: '' };
  const parts = displayName.trim().split(/\s+/);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') ?? '' };
}

export interface RunMailingSendResult {
  sent: number;
  failed: number;
  total: number;
}

/**
 * Выполнить отправку рассылки по id. Рассылка должна быть в статусе planned.
 * Возвращает результат или null, если рассылка не найдена / не в статусе planned.
 */
export async function runMailingSend(
  mailingId: string,
  actorId: string
): Promise<RunMailingSendResult | null> {
  const mailing = await prisma.mailing.findUnique({ where: { id: mailingId } });
  if (!mailing || mailing.status !== 'planned') return null;

  type RecipientConfigParsed = {
    type: string;
    role?: string;
    userIds?: string[];
    groupIds?: string[];
    excludeGroupIds?: string[];
  };
  let recipientConfig: RecipientConfigParsed = { type: 'all' };
  if (mailing.recipientConfig) {
    try {
      recipientConfig = JSON.parse(mailing.recipientConfig) as RecipientConfigParsed;
    } catch {
      // keep all
    }
  }

  const whereProfile: { status: string; role?: string } = { status: 'active' };
  if (recipientConfig.type === 'role' && recipientConfig.role) {
    whereProfile.role = recipientConfig.role;
  }

  let profiles: { userId: string; email: string | null; displayName: string | null }[];

  if (recipientConfig.type === 'groups' && Array.isArray(recipientConfig.groupIds) && recipientConfig.groupIds.length > 0) {
    const ug = await prisma.userGroup.findMany({
      where: { groupId: { in: recipientConfig.groupIds } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const userIds = ug.map((x) => x.userId);
    if (userIds.length === 0) {
      profiles = [];
    } else {
      const list = await prisma.profile.findMany({
        where: { userId: { in: userIds }, status: 'active' },
        include: { user: { select: { email: true } } },
      });
      profiles = list.map((p) => ({
        userId: p.userId,
        email: p.email ?? p.user.email ?? null,
        displayName: p.displayName,
      }));
    }
  } else if (recipientConfig.type === 'list' && Array.isArray(recipientConfig.userIds) && recipientConfig.userIds.length > 0) {
    const list = await prisma.profile.findMany({
      where: { userId: { in: recipientConfig.userIds } },
      include: { user: { select: { email: true } } },
    });
    profiles = list.map((p) => ({
      userId: p.userId,
      email: p.email ?? p.user.email ?? null,
      displayName: p.displayName,
    }));
  } else {
    const list = await prisma.profile.findMany({
      where: whereProfile,
      include: { user: { select: { email: true } } },
    });
    profiles = list.map((p) => ({
      userId: p.userId,
      email: p.email ?? p.user.email ?? null,
      displayName: p.displayName,
    }));
  }

  if (Array.isArray(recipientConfig.excludeGroupIds) && recipientConfig.excludeGroupIds.length > 0) {
    const excludeUg = await prisma.userGroup.findMany({
      where: { groupId: { in: recipientConfig.excludeGroupIds } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const excludeSet = new Set(excludeUg.map((x) => x.userId));
    profiles = profiles.filter((p) => !excludeSet.has(p.userId));
  }

  const unsubscribed = await prisma.mailingUnsubscribe.findMany({ select: { email: true } });
  const unsubSet = new Set(unsubscribed.map((u) => u.email.toLowerCase()));
  profiles = profiles.filter((p) => {
    const e = p.email?.trim().toLowerCase();
    return e && !unsubSet.has(e);
  });

  const settings = await getSystemSettings();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const unsubscribeUrl = `${baseUrl}/unsubscribe`;

  await prisma.mailing.update({
    where: { id: mailingId },
    data: { status: 'processing', startedAt: new Date() },
  });

  let emailAttachments: EmailAttachment[] = [];
  if (mailing.attachments) {
    try {
      const list = JSON.parse(mailing.attachments) as { name: string; pathOrKey: string }[];
      if (Array.isArray(list)) {
        const uploadsDir = path.join(process.cwd(), 'uploads');
        for (const a of list) {
          if (a?.pathOrKey && a?.name) {
            try {
              const buf = await readFile(path.join(uploadsDir, a.pathOrKey));
              emailAttachments.push({ filename: a.name, content: buf });
            } catch {
              // файл не найден — пропускаем
            }
          }
        }
      }
    } catch {
      // неверный JSON
    }
  }

  let sent = 0;
  let failed = 0;

  for (const p of profiles) {
    const email = p.email?.trim() || null;
    if (!email) {
      await prisma.mailingLog.create({
        data: {
          mailingId,
          userId: p.userId,
          recipientEmail: '',
          recipientName: p.displayName,
          status: 'failed',
          errorMessage: 'Не указан e-mail',
        },
      });
      failed++;
      continue;
    }

    const { firstName, lastName } = splitName(p.displayName);
    const { subject, body } = renderMailingTemplate(
      mailing.emailSubject,
      mailing.emailBody,
      {
        FirstName: firstName,
        LastName: lastName,
        date: new Date().toLocaleDateString('ru'),
        unsubscribe: unsubscribeUrl,
        systemtitle: 'AVATERRA',
      }
    );

    const html = wrapEmailHtml(body, { title: subject });
    const ok = await sendEmail(email, subject, html, {
      from: mailing.senderEmail || settings?.resend_from || undefined,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
    });

    if (ok) {
      await prisma.mailingLog.create({
        data: {
          mailingId,
          userId: p.userId,
          recipientEmail: email,
          recipientName: p.displayName,
          status: 'sent',
          sentAt: new Date(),
        },
      });
      sent++;
    } else {
      await prisma.mailingLog.create({
        data: {
          mailingId,
          userId: p.userId,
          recipientEmail: email,
          recipientName: p.displayName,
          status: 'failed',
          errorMessage: 'Ошибка отправки (SMTP/Resend)',
        },
      });
      failed++;
    }
  }

  await prisma.mailing.update({
    where: { id: mailingId },
    data: { status: 'completed', completedAt: new Date() },
  });

  await writeAuditLog({
    actorId,
    action: 'mailing.send',
    entity: 'Mailing',
    entityId: mailingId,
    diff: { sent, failed, internalTitle: mailing.internalTitle },
  });

  return { sent, failed, total: sent + failed };
}
