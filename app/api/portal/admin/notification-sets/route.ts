/**
 * Admin: catalog of notification sets (for attaching to courses).
 * GET /api/portal/admin/notification-sets
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sets = await prisma.notificationSet.findMany({
    orderBy: { eventType: 'asc' },
    select: { id: true, eventType: true, name: true, isDefault: true },
  });

  return NextResponse.json({
    notificationSets: sets.map((s) => ({
      id: s.id,
      eventType: s.eventType,
      name: s.name,
      isDefault: s.isDefault,
    })),
  });
}
