/**
 * Admin: delete old notification log rows (retention).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { olderThanDays?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const days = Math.min(3650, Math.max(1, Number(body.olderThanDays) || 30));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const result = await prisma.notificationLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return NextResponse.json({ deleted: result.count, olderThanDays: days });
}
