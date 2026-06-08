/**
 * Admin: список входящих писем (пагинация, фильтры).
 */
import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { messageListItemDto } from '@/lib/inmail-dto';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const mailboxId = searchParams.get('mailboxId')?.trim() || undefined;
  const fromSearch = searchParams.get('from')?.trim() || undefined;
  const unmatchedOnly = searchParams.get('unmatchedOnly') === '1' || searchParams.get('unmatchedOnly') === 'true';
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 25));

  const where: Prisma.InboundMessageWhereInput = {};
  if (mailboxId) where.mailboxId = mailboxId;
  if (fromSearch) where.fromAddress = { contains: fromSearch };
  if (unmatchedOnly) where.matchedUserId = null;

  if (dateFrom || dateTo) {
    where.receivedAt = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!Number.isNaN(d.getTime())) (where.receivedAt as Prisma.DateTimeFilter).gte = d;
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (!Number.isNaN(d.getTime())) (where.receivedAt as Prisma.DateTimeFilter).lte = d;
    }
  }

  const [rows, total] = await prisma.$transaction([
    prisma.inboundMessage.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        mailbox: { select: { label: true } },
        matchedUser: { select: { id: true, email: true, displayName: true } },
      },
    }),
    prisma.inboundMessage.count({ where }),
  ]);

  return NextResponse.json({
    messages: rows.map(messageListItemDto),
    total,
    page,
    pageSize,
  });
}
