// Business logic for tests — components call these, never localStorage.
// Phase 7 cutover: local engine stays primary in demo mode; when PostgreSQL
// is live each op also mirrors to /api/tests (fire-and-forget, remoteId
// link). Failures never break the local flow.
import { deleteTest as deleteLocalTest, getTestById, getTests, nowISO, saveNotification, saveTest, uid, updateTest } from "@/lib/storage";
import type { TestItem, TestStatus } from "@/lib/testTypes";

const STATUS_TO_API: Record<string, string> = {
  draft: "DRAFT",
  scheduled: "SCHEDULED",
  published: "PUBLISHED",
  live: "LIVE",
  completed: "COMPLETED",
  archived: "DRAFT",
};

async function mirrorCreate(t: {
  name: string;
  description: string;
  durationMinutes: number;
  status: string;
  startAt: string;
  endAt: string;
}): Promise<string | null> {
  try {
    if (typeof window === "undefined") return null;
    const res = await fetch("/api/tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t.name,
        description: t.description,
        duration: t.durationMinutes,
        status: STATUS_TO_API[t.status] ?? "DRAFT",
        startTime: t.startAt || undefined,
        endTime: t.endAt || undefined,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return json?.success === true && json.data?.item?.id ? String(json.data.item.id) : null;
  } catch {
    return null;
  }
}

async function mirrorStatus(remoteId: string, status: string): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    await fetch(`/api/tests/${encodeURIComponent(remoteId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: STATUS_TO_API[status] ?? "DRAFT" }),
    }).catch(() => null);
  } catch {
    /* demo mode */
  }
}

async function mirrorDelete(remoteId: string): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    await fetch(`/api/tests/${encodeURIComponent(remoteId)}`, { method: "DELETE" }).catch(() => null);
  } catch {
    /* demo mode */
  }
}

export function createDraftTest(input: Partial<TestItem> & { name: string }): TestItem {
  const t: TestItem = {
    id: uid("test"),
    name: input.name,
    description: input.description ?? "",
    subject: input.subject ?? "Quantitative Aptitude",
    chapter: input.chapter ?? "Percentage",
    questionIds: input.questionIds ?? [],
    durationMinutes: input.durationMinutes ?? 20,
    marksPerQuestion: input.marksPerQuestion ?? 2,
    negativeMarks: input.negativeMarks ?? 0.5,
    difficulty: input.difficulty ?? "Mixed",
    status: "draft",
    startAt: input.startAt ?? "",
    endAt: input.endAt ?? "",
    createdBy: input.createdBy ?? "ADMIN-001",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    source: input.source ?? "manual",
  };
  saveTest(t);
  // Cutover: mirror to PostgreSQL when live; link via remoteId.
  try {
    void mirrorCreate(t).then((remoteId) => {
      if (remoteId) updateTest(t.id, { remoteId });
    });
  } catch {
    /* demo mode */
  }
  return t;
}

export function duplicateTest(id: string): TestItem | null {
  const t = getTestById(id);
  if (!t) return null;
  const copy: TestItem = {
    ...t,
    id: uid("test"),
    name: `${t.name} (Copy)`,
    status: "draft",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  saveTest(copy);
  return copy;
}

export function publishTest(id: string): TestItem | null {
  const t = updateTest(id, { status: "published" });
  if (t) {
    if (t.remoteId) void mirrorStatus(t.remoteId, "published");
    saveNotification({
      id: uid("notif"),
      title: "New Test Available",
      message: `${t.name} is now available.`,
      type: "test",
      target: "students",
      testId: t.id,
      createdAt: nowISO(),
      read: false,
    });
  }
  return t;
}

/** Derive live display status from dates where possible. */
export function deriveStatus(t: TestItem): TestStatus {
  if (t.status === "draft" || t.status === "archived") return t.status;
  const now = Date.now();
  const start = t.startAt ? Date.parse(t.startAt) : NaN;
  const end = t.endAt ? Date.parse(t.endAt) : NaN;
  if (!Number.isNaN(start) && now < start) return "scheduled";
  if (!Number.isNaN(end) && now > end) return "completed";
  if (t.status === "published") return "live";
  return t.status;
}

export function visibleToStudents(t: TestItem): boolean {
  return ["published", "live", "scheduled"].includes(t.status);
}

export function deleteTest(id: string): void {
  const t = getTestById(id);
  deleteLocalTest(id);
  if (t?.remoteId) void mirrorDelete(t.remoteId);
}

export { getTestById, getTests, updateTest };
