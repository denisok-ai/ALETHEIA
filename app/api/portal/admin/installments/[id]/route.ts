import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const plan = await prisma.installmentPlan.findUnique({
    where: { id: params.id },
    include: {
      order: true,
      payments: { orderBy: { partNumber: 'asc' } },
    },
  });
  if (!plan) {
    return NextResponse.json({ error: 'План не найден' }, { status: 404 });
  }
  return NextResponse.json(plan);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const { status } = body;
  if (!['active', 'completed', 'defaulted', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Недопустимый статус' }, { status: 400 });
  }
  const plan = await prisma.installmentPlan.update({
    where: { id: params.id },
    data: {
      status,
      ...(status === 'completed' || status === 'cancelled' ? { nextPaymentAt: null } : {}),
    },
  });
  return NextResponse.json(plan);
}
