-- Заказ: ФИО клиента из формы оплаты (для писем вместо локальной части email)
ALTER TABLE "Order" ADD COLUMN "clientName" TEXT;
