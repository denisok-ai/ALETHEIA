/**
 * Admin: send message by template or ad-hoc body to recipients (Resend / Telegram).
 * При большом числе получателей — фоновая отправка + taskId для мониторинга.
 */
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  executeCommsBatch,
  loadCommsAttachmentsFromPaths,
  resolveCommsRecipients,
  type CommsMessageContent,
} from '@/lib/comms-batch';
import { commsSendSchema } from '@/lib/validations/comms';
import {
  registerTask,
  updateTaskProgress,
  removeTask,
} from '@/lib/background-tasks';
import type { EmailAttachment } from '@/lib/email';

/** Порог: больше — ответ сразу с taskId, отправка в фоне (долгий HTTP не блокируется). */
const COMMS_ASYNC_RECIPIENT_THRESHOLD = 25;

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = commsSendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  let content: CommsMessageContent;
  if (parsed.data.templateId) {
    const template = await prisma.commsTemplate.findUnique({
      where: { id: parsed.data.templateId },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    content = {
      templateId: template.id,
      channel: template.channel,
      subject: template.subject ?? '',
      htmlBody: template.htmlBody ?? '',
      variablesJson: template.variables ?? '[]',
    };
  } else {
    content = {
      templateId: null,
      channel: parsed.data.channel!,
      subject: parsed.data.subject?.trim() ?? '',
      htmlBody: parsed.data.htmlBody?.trim() ?? '',
      variablesJson: '[]',
    };
  }

  const profiles = await resolveCommsRecipients(parsed.data);

  let attachments: EmailAttachment[] = [];
  if (parsed.data.attachmentPaths?.length && content.channel === 'email') {
    const loaded = await loadCommsAttachmentsFromPaths(parsed.data.attachmentPaths);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: 400 });
    }
    attachments = loaded.attachments;
  } else if (parsed.data.attachmentPaths?.length && content.channel === 'telegram') {
    return NextResponse.json({ error: 'Вложения поддерживаются только для канала email' }, { status: 400 });
  }

  const sentByUserId = auth.userId;

  if (profiles.length >= COMMS_ASYNC_RECIPIENT_THRESHOLD) {
    const taskId = nanoid();
    registerTask(taskId, {
      name: `Коммуникации: ${profiles.length} получателей`,
      initiatorId: sentByUserId,
    });

    void (async () => {
      try {
        await executeCommsBatch({
          profiles,
          content,
          sentByUserId,
          attachments,
          onProgress: (done, total) => {
            if (total > 0) updateTaskProgress(taskId, Math.round((done / total) * 100));
          },
        });
      } finally {
        removeTask(taskId);
      }
    })();

    return NextResponse.json({
      async: true,
      taskId,
      recipientCount: profiles.length,
      message: 'Отправка выполняется в фоне. Прогресс: Портал → Мониторинг → Выполняемые задачи.',
    });
  }

  const { sent, failed, results } = await executeCommsBatch({
    profiles,
    content,
    sentByUserId,
    attachments,
  });

  return NextResponse.json({ sent, failed, results, async: false });
}
