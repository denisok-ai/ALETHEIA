-- Ticket ↔ Order (7.4): при обращении «Нет доступа» привязка заказа
ALTER TABLE "Ticket" ADD COLUMN "orderNumber" TEXT;
