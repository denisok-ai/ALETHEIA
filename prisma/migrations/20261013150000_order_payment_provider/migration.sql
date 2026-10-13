-- Провайдер онлайн-оплаты заказа (ЮKassa рядом с PayKeeper).
--
-- Только ADD COLUMN, оба поля nullable: существующие заказы PayKeeper не меняются
-- (NULL = PayKeeper). Order.userId этой миграцией не затрагивается — он по-прежнему
-- ставится только вместе с зачислением.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "paymentProvider" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "providerPaymentId" TEXT;
