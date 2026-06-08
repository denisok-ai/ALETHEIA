/**
 * Admin: одно входящее письмо.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { messageDetailDto } from '@/lib/inmail-dto';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  const row = await prisma.inboundMessage.findUnique({
    where: { id },
    include: {
      mailbox: { select: { id: true, label: true } },
      matchedUser: { select: { id: true, email: true, displayName: true } },
    },
  });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ message: messageDetailDto(row) });
}
