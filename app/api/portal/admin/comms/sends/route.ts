/**
 * Admin: list comms sends with filters and pagination.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10) || 25));
  const status = searchParams.get('status')?.trim();
  const channel = searchParams.get('channel')?.trim();
  const isTestParam = searchParams.get('isTest');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  const where: Prisma.CommsSendWhereInput = {};
  if (status) where.status = status;
  if (channel) where.channel = channel;
  if (isTestParam === 'true') where.isTest = true;
  if (isTestParam === 'false') where.isTest = false;

  if (dateFrom || dateTo) {
    where.sentAt = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!Number.isNaN(d.getTime())) (where.sentAt as Prisma.DateTimeFilter).gte = d;
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (!Number.isNaN(d.getTime())) (where.sentAt as Prisma.DateTimeFilter).lte = d;
    }
  }

  const [total, sends] = await Promise.all([
    prisma.commsSend.count({ where }),
    prisma.commsSend.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip: page * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    sends: sends.map((s) => ({
      id: s.id,
      channel: s.channel,
      recipient: s.recipient,
      subject: s.subject,
      status: s.status,
      sentAt: s.sentAt.toISOString(),
      errorMessage: s.errorMessage,
      isTest: s.isTest,
    })),
    total,
    page,
    pageSize,
  });
}
