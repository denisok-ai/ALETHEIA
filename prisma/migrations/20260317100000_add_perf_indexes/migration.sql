-- Add indexes for performance (300+ concurrent users audit)
-- VisitLog
CREATE INDEX IF NOT EXISTS "VisitLog_logoutAt_idx" ON "VisitLog"("logoutAt");

-- Profile
CREATE INDEX IF NOT EXISTS "Profile_role_idx" ON "Profile"("role");
CREATE INDEX IF NOT EXISTS "Profile_status_idx" ON "Profile"("status");

-- Enrollment
CREATE INDEX IF NOT EXISTS "Enrollment_courseId_idx" ON "Enrollment"("courseId");
CREATE INDEX IF NOT EXISTS "Enrollment_enrolledAt_idx" ON "Enrollment"("enrolledAt");

-- Certificate
CREATE INDEX IF NOT EXISTS "Certificate_courseId_idx" ON "Certificate"("courseId");
CREATE INDEX IF NOT EXISTS "Certificate_issuedAt_idx" ON "Certificate"("issuedAt");

-- Media
CREATE INDEX IF NOT EXISTS "Media_courseId_idx" ON "Media"("courseId");
CREATE INDEX IF NOT EXISTS "Media_category_idx" ON "Media"("category");

-- Notification
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");

-- Ticket
CREATE INDEX IF NOT EXISTS "Ticket_userId_idx" ON "Ticket"("userId");
CREATE INDEX IF NOT EXISTS "Ticket_status_idx" ON "Ticket"("status");
CREATE INDEX IF NOT EXISTS "Ticket_createdAt_idx" ON "Ticket"("createdAt");

-- AuditLog
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- Lead
CREATE INDEX IF NOT EXISTS "Lead_status_idx" ON "Lead"("status");
CREATE INDEX IF NOT EXISTS "Lead_createdAt_idx" ON "Lead"("createdAt");

-- Order
CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "Order"("userId");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");
CREATE INDEX IF NOT EXISTS "Order_paidAt_idx" ON "Order"("paidAt");
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");

-- Publication
CREATE INDEX IF NOT EXISTS "Publication_status_idx" ON "Publication"("status");
CREATE INDEX IF NOT EXISTS "Publication_publishAt_idx" ON "Publication"("publishAt");
