// Phase 5 — API-first test service layer.
// UI calls these — never /api/* directly, never Prisma, never localStorage.
// Every function degrades honestly without a database:
// - reads → null (caller keeps the localStorage engine)
// - writes → { ok: false, reason } (caller keeps local behaviour)
// No database queries inside React components.

export type TestAccessType = "FREE" | "PAID" | "PRIVATE";

export interface TestAccessState {
  accessType: TestAccessType;
  price: number;
  hasAccess: boolean;
  locked: boolean;
  lockReason: string | null;
}

export interface ApiTest {
  id: string;
  title: string;
  description: string | null;
  batchId: string | null;
  type: "LIVE" | "OFFLINE" | "PRACTICE";
  duration: number;
  totalQuestions: number;
  totalMarks: number;
  startTime: string | null;
  endTime: string | null;
  status: "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "PUBLISHED";
  questionOrder?: "SERIAL" | "RANDOM";
  optionOrder?: "SERIAL" | "RANDOM";
  // Phase 13 — access model (present on API-backed tests).
  accessType?: TestAccessType;
  price?: number;
  access?: TestAccessState;
}

export interface TestAccessRecord {
  id: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  grantedAt: string;
  expiresAt: string | null;
  test: { id: string; title: string; accessType: TestAccessType; price: number; status: string };
  student: { id: string; name: string; phone: string; email: string };
}

export interface ApiQuestion {
  id: string;
  testId: string;
  questionText: string;
  questionType: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  optionE?: string | null;
  marks: number;
  negativeMarks: number;
  order: number;
}

export interface SubmitSummary {
  id: string;
  marks: number;
  totalMarks: number;
  percentage: number;
  attempted: number;
  correct: number;
  wrong: number;
  unanswered: number;
  pending: number;
}

async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    if (typeof window === "undefined") return null;
    const res = await fetch(path, { cache: "no-store", ...init, headers: { "Content-Type": "application/json" } });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || json.success !== true) return null;
    return (json.data ?? null) as T | null;
  } catch {
    return null;
  }
}

// ---- Tests ----
export async function getTests(): Promise<ApiTest[] | null> {
  const data = await call<{ items: ApiTest[] }>("/api/tests");
  return data && Array.isArray(data.items) ? data.items : null;
}

export async function getTest(id: string): Promise<ApiTest | null> {
  const data = await call<{ item: ApiTest }>(`/api/tests/${id}`);
  return data?.item ?? null;
}

export async function createTest(input: Partial<ApiTest> & { title: string }): Promise<{ ok: boolean; id?: string; reason?: string }> {
  try {
    if (typeof window === "undefined") return { ok: false, reason: "unavailable" };
    const res = await fetch("/api/tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    if (!res.ok) return { ok: false, reason: res.status === 503 ? "no-database" : `http-${res.status}` };
    const json = await res.json();
    return json?.success === true && json.data?.item?.id ? { ok: true, id: json.data.item.id } : { ok: false, reason: "bad-response" };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function updateTest(id: string, patch: Partial<ApiTest>): Promise<boolean> {
  const data = await call<{ item: ApiTest }>(`/api/tests/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  return !!data?.item;
}

export async function deleteTest(id: string): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false;
    const res = await fetch(`/api/tests/${id}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- Questions ----
export async function getQuestions(testId?: string): Promise<ApiQuestion[] | null> {
  const data = await call<{ items: ApiQuestion[] }>(testId ? `/api/questions?testId=${encodeURIComponent(testId)}` : "/api/questions");
  return data && Array.isArray(data.items) ? data.items : null;
}

export async function createQuestion(input: Record<string, unknown>): Promise<{ ok: boolean; id?: string }> {
  try {
    if (typeof window === "undefined") return { ok: false };
    const res = await fetch("/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    if (!res.ok) return { ok: false };
    const json = await res.json();
    return json?.success === true && json.data?.item?.id ? { ok: true, id: json.data.item.id } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function updateQuestion(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const data = await call<{ item: ApiQuestion }>(`/api/questions/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  return !!data?.item;
}

export async function deleteQuestion(id: string): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false;
    const res = await fetch(`/api/questions/${id}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- Attempts (student) ----
export async function startAttempt(testId: string): Promise<{ ok: boolean; attemptId?: string; resumed?: boolean; reason?: string }> {
  try {
    if (typeof window === "undefined") return { ok: false, reason: "unavailable" };
    const res = await fetch(`/api/tests/${encodeURIComponent(testId)}/attempt`, { method: "POST" });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.success !== true) return { ok: false, reason: json?.error ?? `http-${res.status}` };
    return { ok: true, attemptId: json.data?.attempt?.id, resumed: !!json.data?.resumed };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function submitAttempt(
  testId: string,
  attemptId: string | null,
  answers: Record<string, string | number | null>
): Promise<{ ok: boolean; summary?: SubmitSummary; reason?: string }> {
  try {
    if (typeof window === "undefined") return { ok: false, reason: "unavailable" };
    const res = await fetch(`/api/tests/${encodeURIComponent(testId)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, answers }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.success !== true) return { ok: false, reason: json?.error ?? `http-${res.status}` };
    return { ok: true, summary: json.data?.result };
  } catch {
    return { ok: false, reason: "network" };
  }
}

// ---- Results ----
export async function getResults(testId?: string): Promise<Record<string, unknown>[] | null> {
  const data = await call<{ items: Record<string, unknown>[] }>(testId ? `/api/results?testId=${encodeURIComponent(testId)}` : "/api/results");
  return data && Array.isArray(data.items) ? data.items : null;
}

export async function getStudentResults(testId?: string): Promise<Record<string, unknown>[] | null> {
  return getResults(testId);
}

export async function enterOfflineMarks(input: { studentId: string; testId: string; marks: number }): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (typeof window === "undefined") return { ok: false, reason: "unavailable" };
    const res = await fetch("/api/results/offline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.success !== true) return { ok: false, reason: json?.error ?? `http-${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export interface ImportSummary {
  id: string;
  filename: string;
  status: string;
  totalPages: number;
  textPages: number;
  ocrPages: number;
  error: string | null;
}

export interface ImportStats {
  detected: number;
  high: number;
  needsReview: number;
  withAnswer: number;
  missingAnswer: number;
  pages: number;
}

export async function uploadPdfImport(
  file: File,
  opts?: { batchId?: string; title?: string; subject?: string }
): Promise<{ ok: boolean; import?: ImportSummary; stagingTestId?: string; stats?: ImportStats; issues?: string[]; reason?: string }> {
  try {
    if (typeof window === "undefined") return { ok: false, reason: "unavailable" };
    const form = new FormData();
    form.append("file", file);
    if (opts?.batchId) form.append("batchId", opts.batchId);
    if (opts?.title) form.append("title", opts.title);
    if (opts?.subject) form.append("subject", opts.subject);
    const res = await fetch("/api/tests/import/pdf", { method: "POST", body: form });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.success !== true) return { ok: false, reason: json?.error ?? `http-${res.status}` };
    return { ok: true, import: json.data.import, stagingTestId: json.data.stagingTestId, stats: json.data.stats, issues: json.data.issues ?? [] };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function generateFromPool(input: {
  title: string;
  description?: string;
  batchId?: string;
  type?: string;
  duration?: number;
  count?: number;
  sourceTestIds: string[];
  selectionMode: "MANUAL" | "RANDOM" | "SERIAL";
  questionIds?: string[];
  questionOrder?: "SERIAL" | "RANDOM";
  optionOrder?: "SERIAL" | "RANDOM";
}): Promise<{ ok: boolean; id?: string; reason?: string }> {
  try {
    if (typeof window === "undefined") return { ok: false, reason: "unavailable" };
    const res = await fetch("/api/tests/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.success !== true) return { ok: false, reason: json?.error ?? `http-${res.status}` };
    return { ok: true, id: json.data?.item?.id };
  } catch {
    return { ok: false, reason: "network" };
  }
}
