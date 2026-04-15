/**
 * Admin: list (GET) and create (POST) comms templates.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { commsTemplateCreateSchema } from '@/lib/validations/comms';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const templates = await prisma.commsTemplate.findMany({
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      channel: t.channel,
      subject: t.subject,
      htmlBody: t.htmlBody,
      variables: t.variables,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = commsTemplateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const template = await prisma.commsTemplate.create({
    data: {
      name: parsed.data.name,
      channel: parsed.data.channel,
      subject: parsed.data.subject ?? null,
      htmlBody: parsed.data.htmlBody ?? null,
      variables: parsed.data.variables ?? '[]',
    },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'comms_template.create',
    entity: 'CommsTemplate',
    entityId: template.id,
    diff: { name: template.name, channel: template.channel },
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
