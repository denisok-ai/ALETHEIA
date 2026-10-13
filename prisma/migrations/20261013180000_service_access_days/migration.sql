-- Срок доступа к товару в днях (практикум «Тело знает всё» — 90 дней).
--
-- Только ADD COLUMN, поле nullable: существующие товары получают NULL = бессрочно,
-- то есть поведение не меняется. Enrollment.expiresAt выставляется при оплате
-- в processPaidOrder (и при восстановлении зачисления), здесь ничего не пересчитывается.

-- AlterTable
ALTER TABLE "Service" ADD COLUMN "accessDays" INTEGER;
