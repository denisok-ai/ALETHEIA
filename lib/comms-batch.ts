/**
 * Пакетная отправка «Коммуникаций»: разрешение получателей и цикл email/Telegram.
 */
import { readFile } from 'fs/promises';
import path from 'path';
import { convert } from 'html-to-text';
import { prisma } from '@/lib/db';
import { renderTemplate, type EmailAttachment } from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/email-service';
import { wrapEmailHtml } from '@/lib/email-templates';
import { getSystemSettings } from '@/lib/settings';
import { sendTelegramMessageWithResult } from '@/lib/telegram';
import type { CommsSendPayload } from '@/lib/validations/comms';

export type CommsRecipientRow = {
  userId: string;
  email: string | null;
  telegramId: number | null;
  displayName: string | null;
};

export type CommsMessageContent = {
  templateId: string | null;
  channel: string;
  subject: string;
  htmlBody: string;
  variablesJson: string;
};

const COMMS_UPLOAD_SUBDIR = 'comms';

/** Проверка относительного пути вложения (только uploads/comms/*). */
export function isSafeCommsAttachmentRelPath(rel: string): boolean {
  if (!rel || rel.includes('..') || path.isAbsolute(rel)) return false;
  const norm = rel.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!norm.startsWith(`${COMMS_UPLOAD_SUBDIR}/`)) return false;
  const segments = norm.split('/').filter(Boolean);
  if (segments.length !== 2) return false;
  return segments[0] === COMMS_UPLOAD_SUBDIR && segments[1].length > 0 && segments[1].length < 300;
}

export async function loadCommsAttachmentsFromPaths(relPaths: string[] | undefined): Promise<
  { ok: true; attachments: EmailAttachment[] } | { ok: false; error: string }
> {
  if (!relPaths?.length) return { ok: true, attachments: [] };
  const attachments: EmailAttachment[] = [];
  const cwd = process.cwd();
  for (const rel of relPaths) {
    if (!isSafeCommsAttachmentRelPath(rel)) {
      return { ok: false, error: `Недопустимый путь вложения: ${rel}` };
    }
    const full = path.resolve(cwd, 'uploads', rel);
    const uploadsRoot = path.resolve(cwd, 'uploads');
    if (!full.startsWith(uploadsRoot)) {
      return { ok: false, error: 'Путь вне каталога uploads' };
    }
    try {
      const content = await readFile(full);
      const filename = path.basename(rel);
      attachments.push({ filename, content });
    } catch {
      return { ok: false, error: `Не удалось прочитать файл: ${rel}` };
    }
  }
  return { ok: true, attachments };
}

export async function resolveCommsRecipients(data: CommsSendPayload): Promise<CommsRecipientRow[]> {
  const whereProfile = { status: 'active' as const };
  if (data.recipientType === 'role' && data.role) {
    (whereProfile as { role?: string }).role = data.role;
  }

  let profiles: CommsRecipientRow[];
  if (data.recipientType === 'groups') {
    if (!data.groupIds?.length) {
      profiles = [];
    } else {
      const ug = await prisma.userGroup.findMany({
        where: { groupId: { in: data.groupIds } },
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
          telegramId: p.telegramId,
          displayName: p.displayName,
        }));
      }
    }
  } else if (data.recipientType === 'list' && data.recipientIds?.length) {
    const list = await prisma.profile.findMany({
      where: { userId: { in: data.recipientIds } },
      include: { user: { select: { email: true } } },
    });
    profiles = list.map((p) => ({
      userId: p.userId,
      email: p.email ?? p.user.email ?? null,
      telegramId: p.telegramId,
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
      telegramId: p.telegramId,
      displayName: p.displayName,
    }));
  }

  if (data.excludeGroupIds?.length) {
    const excludeUg = await prisma.userGroup.findMany({
      where: { groupId: { in: data.excludeGroupIds } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const excludeSet = new Set(excludeUg.map((x) => x.userId));
    profiles = profiles.filter((p) => !excludeSet.has(p.userId));
  }

  return profiles;
}

export async function executeCommsBatch(params: {
  profiles: CommsRecipientRow[];
  content: CommsMessageContent;
  sentByUserId: string;
  attachments?: EmailAttachment[];
  isTest?: boolean;
  onProgress?: (done: number, total: number) => void;
}): Promise<{ sent: number; failed: number; results: { recipient: string; status: string }[] }> {
  const { profiles, content, sentByUserId, attachments, isTest, onProgress } = params;
  const settings = await getSystemSettings();
  const { channel, subject, htmlBody, variablesJson, templateId } = content;

  let vars: Record<string, string> = {};
  try {
    const arr = JSON.parse(variablesJson || '[]') as string[];
    if (Array.isArray(arr)) arr.forEach((k) => { vars[k] = ''; });
  } catch {
    // ignore
  }

  const results: { recipient: string; status: string }[] = [];
  let sent = 0;
  let failed = 0;
  const total = profiles.length;

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    const recipientAddr = channel === 'email' ? (p.email ?? '') : p.telegramId ? String(p.telegramId) : '';
    if (!recipientAddr) {
      await prisma.commsSend.create({
        data: {
          templateId,
          channel,
          recipient: p.userId,
          subject: channel === 'email' ? subject : null,
          status: 'skipped',
          errorMessage: channel === 'email' ? 'Нет email у профиля' : 'Нет telegramId у профиля',
          sentBy: sentByUserId,
          isTest: isTest ?? false,
        },
      });
      results.push({ recipient: p.userId, status: 'skipped' });
      failed++;
      onProgress?.(i + 1, total);
      continue;
    }

    const templateVars = {
      ...vars,
      email: p.email ?? '',
      userId: p.userId,
      name: p.displayName ?? '',
      displayName: p.displayName ?? '',
    };
    const renderedHtml = renderTemplate(htmlBody, templateVars);
    const renderedText = convert(renderedHtml, { wordwrap: 200 });

    let ok = false;
    let errorMessage: string | null = null;

    if (channel === 'email') {
      const wrappedHtml = wrapEmailHtml(renderedHtml, { title: subject });
      const commsRow = await prisma.commsSend.create({
        data: {
          templateId,
          channel,
          recipient: recipientAddr,
          subject,
          status: 'pending',
          sentBy: sentByUserId,
          isTest: isTest ?? false,
        },
      });
      const r = await sendTransactionalEmail({
        to: recipientAddr,
        subject,
        html: wrappedHtml,
        from: settings.resend_from || undefined,
        attachments,
        context: {
          module: 'comms',
          entityId: commsRow.id,
          userId: p.userId,
          sentBy: sentByUserId,
        },
      });
      ok = r.ok;
      if (!r.ok) errorMessage = r.error;
      await prisma.commsSend.update({
        where: { id: commsRow.id },
        data: {
          status: ok ? 'sent' : 'failed',
          errorMessage: ok ? null : errorMessage?.slice(0, 1000) ?? null,
        },
      });
    } else {
      const r = await sendTelegramMessageWithResult(recipientAddr, renderedText);
      ok = r.ok;
      if (!r.ok) errorMessage = r.error;
      await prisma.commsSend.create({
        data: {
          templateId,
          channel,
          recipient: `tg:${recipientAddr}`,
          subject: null,
          status: ok ? 'sent' : 'failed',
          errorMessage,
          sentBy: sentByUserId,
          isTest: isTest ?? false,
        },
      });
    }

    const status = ok ? 'sent' : 'failed';
    if (ok) sent++;
    else failed++;

    results.push({ recipient: recipientAddr, status });
    onProgress?.(i + 1, total);
  }

  return { sent, failed, results };
}
