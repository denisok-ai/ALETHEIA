/**
 * Admin: copy mailing (POST). Creates a new planned mailing with same content, no logs.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const source = await prisma.mailing.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const copy = await prisma.mailing.create({
    data: {
      internalTitle: `${source.internalTitle} (копия)`,
      emailSubject: source.emailSubject,
      emailBody: source.emailBody,
      senderName: source.senderName,
      senderEmail: source.senderEmail,
      status: 'planned',
      scheduleMode: source.scheduleMode,
      scheduledAt: source.scheduledAt,
      recipientConfig: source.recipientConfig,
      attachments: source.attachments,
      createdById: auth.userId,
    },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'mailing.copy',
    entity: 'Mailing',
    entityId: copy.id,
    diff: { fromId: id, internalTitle: copy.internalTitle },
  });

  return NextResponse.json({
    mailing: {
      id: copy.id,
      internalTitle: copy.internalTitle,
      emailSubject: copy.emailSubject,
      status: copy.status,
      createdAt: copy.createdAt.toISOString(),
    },
  });
}
