/**
 * Admin: list and create notification sets.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NOTIFICATION_SET_EVENT_LABELS } from '@/lib/notification-set-events';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sets = await prisma.notificationSet.findMany({
    orderBy: [{ eventType: 'asc' }, { name: 'asc' }],
    select: { id: true, eventType: true, name: true, isDefault: true },
  });
  return NextResponse.json({ sets });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { eventType?: string; name?: string; isDefault?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = typeof body.eventType === 'string' ? body.eventType.trim() : '';
  if (!eventType || !(eventType in NOTIFICATION_SET_EVENT_LABELS)) {
    return NextResponse.json({ error: 'Укажите корректный тип события' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const displayName = name || NOTIFICATION_SET_EVENT_LABELS[eventType];
  const isDefault = body.isDefault === true;

  const set = await prisma.notificationSet.create({
    data: {
      eventType,
      name: displayName,
      isDefault,
    },
  });

  return NextResponse.json({
    set: {
      id: set.id,
      eventType: set.eventType,
      name: set.name,
      isDefault: set.isDefault,
    },
  });
}
