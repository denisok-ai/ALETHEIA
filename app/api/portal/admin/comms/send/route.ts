/**
 * Admin: send message by template to recipients (Resend for email, Telegram API for telegram).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { wrapEmailHtml } from '@/lib/email-templates';
import { getSystemSettings } from '@/lib/settings';
import { sendTelegramMessage } from '@/lib/telegram';
import { renderTemplate } from '@/lib/email';
import { commsSendSchema } from '@/lib/validations/comms';
import { convert } from 'html-to-text';

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

  const template = await prisma.commsTemplate.findUnique({
    where: { id: parsed.data.templateId },
  });
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  const settings = await getSystemSettings();

  const whereProfile = { status: 'active' as const };
  if (parsed.data.recipientType === 'role' && parsed.data.role) {
    (whereProfile as { role?: string }).role = parsed.data.role;
  }

  let profiles: { userId: string; email: string | null; telegramId: number | null; displayName: string | null }[];
  if (parsed.data.recipientType === 'groups') {
    if (!parsed.data.groupIds?.length) {
      profiles = [];
    } else {
      const ug = await prisma.userGroup.findMany({
        where: { groupId: { in: parsed.data.groupIds } },
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
  } else if (parsed.data.recipientType === 'list' && parsed.data.recipientIds?.length) {
    const list = await prisma.profile.findMany({
      where: { userId: { in: parsed.data.recipientIds } },
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

  if (parsed.data.excludeGroupIds?.length) {
    const excludeUg = await prisma.userGroup.findMany({
      where: { groupId: { in: parsed.data.excludeGroupIds } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const excludeSet = new Set(excludeUg.map((x) => x.userId));
    profiles = profiles.filter((p) => !excludeSet.has(p.userId));
  }

  const channel = template.channel;
  const subject = template.subject ?? '';
  const htmlBody = template.htmlBody ?? '';
  const varsJson = template.variables ?? '[]';
  let vars: Record<string, string> = {};
  try {
    const arr = JSON.parse(varsJson) as string[];
    arr.forEach((k) => { vars[k] = ''; });
  } catch {
    // no vars
  }

  const results: { recipient: string; status: string; id?: string }[] = [];
  let sent = 0;
  let failed = 0;

  for (const p of profiles) {
    const recipient = channel === 'email' ? (p.email ?? '') : (p.telegramId ? String(p.telegramId) : '');
    if (!recipient) {
      results.push({ recipient: p.userId, status: 'skipped' });
      failed++;
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
    if (channel === 'email') {
      const wrappedHtml = wrapEmailHtml(renderedHtml, { title: subject });
      ok = await sendEmail(recipient, subject, wrappedHtml, { from: settings.resend_from || undefined });
    } else {
      ok = await sendTelegramMessage(recipient, renderedText);
    }

    const status = ok ? 'sent' : 'failed';
    if (ok) sent++; else failed++;

    await prisma.commsSend.create({
      data: {
        templateId: template.id,
        channel: template.channel,
        recipient: channel === 'email' ? recipient : `tg:${recipient}`,
        subject: channel === 'email' ? subject : null,
        status,
        sentBy: auth.userId,
      },
    });

    results.push({ recipient, status });
  }

  return NextResponse.json({ sent, failed, results });
}
