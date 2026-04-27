-- Lead ↔ Order (1.3): link paid order to lead by email for analytics
ALTER TABLE "Lead" ADD COLUMN "lastOrderNumber" TEXT;
