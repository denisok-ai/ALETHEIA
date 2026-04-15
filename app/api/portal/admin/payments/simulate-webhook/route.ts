/**
 * Админка: симуляция успешной оплаты без вызова PayKeeper.
 * Создаёт заказ в БД и обрабатывает его как оплаченный (запись на курс, письмо).
 * Конфиг и секрет не нужны — используются только данные из БД (товар/услуга, настройки писем).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { processPaidOrder } from '@/lib/paykeeper-webhook-process';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const serviceSlug = typeof body.serviceSlug === 'string' ? body.serviceSlug.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() || 'Тест' : 'Тест';

    if (!email || !serviceSlug) {
      return NextResponse.json(
        { error: 'Укажите email и serviceSlug (slug товара из раздела «Товары для продажи»)' },
        { status: 400 }
      );
    }

    const service = await prisma.service.findFirst({
      where: { slug: serviceSlug, isActive: true },
      select: { id: true, slug: true, name: true, price: true, paykeeperTariffId: true, courseId: true },
    });

    if (!service) {
      return NextResponse.json(
        { error: 'Товар с таким slug не найден или не активен. Проверьте раздел «Товары для продажи на главной».' },
        { status: 404 }
      );
    }

    const tariffIdToUse = service.paykeeperTariffId ?? service.slug;
    const orderNumber = `ALT-SIM-${nanoid(10)}`;

    await prisma.order.create({
      data: {
        orderNumber,
        tariffId: tariffIdToUse,
        amount: service.price,
        clientEmail: email,
        clientPhone: null,
        status: 'pending',
      },
    });

    const result = await processPaidOrder(orderNumber);
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Ошибка обработки заказа' }, { status: 500 });
    }

    return NextResponse.json({ success: true, orderNumber });
  } catch (error) {
    console.error('Simulate webhook error:', error);
    return NextResponse.json(
      { error: 'Ошибка симуляции оплаты' },
      { status: 500 }
    );
  }
}
