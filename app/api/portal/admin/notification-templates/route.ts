/**
 * Admin: список шаблонов уведомлений (GET), создание (POST).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

const createSchema = {
  name: (v: unknown) => typeof v === 'string' && v.trim().length > 0,
  subject: (v: unknown) => v == null || typeof v === 'string',
  body: (v: unknown) => typeof v === 'string',
  type: (v: unknown) => (typeof v === 'string' && ['internal', 'email', 'both'].includes(v)) || v == null,
};

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const list = await prisma.notificationTemplate.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, subject: true, body: true, type: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({
    templates: list.map((t) => ({
      ...t,
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

  const o = body as Record<string, unknown>;
  if (!createSchema.name(o.name) || !createSchema.body(o.body)) {
    return NextResponse.json({ error: 'name and body required' }, { status: 400 });
  }
  const subject = createSchema.subject(o.subject) ? (o.subject as string) ?? null : null;
  const type = createSchema.type(o.type) ? ((o.type as string) || 'both') : 'both';

  const template = await prisma.notificationTemplate.create({
    data: {
      name: String(o.name).trim(),
      subject,
      body: String(o.body),
      type,
    },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'notification_template.create',
    entity: 'NotificationTemplate',
    entityId: template.id,
    diff: { name: template.name },
  });

  return NextResponse.json({
    id: template.id,
    name: template.name,
    subject: template.subject,
    body: template.body,
    type: template.type,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  });
}
