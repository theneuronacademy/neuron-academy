// Phase 13 — centralized in-app notification helper (server-side, Prisma).
// Routes call safeNotify — it NEVER throws, so notification creation can
// never break the main transaction (publish, grant, submit, revoke).

import type { PrismaClient } from "@prisma/client";

type Db = PrismaClient;

export interface NotifyInput {
  title: string;
  message: string;
  type?: string;
  audience?: "ALL_STUDENTS" | "BATCH" | "FACULTY" | "INDIVIDUAL";
  channel?: "IN_APP" | "WEB_PUSH" | "MOBILE_PUSH";
  targetStudentId?: string;
  targetBatchId?: string;
  targetFacultyId?: string;
  targetUserId?: string;
  testId?: string;
  createdById?: string;
}

/** Create a SENT in-app notification. Returns the id or null. Never throws. */
export async function safeNotify(db: Db, input: NotifyInput): Promise<string | null> {
  try {
    const row = await db.notification.create({
      data: {
        title: input.title.slice(0, 120),
        message: input.message.slice(0, 1000),
        type: (input.type ?? "general").slice(0, 40),
        audience: input.audience ?? "INDIVIDUAL",
        channel: input.channel ?? "IN_APP",
        targetStudentId: input.targetStudentId,
        targetBatchId: input.targetBatchId,
        targetFacultyId: input.targetFacultyId,
        targetUserId: input.targetUserId,
        testId: input.testId,
        createdById: input.createdById,
        sentAt: new Date(),
        status: "SENT",
      },
      select: { id: true },
    });
    return row.id;
  } catch {
    return null;
  }
}

/** Message builders — keep wording consistent across routes. */
export const notifyMessages = {
  freeTestPublished: (title: string) => ({
    title: "New scholarship test available",
    message: `${title} is now available. Open Scholarship Tests to start.`,
    type: "test",
  }),
  accessGranted: (title: string) => ({
    title: "Test access granted",
    message: `You have been granted access to ${title}. You can start the test now.`,
    type: "access",
  }),
  accessRevoked: (title: string) => ({
    title: "Test access revoked",
    message: `Your access to ${title} has been revoked. Contact the academy office for help.`,
    type: "access",
  }),
  resultReleased: (title: string, marks: number, total: number, pct: number) => ({
    title: "Your test result is available",
    message: `${title}: ${marks}/${total} (${pct}%). Open the result to review.`,
    type: "result",
  }),
};
