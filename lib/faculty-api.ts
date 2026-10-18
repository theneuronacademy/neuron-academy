// Faculty API Service Layer - Centralized typed API calls
// Replaces scattered fetch() calls across faculty pages

import type {
  BatchDetail,
  StudentRow,
  AttendanceRecord,
  TestRow,
  ResultRow,
  AnalyticsRow,
  DashboardStats,
  FacultyProfile,
  DoubtItem,
  NotificationItem,
  TimetableEntry,
} from "@/types/faculty";

const API_BASE = "/api/faculty";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    cache: "no-store",
  });

  if (res.status === 401) {
    window.location.href = "/faculty/login";
    throw new Error("Unauthorized");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new Error(data?.error ?? "Request failed");
  }
  return data.data as T;
}

// ============ Batches ============
export async function getFacultyBatches(): Promise<BatchDetail[]> {
  return fetchJson<{ items: BatchDetail[] }>(`${API_BASE}/batches`).then((d) => d.items);
}

export async function getFacultyBatch(id: string): Promise<BatchDetail | null> {
  const batches = await getFacultyBatches();
  return batches.find((b) => b.id === id) ?? null;
}

// ============ Students ============
export interface GetStudentsParams {
  batchId?: string;
  search?: string;
}

export async function getFacultyStudents(params: GetStudentsParams = {}): Promise<StudentRow[]> {
  const qs = new URLSearchParams();
  if (params.batchId) qs.set("batchId", params.batchId);
  if (params.search) qs.set("search", params.search);
  return fetchJson<{ items: StudentRow[] }>(`${API_BASE}/students?${qs.toString()}`).then((d) => d.items);
}

export async function getFacultyStudent(id: string): Promise<{
  student: StudentRow & { batch: { id: string; name: string } | null };
  results: ResultRow[];
  attendance: { PRESENT: number; ABSENT: number; LATE: number; LEAVE: number; total: number; percentage: number | null };
  attempts: { status: string; count: number }[];
  avgScore: number | null;
} | null> {
  try {
    return await fetchJson(`${API_BASE}/students/${id}`);
  } catch {
    return null;
  }
}

// ============ Attendance ============
export interface BulkAttendanceRequest {
  batchId: string;
  date: string; // YYYY-MM-DD
  records: Array<{ studentId: string; status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE" }>;
  source?: "MANUAL" | "BIOMETRIC";
}

export async function getAttendance(batchId: string, date: string): Promise<AttendanceRecord[]> {
  return fetchJson<{ records: AttendanceRecord[] }>(`/api/attendance?batchId=${encodeURIComponent(batchId)}&date=${encodeURIComponent(date)}`).then((d) => d.records);
}

export async function bulkSaveAttendance(payload: BulkAttendanceRequest): Promise<{ saved: number }> {
  return fetchJson<{ saved: number }>(`/api/attendance/bulk`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAttendanceHistory(batchId: string, studentId: string, month: string): Promise<AttendanceRecord[]> {
  return fetchJson<{ records: AttendanceRecord[] }>(`/api/attendance/history?batchId=${encodeURIComponent(batchId)}&studentId=${encodeURIComponent(studentId)}&month=${encodeURIComponent(month)}`).then((d) => d.records);
}

// ============ Tests ============
export interface CreateTestPayload {
  title: string;
  batchId?: string;
  type?: "LIVE" | "OFFLINE" | "PRACTICE";
  duration?: number;
  totalMarks?: number;
  startTime?: string;
  endTime?: string;
  isHomework?: boolean;
  accessType?: "FREE" | "PAID" | "PRIVATE";
  price?: number;
}

export async function getFacultyTests(): Promise<TestRow[]> {
  return fetchJson<{ items: TestRow[] }>("/api/tests").then((d) => d.items);
}

export async function createFacultyTest(payload: CreateTestPayload): Promise<TestRow> {
  return fetchJson<{ item: TestRow }>("/api/tests", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((d) => d.item);
}

export async function updateFacultyTest(id: string, payload: Partial<CreateTestPayload>): Promise<TestRow> {
  return fetchJson<{ item: TestRow }>(`/api/tests/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }).then((d) => d.item);
}

export async function deleteFacultyTest(id: string): Promise<void> {
  await fetchJson(`/api/tests/${id}`, { method: "DELETE" });
}

export async function getTestAnalysis(testId: string): Promise<{
  attempts: number;
  hardest: { order: number; questionText: string; correctPct: number | null } | null;
  items: Array<{
    order: number;
    questionText: string;
    subject: string | null;
    evaluable: boolean;
    correct: number;
    wrong: number;
    unattempted: number;
    total: number;
    correctPct: number | null;
  }>;
}> {
  return fetchJson(`/api/faculty/tests/${encodeURIComponent(testId)}/analysis`);
}

// ============ Results ============
export async function getFacultyResults(testId?: string): Promise<ResultRow[]> {
  const qs = testId ? `?testId=${encodeURIComponent(testId)}` : "";
  return fetchJson<{ items: ResultRow[] }>(`/api/results${qs}`).then((d) => d.items);
}

// ============ Analytics ============
export async function getFacultyAnalytics(): Promise<{
  rows: AnalyticsRow[];
  overall: { students: number; attendancePct: number | null; avgScore: number | null; testsTaken: number };
}> {
  return fetchJson(`${API_BASE}/analytics`);
}

// ============ Dashboard ============
export async function getDashboardStats(): Promise<DashboardStats> {
  return fetchJson(`${API_BASE}/dashboard`);
}

export async function getFacultyActivity(limit = 20): Promise<Array<{ id: string; text: string; time: string; type: string }>> {
  return fetchJson<{ items: Array<{ id: string; text: string; time: string; type: string }> }>(`${API_BASE}/activity?limit=${limit}`).then((d) => d.items);
}

// ============ Profile ============
export async function getFacultyProfile(): Promise<FacultyProfile> {
  return fetchJson(`${API_BASE}/me`);
}

export async function updateFacultyProfile(payload: Partial<FacultyProfile>): Promise<FacultyProfile> {
  return fetchJson<{ item: FacultyProfile }>(`${API_BASE}/me`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }).then((d) => d.item);
}

// ============ Doubts ============
export async function getFacultyDoubts(status?: string): Promise<DoubtItem[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return fetchJson<{ items: DoubtItem[] }>(`/api/doubts${qs}`).then((d) => d.items);
}

export async function replyToDoubt(doubtId: string, text: string): Promise<void> {
  await fetchJson(`/api/doubts/${encodeURIComponent(doubtId)}/replies`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

// ============ Notifications ============
export async function getFacultyNotifications(limit = 50): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  return fetchJson(`/api/notifications/mine?limit=${limit}`);
}

export async function markNotificationRead(id: string): Promise<void> {
  await fetchJson("/api/notifications/mine", {
    method: "PATCH",
    body: JSON.stringify({ id }),
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetchJson("/api/notifications/mine", {
    method: "PATCH",
    body: JSON.stringify({ all: true }),
  });
}

export interface AnnouncementPayload {
  batchId: string;
  title: string;
  message: string;
}

export async function createAnnouncement(payload: AnnouncementPayload): Promise<void> {
  await fetchJson(`${API_BASE}/announcements`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getFacultyAnnouncements(): Promise<Array<{ id: string; title: string; message: string; createdAt: string }>> {
  return fetchJson<{ items: Array<{ id: string; title: string; message: string; createdAt: string }> }>(`${API_BASE}/announcements`).then((d) => d.items);
}

// ============ Timetable ============
export async function getFacultyTimetable(): Promise<TimetableEntry[]> {
  return fetchJson<{ items: TimetableEntry[] }>("/api/timetable").then((d) => d.items);
}

// ============ Materials / Content (New) ============
export interface MaterialItem {
  id: string;
  title: string;
  subject: string;
  batchId: string;
  kind: "NOTE" | "VIDEO" | "LINK" | "PDF";
  url?: string;
  description?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export async function getFacultyMaterials(batchId?: string): Promise<MaterialItem[]> {
  const qs = batchId ? `?batchId=${encodeURIComponent(batchId)}` : "";
  return fetchJson<{ items: MaterialItem[] }>(`${API_BASE}/materials${qs}`).then((d) => d.items);
}

export async function createMaterial(payload: Omit<MaterialItem, "id" | "createdAt" | "updatedAt">): Promise<MaterialItem> {
  return fetchJson<{ item: MaterialItem }>(`${API_BASE}/materials`, {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((d) => d.item);
}

export async function updateMaterial(id: string, payload: Partial<MaterialItem>): Promise<MaterialItem> {
  return fetchJson<{ item: MaterialItem }>(`${API_BASE}/materials/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }).then((d) => d.item);
}

export async function deleteMaterial(id: string): Promise<void> {
  await fetchJson(`${API_BASE}/materials/${id}`, { method: "DELETE" });
}

// ============ Assignments (New) ============
export interface AssignmentItem {
  id: string;
  title: string;
  description: string;
  batchId: string;
  testId?: string;
  dueDate: string;
  maxMarks: number;
  weight: number; // for gradebook
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionItem {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  submittedAt: string;
  content?: string;
  fileUrl?: string;
  marks?: number;
  feedback?: string;
  status: "SUBMITTED" | "GRADED" | "LATE";
}

export async function getFacultyAssignments(batchId?: string): Promise<AssignmentItem[]> {
  const qs = batchId ? `?batchId=${encodeURIComponent(batchId)}` : "";
  return fetchJson<{ items: AssignmentItem[] }>(`${API_BASE}/assignments${qs}`).then((d) => d.items);
}

export async function createAssignment(payload: Omit<AssignmentItem, "id" | "createdAt" | "updatedAt">): Promise<AssignmentItem> {
  return fetchJson<{ item: AssignmentItem }>(`${API_BASE}/assignments`, {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((d) => d.item);
}

export async function getAssignmentSubmissions(assignmentId: string): Promise<SubmissionItem[]> {
  return fetchJson<{ items: SubmissionItem[] }>(`${API_BASE}/assignments/${assignmentId}/submissions`).then((d) => d.items);
}

export async function gradeSubmission(submissionId: string, marks: number, feedback: string): Promise<void> {
  await fetchJson(`${API_BASE}/assignments/submissions/${submissionId}/grade`, {
    method: "POST",
    body: JSON.stringify({ marks, feedback }),
  });
}

// ============ Gradebook (New) ============
export interface GradebookConfig {
  batchId: string;
  categories: Array<{
    id: string;
    name: string;
    weight: number; // percentage, sum = 100
    color: string;
  }>;
}

export interface GradebookEntry {
  studentId: string;
  studentName: string;
  categoryScores: Record<string, number>; // categoryId -> average percentage
  finalGrade: number;
  letterGrade: string;
}

export async function getGradebookConfig(batchId: string): Promise<GradebookConfig | null> {
  try {
    return await fetchJson(`${API_BASE}/gradebook/${batchId}/config`);
  } catch {
    return null;
  }
}

export async function saveGradebookConfig(config: GradebookConfig): Promise<GradebookConfig> {
  return fetchJson<{ config: GradebookConfig }>(`${API_BASE}/gradebook/${config.batchId}/config`, {
    method: "POST",
    body: JSON.stringify(config),
  }).then((d) => d.config);
}

export async function getGradebook(batchId: string): Promise<GradebookEntry[]> {
  return fetchJson<{ entries: GradebookEntry[] }>(`${API_BASE}/gradebook/${batchId}`).then((d) => d.entries);
}

export async function exportGradebook(batchId: string, format: "csv" | "pdf" = "csv"): Promise<Blob> {
  const res = await fetch(`${API_BASE}/gradebook/${batchId}/export?format=${format}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Export failed");
  return res.blob();
}

// ============ Parent Communication (New) ============
export interface ParentMessage {
  id: string;
  studentId: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  subject: string;
  message: string;
  sentAt: string;
  status: "SENT" | "DELIVERED" | "FAILED";
  channel: "SMS" | "EMAIL" | "IN_APP";
}

export async function getParentMessages(studentId?: string): Promise<ParentMessage[]> {
  const qs = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
  return fetchJson<{ items: ParentMessage[] }>(`${API_BASE}/parent-messages${qs}`).then((d) => d.items);
}

export async function sendParentMessage(payload: {
  studentId: string;
  subject: string;
  message: string;
  channel: "SMS" | "EMAIL" | "IN_APP";
}): Promise<void> {
  await fetchJson(`${API_BASE}/parent-messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendBulkParentReport(batchId: string, template: string): Promise<void> {
  await fetchJson(`${API_BASE}/parent-messages/bulk`, {
    method: "POST",
    body: JSON.stringify({ batchId, template }),
  });
}