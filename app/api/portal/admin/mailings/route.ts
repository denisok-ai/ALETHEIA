/**
 * Admin: list mailings (GET), create mailing (POST).
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { mailingCreateSchema } from '@/lib/validations/mailing';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const list = await prisma.mailing.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
      _count: { select: { logs: true } },
    },
  });

  return NextResponse.json({
    mailings: list.map((m) => ({
      id: m.id,
      internalTitle: m.internalTitle,
      emailSubject: m.emailSubject,
      status: m.status,
      scheduleMode: m.scheduleMode,
      scheduledAt: m.scheduledAt?.toISOString() ?? null,
      createdById: m.createdById,
      createdByEmail: m.createdBy?.email ?? null,
      createdByDisplayName: m.createdBy?.profile?.displayName ?? null,
      createdAt: m.createdAt.toISOString(),
      logsCount: m._count.logs,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = mailingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const d = parsed.data;
  const mailing = await prisma.mailing.create({
    data: {
      internalTitle: d.internalTitle,
      emailSubject: d.emailSubject,
      emailBody: d.emailBody,
      senderName: d.senderName || null,
      senderEmail: d.senderEmail || null,
      scheduleMode: d.scheduleMode ?? 'manual',
      scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null,
      recipientConfig: d.recipientConfig ? JSON.stringify(d.recipientConfig) : null,
      attachments: d.attachments ?? null,
      createdById: auth.userId,
    },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'mailing.create',
    entity: 'Mailing',
    entityId: mailing.id,
    diff: { internalTitle: mailing.internalTitle },
  });

  return NextResponse.json({ mailing: serializeMailing(mailing) });
}

function serializeMailing(m: { id: string; internalTitle: string; emailSubject: string; emailBody: string; senderName: string | null; senderEmail: string | null; status: string; scheduleMode: string; scheduledAt: Date | null; recipientConfig: string | null; attachments: string | null; createdById: string | null; createdAt: Date; updatedAt: Date; startedAt: Date | null; completedAt: Date | null }) {
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
