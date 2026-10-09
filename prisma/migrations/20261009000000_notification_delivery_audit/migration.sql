-- Phase 18c Step 3 — persistent delivery audit + idempotency + priority.
-- Additive only: new enums/columns/table/indexes. No existing table altered
-- destructively. Unapplied when Supabase is unreachable (see final report).
-- Delivery state machine: CREATED/QUEUED/PROCESSING/SENT/DELIVERED/FAILED/
-- RETRYING/SKIPPED. MSG91 acceptance = SENT (never DELIVERED). In-app
-- durable write = DELIVERED. Retry foundation only (no worker).

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('SMS', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('CREATED', 'QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DeliveryProvider" AS ENUM ('IN_APP', 'MSG91', 'WEB_PUSH');

-- AlterTable Notification: priority + requested channels + idempotency key
ALTER TABLE "Notification" ADD COLUMN "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Notification" ADD COLUMN "requestedChannels" "DeliveryChannel"[] NOT NULL DEFAULT ARRAY[]::"DeliveryChannel"[];
ALTER TABLE "Notification" ADD COLUMN "idempotencyKey" TEXT;

-- CreateTable NotificationDelivery (per-recipient per-channel audit; no OTP,
-- no secrets, no raw provider payload, no phone duplication)
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT,
    "studentId" TEXT,
    "facultyId" TEXT,
    "recipientKey" TEXT NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'CREATED',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "provider" "DeliveryProvider" NOT NULL DEFAULT 'IN_APP',
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: persistent idempotency (race-safe unique)
CREATE UNIQUE INDEX "Notification_idempotencyKey_key" ON "Notification"("idempotencyKey");

-- CreateIndex: targetFacultyId (faculty feed scope needs it)
CREATE INDEX "Notification_targetFacultyId_idx" ON "Notification"("targetFacultyId");

-- CreateIndex: event / priority / schedule filters for admin audit
CREATE INDEX "Notification_type_idx" ON "Notification"("type");
CREATE INDEX "Notification_priority_idx" ON "Notification"("priority");
CREATE INDEX "Notification_scheduledAt_idx" ON "Notification"("scheduledAt");

-- CreateIndex: delivery audit filters + race-safe dedup
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_channel_recipientKey_key" ON "NotificationDelivery"("notificationId", "channel", "recipientKey");
CREATE INDEX "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId");
CREATE INDEX "NotificationDelivery_channel_idx" ON "NotificationDelivery"("channel");
CREATE INDEX "NotificationDelivery_status_idx" ON "NotificationDelivery"("status");
CREATE INDEX "NotificationDelivery_priority_idx" ON "NotificationDelivery"("priority");
CREATE INDEX "NotificationDelivery_userId_idx" ON "NotificationDelivery"("userId");
CREATE INDEX "NotificationDelivery_recipientKey_idx" ON "NotificationDelivery"("recipientKey");
CREATE INDEX "NotificationDelivery_createdAt_idx" ON "NotificationDelivery"("createdAt");
CREATE INDEX "NotificationDelivery_retryable_idx" ON "NotificationDelivery"("retryable");
CREATE INDEX "NotificationDelivery_channel_status_idx" ON "NotificationDelivery"("channel", "status");
CREATE INDEX "NotificationDelivery_status_retryable_idx" ON "NotificationDelivery"("status", "retryable");

-- AddForeignKey: delivery -> notification (cascade cleanup on delete)
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: delivery -> user (audit identity, null on user delete)
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
