import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const link = await prisma.paymentLink.findUnique({ where: { id: params.id } });
  if (!link) {
    return NextResponse.json({ error: 'Ссылка не найдена' }, { status: 404 });
  }
  if (link.status === 'paid') {
    return NextResponse.json({ error: 'Нельзя отменить оплаченную ссылку' }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const { status } = body;
  if (!['cancelled', 'pending'].includes(status)) {
    return NextResponse.json({ error: 'Допустимые статусы: cancelled, pending' }, { status: 400 });
  }
  const updated = await prisma.paymentLink.update({
    where: { id: params.id },
    data: { status },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const link = await prisma.paymentLink.findUnique({ where: { id: params.id } });
  if (!link) {
    return NextResponse.json({ error: 'Ссылка не найдена' }, { status: 404 });
  }
  if (link.status === 'paid') {
    return NextResponse.json({ error: 'Нельзя удалить оплаченную ссылку' }, { status: 400 });
  }
  await prisma.paymentLink.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
