// Phase 19 — Notification Scheduler Worker
// Runs as a cron job (every 30s) to process scheduled notifications
// Usage: npx tsx scripts/notification-scheduler.ts

import { PrismaClient } from "@prisma/client";
import { resolvePriority } from "../lib/notification-events";
import { logger } from "../lib/logger";

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

interface ScheduledNotification {
  id: string;
  title: string;
  message: string;
  audience: string;
  channel: string;
  priority: string;
  scheduledAt: Date;
  targetBatchId?: string | null;
  targetStudentId?: string | null;
  targetFacultyId?: string | null;
  targetUserId?: string | null;
  templateKey?: string | null;
  idempotencyKey?: string | null;
  requestedChannels: string[];
}

async function getDueNotifications(): Promise<ScheduledNotification[]> {
  const now = new Date();
  return prisma.notification.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now },
    },
    take: 50,
    orderBy: { scheduledAt: "asc" },
  }) as Promise<ScheduledNotification[]>;
}

async function getRecipients(notification: ScheduledNotification): Promise<Array<{ id: string; type: "USER" | "STUDENT" | "FACULTY"; phone?: string; pushEndpoint?: string }>> {
  const recipients: Array<{ id: string; type: "USER" | "STUDENT" | "FACULTY"; phone?: string; pushEndpoint?: string }> = [];

  switch (notification.audience) {
    case "ALL_STUDENTS": {
      const students = await prisma.student.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, phone: true, userId: true },
      });
      for (const s of students) {
        recipients.push({ id: s.id, type: "STUDENT", phone: s.phone || undefined });
        if (s.userId) {
          const subs = await prisma.pushSubscription.findMany({ where: { userId: s.userId } });
          for (const sub of subs) {
            recipients.push({ id: s.id, type: "STUDENT", pushEndpoint: sub.endpoint });
          }
        }
      }
      break;
    }
    case "FACULTY": {
      const faculty = await prisma.faculty.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, phone: true, userId: true },
      });
      for (const f of faculty) {
        recipients.push({ id: f.id, type: "FACULTY", phone: f.phone || undefined });
        if (f.userId) {
          const subs = await prisma.pushSubscription.findMany({ where: { userId: f.userId } });
          for (const sub of subs) {
            recipients.push({ id: f.id, type: "FACULTY", pushEndpoint: sub.endpoint });
          }
        }
      }
      break;
    }
    case "BATCH": {
      if (notification.targetBatchId) {
        const students = await prisma.student.findMany({
          where: { batchId: notification.targetBatchId, status: "ACTIVE" },
          select: { id: true, phone: true, userId: true },
        });
        for (const s of students) {
          recipients.push({ id: s.id, type: "STUDENT", phone: s.phone || undefined });
          if (s.userId) {
            const subs = await prisma.pushSubscription.findMany({ where: { userId: s.userId } });
            for (const sub of subs) {
              recipients.push({ id: s.id, type: "STUDENT", pushEndpoint: sub.endpoint });
            }
          }
        }
      }
      break;
    }
    case "INDIVIDUAL": {
      if (notification.targetStudentId) {
        const student = await prisma.student.findUnique({
          where: { id: notification.targetStudentId },
          select: { id: true, phone: true, userId: true },
        });
        if (student) {
          recipients.push({ id: student.id, type: "STUDENT", phone: student.phone || undefined });
          if (student.userId) {
            const subs = await prisma.pushSubscription.findMany({ where: { userId: student.userId } });
            for (const sub of subs) {
              recipients.push({ id: student.id, type: "STUDENT", pushEndpoint: sub.endpoint });
            }
          }
        }
      }
      if (notification.targetFacultyId) {
        const faculty = await prisma.faculty.findUnique({
          where: { id: notification.targetFacultyId },
          select: { id: true, phone: true, userId: true },
        });
        if (faculty) {
          recipients.push({ id: faculty.id, type: "FACULTY", phone: faculty.phone || undefined });
          if (faculty.userId) {
            const subs = await prisma.pushSubscription.findMany({ where: { userId: faculty.userId } });
            for (const sub of subs) {
              recipients.push({ id: faculty.id, type: "FACULTY", pushEndpoint: sub.endpoint });
            }
          }
        }
      }
      if (notification.targetUserId) {
        const user = await prisma.user.findUnique({
          where: { id: notification.targetUserId },
          select: { id: true, phone: true },
        });
        if (user) {
          recipients.push({ id: user.id, type: "USER", phone: user.phone || undefined });
          const subs = await prisma.pushSubscription.findMany({ where: { userId: user.id } });
          for (const sub of subs) {
            recipients.push({ id: user.id, type: "USER", pushEndpoint: sub.endpoint });
          }
        }
      }
      break;
    }
  }

  return recipients;
}

async function createDeliveryRows(
  notificationId: string,
  recipients: Array<{ id: string; type: string }>,
  channels: string[],
  priority: string
) {
  const now = new Date();
  for (const recipient of recipients) {
    for (const channel of channels) {
      const recipientKey = `${recipient.type.toLowerCase()}:${recipient.id}`;
      await prisma.notificationDelivery.upsert({
        where: {
          notificationId_channel_recipientKey: {
            notificationId,
            channel: channel as any,
            recipientKey,
          },
        },
        create: {
          notificationId,
          userId: recipient.type === "USER" ? recipient.id : null,
          studentId: recipient.type === "STUDENT" ? recipient.id : null,
          facultyId: recipient.type === "FACULTY" ? recipient.id : null,
          recipientKey,
          channel: channel as any,
          status: "CREATED",
          priority: priority as any,
          provider: channel === "IN_APP" ? "IN_APP" : channel === "SMS" ? "MSG91" : "WEB_PUSH",
        },
        update: {},
      });
    }
  }
}

async function dispatchInApp(notificationId: string, notification: ScheduledNotification, recipients: Array<{ id: string; type: string }>) {
  for (const recipient of recipients) {
    try {
      await prisma.notificationDelivery.updateMany({
        where: {
          notificationId,
          channel: "IN_APP",
          recipientKey: `${recipient.type.toLowerCase()}:${recipient.id}`,
        },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          provider: "IN_APP",
        },
      });

      if (recipient.type === "STUDENT") {
        await prisma.notification.create({
          data: {
            title: notification.title,
            message: notification.message,
            type: "in_app",
            audience: "INDIVIDUAL",
            channel: "IN_APP",
            priority: notification.priority as any,
            targetStudentId: recipient.id,
            status: "SENT",
            sentAt: new Date(),
          },
        });
      } else if (recipient.type === "FACULTY") {
        await prisma.notification.create({
          data: {
            title: notification.title,
            message: notification.message,
            type: "in_app",
            audience: "INDIVIDUAL",
            channel: "IN_APP",
            priority: notification.priority as any,
            targetFacultyId: recipient.id,
            status: "SENT",
            sentAt: new Date(),
          },
        });
      } else if (recipient.type === "USER") {
        await prisma.notification.create({
          data: {
            title: notification.title,
            message: notification.message,
            type: "in_app",
            audience: "INDIVIDUAL",
            channel: "IN_APP",
            priority: notification.priority as any,
            targetUserId: recipient.id,
            status: "SENT",
            sentAt: new Date(),
          },
        });
      }
    } catch (error) {
      await prisma.notificationDelivery.updateMany({
        where: {
          notificationId,
          channel: "IN_APP",
          recipientKey: `${recipient.type.toLowerCase()}:${recipient.id}`,
        },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorCode: "IN_APP_CREATE_FAILED",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }
}

async function dispatchSMS(notificationId: string, notification: ScheduledNotification, recipients: Array<{ id: string; type: string; phone?: string }>) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID;
  const templateId = notification.templateKey ? process.env[`MSG91_FLOW_ID_${notification.templateKey}`] : undefined;

  if (!authKey || !senderId) {
    for (const recipient of recipients) {
      await prisma.notificationDelivery.updateMany({
        where: {
          notificationId,
          channel: "SMS",
          recipientKey: `${recipient.type.toLowerCase()}:${recipient.id}`,
        },
        data: {
          status: "SKIPPED",
          errorCode: "SMS_NOT_CONFIGURED",
          errorMessage: "MSG91 credentials not configured",
        },
      });
    }
    return;
  }

  for (const recipient of recipients) {
    if (!recipient.phone) {
      await prisma.notificationDelivery.updateMany({
        where: {
          notificationId,
          channel: "SMS",
          recipientKey: `${recipient.type.toLowerCase()}:${recipient.id}`,
        },
        data: {
          status: "SKIPPED",
          errorCode: "NO_PHONE_NUMBER",
          errorMessage: "Recipient has no phone number",
        },
      });
      continue;
    }

    try {
      const flowId = templateId || process.env.MSG91_FLOW_ID_ADMIN_ANNOUNCEMENT;
      const variables = { title: notification.title, message: notification.message };

      const response = await fetch("https://control.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authkey: authKey,
        },
        body: JSON.stringify({
          flow_id: flowId,
          sender: senderId,
          mobiles: recipient.phone.replace(/^\+91/, ""),
          VAR1: variables.title,
          VAR2: variables.message,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok && (result.type === "success" || result.message === "success")) {
        await prisma.notificationDelivery.updateMany({
          where: {
            notificationId,
            channel: "SMS",
            recipientKey: `${recipient.type.toLowerCase()}:${recipient.id}`,
          },
          data: {
            status: "SENT",
            sentAt: new Date(),
            providerMessageId: result.request_id || result.message_id,
            provider: "MSG91",
          },
        });
      } else {
        await prisma.notificationDelivery.updateMany({
          where: {
            notificationId,
            channel: "SMS",
            recipientKey: `${recipient.type.toLowerCase()}:${recipient.id}`,
          },
          data: {
            status: "FAILED",
            failedAt: new Date(),
            errorCode: "SMS_PROVIDER_ERROR",
            errorMessage: result.message || "SMS send failed",
            retryable: true,
          },
        });
      }
    } catch (error) {
      await prisma.notificationDelivery.updateMany({
        where: {
          notificationId,
          channel: "SMS",
          recipientKey: `${recipient.type.toLowerCase()}:${recipient.id}`,
        },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorCode: "SMS_EXCEPTION",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          retryable: true,
        },
      });
    }
  }
}

async function dispatchPush(notificationId: string, notification: ScheduledNotification, recipients: Array<{ id: string; type: string; pushEndpoint?: string }>) {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (!vapidPublicKey || !vapidPrivateKey) {
    for (const recipient of recipients) {
      await prisma.notificationDelivery.updateMany({
        where: {
          notificationId,
          channel: "PUSH",
          recipientKey: `${recipient.type.toLowerCase()}:${recipient.id}`,
        },
        data: {
          status: "SKIPPED",
          errorCode: "PUSH_NOT_CONFIGURED",
          errorMessage: "VAPID keys not configured",
        },
      });
    }
    return;
  }

  for (const recipient of recipients) {
    if (!recipient.pushEndpoint) {
      await prisma.notificationDelivery.updateMany({
        where: {
          notificationId,
          channel: "PUSH",
          recipientKey: `${recipient.type.toLowerCase()}:${recipient.id}`,
        },
        data: {
          status: "SKIPPED",
          errorCode: "NO_PUSH_SUBSCRIPTION",
          errorMessage: "Recipient has no push subscription",
        },
      });
      continue;
    }

    try {
      const webpush = await import("web-push");
      webpush.default.setVapidDetails("mailto:admin@neuronacademy.in", vapidPublicKey, vapidPrivateKey);

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.message,
        icon: "/icon-192.png",
        badge: "/badge-72.png",
        data: { url: "/student/notifications" },
      });

      await webpush.default.sendNotification(
        { endpoint: recipient.pushEndpoint, keys: { p256dh: "", auth: "" } },
        payload
      );

      await prisma.notificationDelivery.updateMany({
        where: {
          notificationId,
          channel: "PUSH",
          recipientKey: `${recipient.type.toLowerCase()}:${recipient.id}`,
        },
        data: {
          status: "SENT",
          sentAt: new Date(),
          provider: "WEB_PUSH",
        },
      });
    } catch (error) {
      await prisma.notificationDelivery.updateMany({
        where: {
          notificationId,
          channel: "PUSH",
          recipientKey: `${recipient.type.toLowerCase()}:${recipient.id}`,
        },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorCode: "PUSH_PROVIDER_ERROR",
          errorMessage: error instanceof Error ? error.message : "Push send failed",
          retryable: true,
        },
      });
    }
  }
}

async function processNotification(notification: ScheduledNotification) {
  const runLogger = logger.child({ notificationId: notification.id, correlationId: `sched-${notification.id}` });
  runLogger.info("Processing scheduled notification", { scheduledAt: notification.scheduledAt });

  try {
    await prisma.notificationSchedulerRun.create({
      data: {
        notificationId: notification.id,
        runAt: notification.scheduledAt,
        status: "PROCESSING",
      },
    });

    const recipients = await getRecipients(notification);
    const channels = notification.requestedChannels.length > 0 ? notification.requestedChannels : [notification.channel];

    await createDeliveryRows(notification.id, recipients, channels, notification.priority);

    await Promise.all([
      channels.includes("IN_APP") && dispatchInApp(notification.id, notification, recipients),
      channels.includes("SMS") && dispatchSMS(notification.id, notification, recipients),
      channels.includes("PUSH") && dispatchPush(notification.id, notification, recipients),
    ]);

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });

    await prisma.notificationSchedulerRun.updateMany({
      where: { notificationId: notification.id, runAt: notification.scheduledAt },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    runLogger.info("Notification processed successfully", { recipientCount: recipients.length, channels });
  } catch (error) {
    runLogger.error("Failed to process notification", { error });

    await prisma.notificationSchedulerRun.updateMany({
      where: { notificationId: notification.id, runAt: notification.scheduledAt },
      data: {
        status: "FAILED",
        lastError: error instanceof Error ? error.message : "Unknown error",
        attempts: { increment: 1 },
      },
    });
  }
}

async function main() {
  const correlationId = `scheduler-${Date.now()}`;
  const runLogger = logger.withCorrelationId(correlationId);

  runLogger.info("Notification scheduler started");

  try {
    const due = await getDueNotifications();
    runLogger.info("Found due notifications", { count: due.length });

    for (const notification of due) {
      await processNotification(notification);
    }

    runLogger.info("Notification scheduler completed");
  } catch (error) {
    runLogger.error("Notification scheduler failed", { error });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();