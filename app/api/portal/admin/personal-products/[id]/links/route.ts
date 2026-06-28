import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { nanoid } from 'nanoid';
import { sendTransactionalEmail } from '@/lib/email-service';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const links = await prisma.paymentLink.findMany({
    where: { productId: params.id },
    orderBy: { createdAt: 'desc' },
    include: { order: { select: { orderNumber: true, status: true } } },
  });
  return NextResponse.json(links);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const product = await prisma.personalProduct.findUnique({ where: { id: params.id } });
  if (!product) {
    return NextResponse.json({ error: 'Товар не найден' }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const { clientEmail, clientName } = body;
  if (!clientEmail) {
    return NextResponse.json({ error: 'clientEmail обязателен для отправки ссылки клиенту' }, { status: 400 });
  }
  const token = nanoid(21);
  const link = await prisma.paymentLink.create({
    data: {
      productId: params.id,
      token,
      clientEmail,
      clientName: clientName || null,
    },
  });

  const siteUrl = process.env.NEXT_PUBLIC_URL || 'https://avaterra.pro';
  const payUrl = `${siteUrl}/pay/${token}`;
  const expiresText = product.expiresAt
    ? `Ссылка действительна до ${new Date(product.expiresAt).toLocaleDateString('ru-RU')}.`
    : 'Ссылка бессрочная.';

  try {
    await sendTransactionalEmail({
      to: clientEmail,
      subject: `Ссылка на оплату «${product.name}» — АВАТЕРРА`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="color:#2D1B4E;">АВАТЕРРА — ссылка на оплату</h2>
          <p>Здравствуйте${clientName ? `, ${clientName}` : ''}!</p>
          <p>Для вас подготовлена ссылка на оплату:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Услуга</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${product.name}</td></tr>
            ${product.description ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Описание</td><td style="padding:8px;border-bottom:1px solid #eee;">${product.description}</td></tr>` : ''}
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Сумма</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${product.priceRub.toLocaleString('ru-RU')} ₽</td></tr>
          </table>
          <p style="text-align:center;margin:24px 0;">
            <a href="${payUrl}" style="display:inline-block;padding:14px 32px;background:#D4AF37;color:#2D1B4E;text-decoration:none;font-weight:bold;border-radius:8px;font-size:16px;">Перейти к оплате</a>
          </p>
          <p style="color:#666;font-size:13px;">${expiresText}</p>
          <p style="color:#999;font-size:12px;margin-top:24px;">АВАТЕРРА · Школа мышечного тестирования</p>
        </div>
      `,
      context: { module: 'payments', entityId: link.id },
    });
  } catch (e) {
    console.error('[payment-link] email failed:', e);
  }

  return NextResponse.json(link, { status: 201 });
}
