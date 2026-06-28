import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const link = await prisma.paymentLink.findUnique({
    where: { token: params.token },
    include: { product: true },
  });
  if (!link) {
    return NextResponse.json({ error: 'Ссылка не найдена' }, { status: 404 });
  }
  const now = new Date();
  const isExpired =
    link.product.expiresAt !== null && link.product.expiresAt < now;
  if (isExpired && link.status === 'pending') {
    await prisma.paymentLink.update({
      where: { id: link.id },
      data: { status: 'expired' },
    });
  }
  return NextResponse.json({
    status: isExpired ? 'expired' : link.status,
    product: {
      name: link.product.name,
      description: link.product.description,
      priceRub: link.product.priceRub,
      installmentEnabled: link.product.installmentEnabled,
      maxInstallments: link.product.maxInstallments,
    },
    clientEmail: link.clientEmail,
    clientName: link.clientName,
  });
}
