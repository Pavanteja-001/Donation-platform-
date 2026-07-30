-- CreateIndex
-- Supports the retention sweep in lib/notificationRetention.ts, which selects by age across all
-- recipients. The existing (recipientId, createdAt) index cannot serve it: recipientId leads.
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
