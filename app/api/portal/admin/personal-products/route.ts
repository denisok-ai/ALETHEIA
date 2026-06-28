import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const products = await prisma.personalProduct.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { links: true } } },
  });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const { name, description, priceRub, expiresAt, installmentEnabled, maxInstallments } = body;
  if (!name || typeof priceRub !== 'number' || priceRub < 10) {
    return NextResponse.json({ error: 'name и priceRub (минимум 10) обязательны' }, { status: 400 });
  }
  const product = await prisma.personalProduct.create({
    data: {
      name,
      description: description || null,
      priceRub,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      installmentEnabled: !!installmentEnabled,
      maxInstallments: maxInstallments ? Math.min(Math.max(Number(maxInstallments), 2), 6) : 3,
      createdById: session.user.id,
    },
  });
  return NextResponse.json(product, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: 'id обязателен' }, { status: 400 });
  }
  const product = await prisma.personalProduct.findUnique({
    where: { id },
    include: { _count: { select: { links: true } }, links: { where: { status: 'paid' } } },
  });
  if (!product) {
    return NextResponse.json({ error: 'Товар не найден' }, { status: 404 });
  }
  if (product.links.length > 0) {
    return NextResponse.json({ error: 'Нельзя удалить товар с оплаченными ссылками' }, { status: 400 });
  }
  await prisma.paymentLink.deleteMany({ where: { productId: id } });
  await prisma.personalProduct.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
