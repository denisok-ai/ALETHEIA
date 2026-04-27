/**
 * Admin: get (GET), update (PATCH), delete (DELETE) one comms template.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { commsTemplateUpdateSchema } from '@/lib/validations/comms';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const template = await prisma.commsTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    template: {
      id: template.id,
      name: template.name,
      channel: template.channel,
      subject: template.subject,
      htmlBody: template.htmlBody,
      variables: template.variables,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.commsTemplate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = commsTemplateUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const data: { name?: string; channel?: string; subject?: string | null; htmlBody?: string | null; variables?: string | null } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.channel !== undefined) data.channel = parsed.data.channel;
  if (parsed.data.subject !== undefined) data.subject = parsed.data.subject;
  if (parsed.data.htmlBody !== undefined) data.htmlBody = parsed.data.htmlBody;
  if (parsed.data.variables !== undefined) data.variables = parsed.data.variables;

  const template = await prisma.commsTemplate.update({
    where: { id },
    data,
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'comms_template.update',
    entity: 'CommsTemplate',
    entityId: id,
    diff: data,
  });

  return NextResponse.json({
    template: {
      id: template.id,
      name: template.name,
      channel: template.channel,
      subject: template.subject,
      htmlBody: template.htmlBody,
      variables: template.variables,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.commsTemplate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.commsTemplate.delete({ where: { id } });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'comms_template.delete',
    entity: 'CommsTemplate',
    entityId: id,
    diff: { name: existing.name },
  });

  return NextResponse.json({ success: true });
}
