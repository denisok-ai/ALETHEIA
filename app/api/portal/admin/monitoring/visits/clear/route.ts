/**
 * Admin: очистка логов посещений — всё или старше N дней.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { olderThanDays?: number } = {};
  try {
    body = await request.json();
  } catch {
    // empty body = clear all
  }

  const olderThanDays = body.olderThanDays;
  const where =
    typeof olderThanDays === 'number' && olderThanDays > 0
      ? { loginAt: { lt: new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000) } }
      : {};

  const result = await prisma.visitLog.deleteMany({ where });
  return NextResponse.json({ deleted: result.count });
}
