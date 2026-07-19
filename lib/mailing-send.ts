/**
 * Общая логика отправки рассылки: построение списка адресатов, исключение отписавшихся, отправка писем.
 * Используется ручной отправкой (POST .../send) и планировщиком (cron).
 */
import path from 'path';
import { readFile } from 'fs/promises';
import { prisma } from './db';
import type { EmailAttachment } from './email';
import { sendTransactionalEmail } from './email-service';
import { wrapEmailHtml, renderMailingTemplate, emailPreheaderFromHtmlFragment } from './email-templates';

/** Пауза между письмами (мс), чтобы снизить риск лимитов SMTP/провайдера при больших списках. */
const MAILING_SEND_GAP_MS = 80;
import { getSystemSettings } from './settings';
import { writeAuditLog } from './audit';
import { notifyAdminsTelegramAsync } from './telegram-admin-notify';

function splitName(displayName: string | null): { firstName: string; lastName: string } {
  const raw = displayName?.trim() ?? '';
  if (!raw || /@/.test(raw)) return { firstName: '', lastName: '' };
  const parts = raw.split(/\s+/);
  if (parts.length === 1 && /^[a-z0-9_.+-]+$/i.test(parts[0]!)) {
    return { firstName: '', lastName: '' };
  }
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

  // Атомарный захват рассылки. Раньше проверка статуса стояла здесь, а перевод
  // в `processing` — почти сотней строк ниже, после сбора получателей, групп и
  // отписок. За эти секунды cron (каждые 5 мин) и кнопка «Отправить» в админке
  // успевали пройти проверку оба, и каждый адресат получал письмо дважды.
  // Условие внутри updateMany делает захват неделимым: второй вызов получит
  // count === 0 и выйдет.
  const claimed = await prisma.mailing.updateMany({
    where: { id: mailingId, status: 'planned' },
    data: { status: 'processing', startedAt: new Date() },
  });
  if (claimed.count === 0) {
    console.warn(`[mailing] ${mailingId}: рассылку уже обрабатывает другой запуск — дубль пропущен`);
    return null;
  }

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
  const baseUrl = settings.site_url?.replace(/\/$/, '') || 'http://localhost:3000';
  const unsubscribeUrl = `${baseUrl}/unsubscribe`;
  const loginUrl = `${baseUrl}/login`;

  // Статус уже выставлен атомарным захватом в начале функции.

  let emailAttachments: EmailAttachment[] = [];
  // Нечитаемое вложение — причина остановиться, а не пропустить. Раньше файл
  // молча выпадал: подписчики получали письмо без обещанной методички или
  // договора, в журнале стояло «отправлено», и об этом не узнавал никто.
  // Проверяем до первой отправки — тогда рассылку можно починить и запустить
  // заново, ничего не разослав наполовину.
  const missingAttachments: string[] = [];
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
              missingAttachments.push(a.name);
            }
          }
        }
      }
    } catch {
      missingAttachments.push('(список вложений повреждён)');
    }
  }

  if (missingAttachments.length > 0) {
    const msg = `Рассылка не отправлена: не читаются вложения — ${missingAttachments.join(', ')}.`;
    console.error(`[mailing] ${mailingId}: ${msg}`);
    await prisma.mailing.update({
      where: { id: mailingId },
      data: { status: 'planned', startedAt: null },
    });
    notifyAdminsTelegramAsync('contact_lead', [
      msg,
      `Рассылка: ${mailing.internalTitle || mailingId}`,
      'Статус возвращён в «запланирована» — исправьте вложение и запустите снова.',
    ]);
    return null;
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
        systemtitle: settings.portal_title?.trim() || 'AVATERRA',
        portalUrl: baseUrl,
        loginUrl,
      }
    );

    const preheader = emailPreheaderFromHtmlFragment(body);
    const html = wrapEmailHtml(body, {
      title: subject,
      ...(preheader ? { preheader } : {}),
    });
    const result = await sendTransactionalEmail({
      to: email,
      subject,
      html,
      from: mailing.senderEmail || settings?.resend_from || undefined,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
      context: { module: 'mailings', entityId: mailingId, userId: p.userId },
    });

    if (result.ok) {
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
          errorMessage: result.error,
        },
      });
      failed++;
    }

    if (MAILING_SEND_GAP_MS > 0) {
      await new Promise((r) => setTimeout(r, MAILING_SEND_GAP_MS));
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
