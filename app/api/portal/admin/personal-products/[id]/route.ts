import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const product = await prisma.personalProduct.findUnique({ where: { id: params.id } });
  if (!product) {
    return NextResponse.json({ error: 'Товар не найден' }, { status: 404 });
  }
  const body = await req.json();
  const { name, description, priceRub, expiresAt, isActive, installmentEnabled, maxInstallments } = body;
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description || null;
  if (priceRub !== undefined) {
    if (typeof priceRub !== 'number' || priceRub < 10) {
      return NextResponse.json({ error: 'Минимальная цена — 10 ₽' }, { status: 400 });
    }
    data.priceRub = priceRub;
  }
  if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;
  if (isActive !== undefined) data.isActive = isActive;
  if (installmentEnabled !== undefined) data.installmentEnabled = !!installmentEnabled;
  if (maxInstallments !== undefined) data.maxInstallments = Math.min(Math.max(Number(maxInstallments), 2), 6);
  const updated = await prisma.personalProduct.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}
