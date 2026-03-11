/**
 * Admin: get one mailing (GET), update (PATCH), delete (DELETE).
 * Edit only when status = planned.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { mailingUpdateSchema } from '@/lib/validations/mailing';
import { writeAuditLog } from '@/lib/audit';

function serialize(m: { id: string; internalTitle: string; emailSubject: string; emailBody: string; senderName: string | null; senderEmail: string | null; status: string; scheduleMode: string; scheduledAt: Date | null; recipientConfig: string | null; attachments: string | null; createdById: string | null; createdAt: Date; updatedAt: Date; startedAt: Date | null; completedAt: Date | null }) {
  return {
    id: m.id,
    internalTitle: m.internalTitle,
    emailSubject: m.emailSubject,
    emailBody: m.emailBody,
    senderName: m.senderName,
    senderEmail: m.senderEmail,
    status: m.status,
    scheduleMode: m.scheduleMode,
    scheduledAt: m.scheduledAt?.toISOString() ?? null,
    recipientConfig: m.recipientConfig,
    attachments: m.attachments,
    createdById: m.createdById,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    startedAt: m.startedAt?.toISOString() ?? null,
    completedAt: m.completedAt?.toISOString() ?? null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const m = await prisma.mailing.findUnique({
    where: { id },
    include: { _count: { select: { logs: true } } },
  });
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    mailing: { ...serialize(m), logsCount: m._count.logs },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.mailing.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.status !== 'planned') {
    return NextResponse.json({ error: 'Редактировать можно только рассылку со статусом «Запланирована»' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = mailingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const d = parsed.data;
  const update: Record<string, unknown> = {};
  if (d.internalTitle !== undefined) update.internalTitle = d.internalTitle;
  if (d.emailSubject !== undefined) update.emailSubject = d.emailSubject;
  if (d.emailBody !== undefined) update.emailBody = d.emailBody;
  if (d.senderName !== undefined) update.senderName = d.senderName || null;
  if (d.senderEmail !== undefined) update.senderEmail = d.senderEmail || null;
  if (d.scheduleMode !== undefined) update.scheduleMode = d.scheduleMode;
  if (d.scheduledAt !== undefined) update.scheduledAt = d.scheduledAt ? new Date(d.scheduledAt) : null;
  if (d.recipientConfig !== undefined) update.recipientConfig = d.recipientConfig ? JSON.stringify(d.recipientConfig) : null;
  if (d.attachments !== undefined) update.attachments = d.attachments;

  const mailing = await prisma.mailing.update({
    where: { id },
    data: update,
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'mailing.update',
    entity: 'Mailing',
    entityId: id,
    diff: { internalTitle: mailing.internalTitle },
  });

  return NextResponse.json({ mailing: serialize(mailing) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.mailing.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.mailing.delete({ where: { id } });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'mailing.delete',
    entity: 'Mailing',
    entityId: id,
    diff: { internalTitle: existing.internalTitle },
  });

  return NextResponse.json({ success: true });
}
