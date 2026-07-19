import { NextRequest, NextResponse } from 'next/server';
import {
  buildPayKeeperWebhookResponse,
  getPayKeeperConfigFromSettings,
  validatePayKeeperWebhook,
} from '@/lib/paykeeper';
import { prisma } from '@/lib/db';
import { processPaidOrder } from '@/lib/paykeeper-webhook-process';
import { repairEnrollmentForOrder } from '@/lib/payments/reconcile-enrollments';
import {
  maskEmailForLog,
  writePaykeeperIntegrationLog,
} from '@/lib/paykeeper-integration-log';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';
import { sendTransactionalEmail } from '@/lib/email-service';
import {
  buildInstallmentContext,
  notifyInstallmentPaymentPaid,
  notifyInstallmentCompleted,
} from '@/lib/installment-notify';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = typeof value === 'string' ? value : value.toString();
    });

    const payloadPreview = {
      id: params.id,
      sum: params.sum,
      orderid: params.orderid,
      clientid: params.clientid ? maskEmailForLog(params.clientid) : params.clientid,
      key: params.key,
    };

    await writePaykeeperIntegrationLog({
      direction: 'inbound',
      event: 'webhook.received',
      status: 'success',
      orderNumber: params.orderid || null,
      message: 'POST /api/webhook/paykeeper',
      payload: { paramKeys: Object.keys(params), ...payloadPreview },
    });

    const config = await getPayKeeperConfigFromSettings();
    const secret = config?.secret;
    if (!secret) {
      console.error('[PayKeeper webhook] config_missing secret not configured in settings');
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.config',
        status: 'error',
        orderNumber: params.orderid || null,
        message: 'secret not configured in SystemSetting',
      });
      return NextResponse.json({ error: 'Config error' }, { status: 500 });
    }
    if (!validatePayKeeperWebhook(params, secret)) {
      console.warn('[PayKeeper webhook] invalid_signature');
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.invalid_signature',
        status: 'error',
        orderNumber: params.orderid || null,
        message: 'MD5 подпись не совпала с секретом из настроек',
        payload: payloadPreview,
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const { id, orderid, sum, clientid } = params;

    // Пустой orderid допустим формулой подписи PayKeeper, а валидатор требует
    // непустыми только id/sum/key. Раньше следующая строка сразу вызывала
    // orderid.match(...) и падала с TypeError → ответ 500, бесконечные ретраи
    // PayKeeper и поток ложных алертов «Исключение» админам.
    if (!orderid) {
      console.warn('[PayKeeper webhook] no_orderid');
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.no_orderid',
        status: 'warning',
        orderNumber: null,
        message: 'Уведомление без orderid — сопоставить с заказом невозможно',
        payload: payloadPreview,
      });
      return NextResponse.json({ ok: true, skipped: 'no orderid' });
    }

    // --- Рассрочка: orderid вида "ORDERNUMBER-I1", "ORDERNUMBER-I2" ---
    const installmentMatch = orderid.match(/^(.+)-I(\d+)$/);
    if (installmentMatch) {
      const baseOrderNumber = installmentMatch[1];
      const partNumber = parseInt(installmentMatch[2], 10);
      const baseOrder = await prisma.order.findUnique({ where: { orderNumber: baseOrderNumber } });
      if (!baseOrder) {
        await writePaykeeperIntegrationLog({
          direction: 'inbound', event: 'webhook.installment_order_not_found', status: 'error',
          orderNumber: orderid, message: 'Базовый заказ рассрочки не найден',
        });
        return NextResponse.json({ error: 'Base order not found' }, { status: 404 });
      }
      const plan = await prisma.installmentPlan.findUnique({ where: { orderId: baseOrder.id } });
      if (!plan) {
        await writePaykeeperIntegrationLog({
          direction: 'inbound', event: 'webhook.installment_plan_not_found', status: 'error',
          orderNumber: orderid, message: 'План рассрочки не найден',
        });
        return NextResponse.json({ error: 'Installment plan not found' }, { status: 404 });
      }
      const payment = await prisma.installmentPayment.findFirst({
        where: { planId: plan.id, partNumber },
      });
      if (!payment) {
        await writePaykeeperIntegrationLog({
          direction: 'inbound', event: 'webhook.installment_payment_not_found', status: 'error',
          orderNumber: orderid, message: `Платёж #${partNumber} не найден`,
        });
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
      }
      const installmentPaidAmount = Number(sum);
      if (
        !Number.isFinite(installmentPaidAmount) ||
        Math.round(installmentPaidAmount) !== payment.amountRub
      ) {
        console.warn('[PayKeeper webhook] installment_amount_mismatch', {
          orderid,
          expected: payment.amountRub,
          received: sum,
        });
        await writePaykeeperIntegrationLog({
          direction: 'inbound',
          event: 'webhook.installment_amount_mismatch',
          status: 'error',
          orderNumber: orderid,
          message: `Сумма webhook (${sum}) ≠ сумме платежа рассрочки (${payment.amountRub})`,
          payload: { expectedRub: payment.amountRub, receivedSum: sum },
        });
        return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
      }
      if (payment.status === 'paid') {
        await writePaykeeperIntegrationLog({
          direction: 'inbound', event: 'webhook.installment_idempotent', status: 'success',
          orderNumber: orderid, message: `Платёж #${partNumber} уже оплачен`,
        });
        return new NextResponse(buildPayKeeperWebhookResponse(id, secret), {
          status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }

      let allCompleted = false;
      await prisma.$transaction(async (tx) => {
        await tx.installmentPayment.update({
          where: { id: payment.id },
          data: { status: 'paid', paidAt: new Date(), paykeeperPaymentId: id },
        });
        const allPayments = await tx.installmentPayment.findMany({ where: { planId: plan.id } });
        const allPaid = allPayments.every((p) => p.status === 'paid');
        if (allPaid) {
          await tx.installmentPlan.update({
            where: { id: plan.id },
            data: { status: 'completed', nextPaymentAt: null },
          });
          await tx.order.update({
            where: { id: baseOrder.id },
            data: { status: 'paid', paidAt: new Date() },
          });
          allCompleted = true;
        } else {
          const nextDue = allPayments.find((p) => p.status === 'scheduled');
          await tx.installmentPlan.update({
            where: { id: plan.id },
            data: { nextPaymentAt: nextDue?.scheduledAt ?? null },
          });
        }
      });

      const ctx = await buildInstallmentContext(payment.id);
      if (allCompleted) {
        if (ctx) notifyInstallmentCompleted(ctx);
      } else {
        if (ctx) notifyInstallmentPaymentPaid(ctx);
      }

      await writePaykeeperIntegrationLog({
        direction: 'inbound', event: 'webhook.installment_paid', status: 'success',
        orderNumber: orderid, message: `Рассрочка #${partNumber}/${plan.totalParts} оплачена`,
        payload: { paykeeperId: id, allCompleted },
      });
      return new NextResponse(buildPayKeeperWebhookResponse(id, secret), {
        status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // --- Обычная оплата (не рассрочка) ---
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderid },
    });

    if (!order) {
      console.error('Webhook: order not found', orderid);
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.order_not_found',
        status: 'error',
        orderNumber: orderid,
        message: 'Заказ с таким orderid не найден в БД',
        payload: { id, sum, clientid: maskEmailForLog(clientid) },
      });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    // Сумма и клиент проверяются ДО любых мутаций (статус ссылки, лиды, письма):
    // иначе при расхождении суммы side-effects уже выполнены, а ответ — 400
    const paidAmount = Number(sum);
    if (!Number.isFinite(paidAmount) || Math.round(paidAmount * 100) !== order.amount * 100) {
      console.warn('[PayKeeper webhook] amount_mismatch', { orderid, expected: order.amount, received: sum });
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.amount_mismatch',
        status: 'error',
        orderNumber: orderid,
        message: `Сумма webhook (${sum}) ≠ сумме заказа (${order.amount})`,
        payload: { expectedRub: order.amount, receivedSum: sum },
      });
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }
    if (clientid && clientid.trim().toLowerCase() !== order.clientEmail.trim().toLowerCase()) {
      console.warn('[PayKeeper webhook] client_mismatch', { orderid, expected: order.clientEmail, received: clientid });
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.client_mismatch',
        status: 'error',
        orderNumber: orderid,
        message: 'clientid не совпадает с email заказа',
        payload: {
          expected: maskEmailForLog(order.clientEmail),
          received: maskEmailForLog(clientid),
        },
      });
      return NextResponse.json({ error: 'Client mismatch' }, { status: 400 });
    }

    // --- PaymentLink: обновить статус ссылки, если это персональный товар ---
    {
      const paymentLink = await prisma.paymentLink.findFirst({
        where: { orderId: order.id },
      });
      if (paymentLink && paymentLink.status === 'pending') {
        await prisma.paymentLink.update({
          where: { id: paymentLink.id },
          data: { status: 'paid', paidAt: new Date() },
        });
        await writePaykeeperIntegrationLog({
          direction: 'inbound', event: 'webhook.payment_link_paid', status: 'success',
          orderNumber: orderid, message: `Платёжная ссылка ${paymentLink.token} оплачена`,
        });
        const product = await prisma.personalProduct.findUnique({ where: { id: paymentLink.productId } });
        if (product) {
          notifyAdminsTelegramAsync('payment_received', [
            `Персональный товар: ${product.name}`,
            `Клиент: ${paymentLink.clientName || paymentLink.clientEmail}`,
            `Сумма: ${product.priceRub.toLocaleString('ru-RU')} ₽`,
            `Заказ: ${orderid}`,
          ]);
          if (paymentLink.clientEmail) {
            const existingLead = await prisma.lead.findFirst({
              where: { email: paymentLink.clientEmail.trim().toLowerCase() },
            });
            if (!existingLead) {
              await prisma.lead.create({
                data: {
                  name: paymentLink.clientName || paymentLink.clientEmail.split('@')[0],
                  phone: '',
                  email: paymentLink.clientEmail.trim().toLowerCase(),
                  message: `Оплата персонального товара: ${product.name} (${product.priceRub} ₽)`,
                  status: 'converted',
                  source: 'personal_product',
                  lastOrderNumber: orderid,
                },
              });
            } else {
              await prisma.lead.update({
                where: { id: existingLead.id },
                data: { lastOrderNumber: orderid },
              });
            }
            sendTransactionalEmail({
              to: paymentLink.clientEmail,
              subject: `Оплата получена — ${product.name} — АВАТЕРРА`,
              html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
                <h2 style="color:#2D1B4E;">АВАТЕРРА — оплата получена</h2>
                <p>Здравствуйте${paymentLink.clientName ? `, ${paymentLink.clientName}` : ''}!</p>
                <p>Оплата по услуге <strong>«${product.name}»</strong> успешно получена.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Заказ</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${orderid}</td></tr>
                  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Сумма</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${product.priceRub.toLocaleString('ru-RU')} ₽</td></tr>
                </table>
                <p style="color:#999;font-size:12px;margin-top:24px;">АВАТЕРРА · Школа мышечного тестирования</p>
              </div>`,
              context: { module: 'payments', entityId: paymentLink.id },
            }).catch(() => {});
          }
        }
      }
    }

    const paidAmountRub = Math.round(paidAmount);
    if (order.status === 'paid' && order.paykeeperPaymentId === id) {
      // Самолечение обязано быть и здесь. У маршрута своя ранняя проверка
      // идемпотентности, которая возвращает ответ, НЕ доходя до
      // processPaidOrder, — а восстановление доступа живёт внутри него. То есть
      // на самом частом пути (PayKeeper повторяет то же уведомление) починка
      // была недостижима: заказ оплачен, зачисления нет, ретрай ничего не менял.
      // Обнаружено сквозной проверкой на проде 19.07.2026: тест вызывал
      // processPaidOrder напрямую и потому этот разрыв не показывал.
      let repairedAccess = false;
      try {
        repairedAccess = await repairEnrollmentForOrder(orderid);
      } catch (e) {
        console.error(`[PayKeeper] Заказ ${orderid}: восстановление доступа не удалось:`, e);
      }
      if (repairedAccess) {
        const msg = `Заказ ${orderid}: доступ отсутствовал и был восстановлен при повторном оповещении.`;
        console.warn(`[PayKeeper] ${msg}`);
        notifyAdminsTelegramAsync('payment_needs_attention', [
          msg,
          'Проверьте, может ли клиент войти: если сбой случился до отправки письма, у него нет пароля.',
        ]);
      }
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.idempotent',
        status: 'success',
        orderNumber: orderid,
        message: repairedAccess
          ? 'Повторное оповещение: отсутствовавшее зачисление восстановлено'
          : 'Повторное оповещение: заказ уже оплачен этим платежом PayKeeper',
        payload: { paykeeperId: id, repairedAccess },
      });
      return new NextResponse(buildPayKeeperWebhookResponse(id, secret), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    if (order.status === 'paid') {
      await prisma.order
        .update({
          where: { orderNumber: orderid },
          data: {
            paykeeperPaymentId: order.paykeeperPaymentId ?? id,
            paykeeperStatus: order.paykeeperStatus ?? 'success',
            paidAmountRub: order.paidAmountRub ?? paidAmountRub,
          },
        })
        .catch(() => {});
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.already_paid_patch',
        status: 'success',
        orderNumber: orderid,
        message: 'Заказ уже оплачен — сохранён id PayKeeper без повторной выдачи доступа',
        payload: { paykeeperId: id },
      });
      return new NextResponse(buildPayKeeperWebhookResponse(id, secret), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const result = await processPaidOrder(orderid, {
      paykeeperPaymentId: id,
      paykeeperStatus: 'success',
      paidAmountRub,
    });
    if (!result.success) {
      console.error('[PayKeeper webhook] process_failed', { orderid, error: result.error });
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.process_failed',
        status: 'error',
        orderNumber: orderid,
        message: result.error ?? 'processPaidOrder failed',
      });
      notifyAdminsTelegramAsync('paykeeper_webhook_error', [
        `Заказ: ${orderid}`,
        `Ошибка: ${result.error ?? 'processPaidOrder failed'}`,
      ]);
      return NextResponse.json({ error: result.error ?? 'Processing failed' }, { status: 500 });
    }

    if (result.warnings?.length) {
      console.warn('[PayKeeper webhook] ok_with_warnings', { orderid, warnings: result.warnings });
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.ok_with_warnings',
        status: 'warning',
        orderNumber: orderid,
        message: 'Оплата обработана с предупреждениями',
        payload: { warnings: result.warnings },
      });
      // Предупреждение здесь — это не мелочь: сюда попадают «активный товар не
      // найден» (клиент оплатил, зачисления нет вообще) и «не удалось отправить
      // письмо со ссылкой на установку пароля» (клиент не может войти). Раньше
      // след оставался только в логе интеграции, который надо открыть руками, а
      // PayKeeper получал 200 и повторов не делал — то есть об этом не узнавал
      // никто, пока не напишет сам клиент.
      notifyAdminsTelegramAsync('paykeeper_webhook_error', [
        `Оплата прошла, но требует внимания. Заказ: ${orderid}`,
        `Зачисление: ${result.enrollmentCreated ? 'да' : 'НЕТ'}`,
        ...result.warnings.map((w) => `· ${w}`),
      ]);
    }
    console.info('[PayKeeper webhook] ok', {
      orderid,
      enrollmentCreated: result.enrollmentCreated,
      emailKind: result.emailKind,
    });
    await writePaykeeperIntegrationLog({
      direction: 'inbound',
      event: 'webhook.ok',
      status: 'success',
      orderNumber: orderid,
      message: 'OK + processPaidOrder',
      payload: {
        paykeeperId: id,
        enrollmentCreated: result.enrollmentCreated,
        emailKind: result.emailKind,
        alreadyPaid: result.alreadyPaid,
      },
    });
    return new NextResponse(buildPayKeeperWebhookResponse(id, secret), {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    await writePaykeeperIntegrationLog({
      direction: 'inbound',
      event: 'webhook.exception',
      status: 'error',
      message: error instanceof Error ? error.message : 'Webhook processing failed',
    });
    notifyAdminsTelegramAsync('paykeeper_webhook_error', [
      `Исключение: ${error instanceof Error ? error.message : 'Webhook processing failed'}`,
    ]);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
