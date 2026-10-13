/**
 * Персональный товар (ссылка на оплату, personal-*): после оплаты помечаем ссылку
 * оплаченной, шлём уведомление админам, создаём/обновляем лид и письмо клиенту.
 * Общая логика вебхуков PayKeeper и ЮKassa; для заказа без ссылки ничего не делает.
 */
import { prisma } from '@/lib/db';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';
import { writePaykeeperIntegrationLog } from '@/lib/paykeeper-integration-log';
import { sendTransactionalEmail } from '@/lib/email-service';

export async function markPaymentLinkPaidForOrder(orderid: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { orderNumber: orderid }, select: { id: true } });
  if (!order) return;
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
