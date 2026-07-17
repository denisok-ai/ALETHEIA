import { NextRequest, NextResponse } from 'next/server';
import { createPayKeeperInvoice } from '@/lib/paykeeper';
import { buildPaykeeperServiceNamePayload } from '@/lib/paykeeper/fiscal';
import { prisma } from '@/lib/db';
import { getSystemSettings } from '@/lib/settings';
import { nanoid } from 'nanoid';
import { checkRateLimit } from '@/lib/rate-limit';
import { processPaidOrder } from '@/lib/paykeeper-webhook-process';
import {
  assertServiceLinkedToCourse,
  findActiveServiceBySlug,
  findActiveServiceForOrderTariff,
  orderTariffIdForStorage,
} from '@/lib/order-service';
import {
  maskEmailForLog,
  writePaykeeperIntegrationLog,
} from '@/lib/paykeeper-integration-log';
import { logPersonalDataConsent } from '@/lib/consent-log';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';

export async function POST(request: NextRequest) {
  const rateLimitRes = checkRateLimit(request, 'payment-create', 10);
  if (rateLimitRes) return rateLimitRes;

  try {
    const body = await request.json();
    const { tariffId, serviceSlug, email, name, phone } = body;
    if (body?.pdConsent !== true) {
      return NextResponse.json(
        { error: 'Необходимо согласие на обработку персональных данных' },
        { status: 400 }
      );
    }
    if ((!tariffId && !serviceSlug) || !email || !name) {
      return NextResponse.json(
        { error: 'Укажите serviceSlug (или tariffId), email и имя' },
        { status: 400 }
      );
    }

    const slug = typeof serviceSlug === 'string' ? serviceSlug.trim() : '';
    const tid = typeof tariffId === 'string' ? tariffId.trim() : '';

    const service = slug
      ? await findActiveServiceBySlug(slug)
      : tid
        ? await findActiveServiceForOrderTariff(tid)
        : null;

    const linked = assertServiceLinkedToCourse(service);
    if (!linked.ok) {
      const status = service == null ? 404 : 400;
      return NextResponse.json({ error: linked.error }, { status });
    }

    const tariffIdToUse = orderTariffIdForStorage(service!);
    const amount = service!.price;
    const serviceName = service!.name;

    const orderNumber = `ALT-${nanoid(10)}`;

    try {
      await prisma.order.create({
        data: {
          orderNumber,
          tariffId: tariffIdToUse,
          amount,
          clientEmail: email.trim(),
          clientPhone: typeof phone === 'string' ? phone.trim() || null : null,
          clientName: typeof name === 'string' ? name.trim() || null : null,
          status: 'pending',
        },
      });
    } catch (dbErr) {
      console.error('DB insert order:', dbErr);
      await writePaykeeperIntegrationLog({
        direction: 'outbound',
        event: 'payment.create',
        status: 'error',
        message: 'Ошибка создания заказа в БД',
        payload: { tariffId: tariffIdToUse, email: maskEmailForLog(String(email)) },
      });
      return NextResponse.json(
        { error: 'Ошибка создания заказа', success: false },
        { status: 500 }
      );
    }

    await writePaykeeperIntegrationLog({
      direction: 'outbound',
      event: 'payment.create',
      status: 'success',
      orderNumber,
      message: 'Заказ создан (pending)',
      payload: {
        amount,
        tariffId: tariffIdToUse,
        email: maskEmailForLog(email.trim()),
        serviceSlug: slug || null,
      },
    });

    await logPersonalDataConsent({
      kind: 'pd_processing',
      context: 'payment_create',
      emailNorm: String(email).trim().toLowerCase(),
      orderNumber,
    });

    const settings = await getSystemSettings();
    const siteFromSettings = settings.site_url?.replace(/\/$/, '').trim() || '';
    /** Если в БД/.env нет site_url — берём origin запроса (локально совпадёт с портом dev-сервера). */
    const baseUrl = siteFromSettings || request.nextUrl.origin.replace(/\/$/, '');

    if (amount <= 0) {
      const paid = await processPaidOrder(orderNumber);
      if (!paid.success) {
        await writePaykeeperIntegrationLog({
          direction: 'outbound',
          event: 'payment.free_access',
          status: 'error',
          orderNumber,
          message: paid.error ?? 'processPaidOrder failed',
        });
        return NextResponse.json(
          { error: paid.error || 'Не удалось оформить бесплатный доступ', success: false },
          { status: 500 }
        );
      }
      const paymentUrl = baseUrl
        ? `${baseUrl}/success?order=${encodeURIComponent(orderNumber)}`
        : `/success?order=${encodeURIComponent(orderNumber)}`;
      await writePaykeeperIntegrationLog({
        direction: 'outbound',
        event: 'payment.free_access',
        status: 'success',
        orderNumber,
        invoiceUrl: paymentUrl,
        message: 'Бесплатный доступ оформлен',
      });
      return NextResponse.json({
        success: true,
        paymentUrl,
        orderNumber,
        amount,
      });
    }

    const successRedirectUrl = `${baseUrl}/success?order=${encodeURIComponent(orderNumber)}`;
    const serviceNamePayload = await buildPaykeeperServiceNamePayload(
      serviceName,
      amount,
      successRedirectUrl
    );

    let paymentUrl: string;
    try {
      const inv = await createPayKeeperInvoice({
        sum: amount,
        orderid: orderNumber,
        clientid: email.trim(),
        service_name: serviceNamePayload,
        client_email: email.trim(),
        client_phone: typeof phone === 'string' ? phone.trim() || undefined : undefined,
        // Всегда передаём: invoices.ts ставит user_result_callback и для строки, и для JSON service_name.
        successRedirectUrl,
      });
      paymentUrl = inv.paymentUrl;
      await prisma.order.update({
        where: { orderNumber },
        data: {
          paykeeperInvoiceId: inv.invoiceId,
          paykeeperInvoiceUrl: inv.paymentUrl,
        },
      });
    } catch (pkErr) {
      console.error('PayKeeper create invoice:', pkErr);
      const msg =
        pkErr instanceof Error ? pkErr.message : 'Ошибка создания платежа в PayKeeper';
      await writePaykeeperIntegrationLog({
        direction: 'outbound',
        event: 'payment.create',
        status: 'error',
        orderNumber,
        message: msg.slice(0, 500),
      });
      // Алерт админам: клиент не смог оплатить — узнаём сразу, а не от клиентов
      notifyAdminsTelegramAsync('paykeeper_webhook_error', [
        'Не удалось создать счёт PayKeeper (клиент не смог перейти к оплате)',
        `Заказ: ${orderNumber}, сумма: ${amount} ₽`,
        `Email: ${maskEmailForLog(email.trim())}`,
        `Ошибка: ${msg.slice(0, 200)}`,
      ]);
      return NextResponse.json(
        {
          // Текст видит клиент — без внутренних терминов
          error:
            'Платёжный сервис временно недоступен. Попробуйте ещё раз через несколько минут — заказ сохранён. Если не получится, напишите нам через страницу контактов.',
          success: false,
        },
        { status: 502 }
      );
    }

    await writePaykeeperIntegrationLog({
      direction: 'outbound',
      event: 'payment.redirect',
      status: 'success',
      orderNumber,
      invoiceUrl: paymentUrl,
      message: 'Ссылка на оплату PayKeeper выдана клиенту',
    });

    return NextResponse.json({
      success: true,
      paymentUrl,
      orderNumber,
      amount,
    });
  } catch (error) {
    console.error('Payment create error:', error);
    await writePaykeeperIntegrationLog({
      direction: 'outbound',
      event: 'payment.create',
      status: 'error',
      message: error instanceof Error ? error.message : 'Payment create error',
    });
    return NextResponse.json(
      { error: 'Ошибка создания платежа', success: false },
      { status: 500 }
    );
  }
}
