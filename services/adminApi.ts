// Phase 3 — Admin service layer: API-first with demo fallback.
// - Reads try /api/* first; when the database is not configured (or the
//   request fails) they return /data/admin.ts demo data, so the UI never
//   crashes and the website keeps working.
// - Writes POST/PATCH/DELETE against /api/*; without a database they
//   resolve locally (previous demo behaviour) instead of throwing.
// UI must only import from this file — never from /data/admin directly
// (except types), so the backend swap touches one file.

import {
  DEMO_ACTIVITY,
  DEMO_ANNOUNCEMENTS,
  DEMO_ATTENDANCE_OVERVIEW,
  DEMO_BANNERS,
  DEMO_BATCHES,
  DEMO_ENQUIRIES,
  DEMO_FACULTY,
  DEMO_NOTIFICATIONS,
  DEMO_POPUPS,
  DEMO_STATS,
  DEMO_STUDENTS,
  DEMO_TESTS,
  DEMO_UPCOMING_TESTS,
  DEMO_WEBSITE_STATUS,
  type AdminBanner,
  type AdminBatch,
  type AdminEnquiry,
  type AdminFaculty,
  type AdminNotification,
  type AdminPopup,
  type AdminStudent,
  type AdminTest,
} from "@/data/admin";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** GET/POST helper — null on any failure (offline, no DB, bad shape). */
async function callApi<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    if (typeof window === "undefined") return null;
    const res = await fetch(path, {
      cache: "no-store",
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiEnvelope<T>;
    if (!json || json.success !== true || json.data === undefined) return null;
    return json.data;
  } catch {
    return null;
  }
}

/** API lists arrive as { items } — fall back to demo when anything is off. */
function unwrapItems<T>(data: { items?: unknown } | unknown, fallback: T[]): T[] {
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: T[] }).items;
  }
  return fallback;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAdminBanner(r: any): AdminBanner {
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    subtitle: String(r.subtitle ?? ""),
    description: String(r.description ?? ""),
    image: String(r.imageUrl ?? r.image ?? ""),
    videoUrl: String(r.videoUrl ?? ""),
    buttonText: String(r.buttonText ?? ""),
    buttonUrl: String(r.buttonUrl ?? ""),
    startDate: r.startDate ? new Date(r.startDate).toISOString().slice(0, 10) : "",
    endDate: r.endDate ? new Date(r.endDate).toISOString().slice(0, 10) : "",
    active: r.isActive ?? r.active ?? true,
    order: typeof r.displayOrder === "number" ? r.displayOrder : (r.order ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAdminPopup(r: any): AdminPopup {
  const f = String(r.frequency ?? "ONCE_PER_SESSION");
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    message: String(r.message ?? ""),
    image: String(r.imageUrl ?? r.image ?? ""),
    videoUrl: String(r.videoUrl ?? ""),
    buttonText: String(r.buttonText ?? ""),
    buttonUrl: String(r.buttonUrl ?? ""),
    frequency: f === "ONCE_PER_DAY" ? "once-per-day" : f === "EVERY_VISIT" ? "every-visit" : "once-per-session",
    startDate: r.startDate ? new Date(r.startDate).toISOString().slice(0, 10) : "",
    endDate: r.endDate ? new Date(r.endDate).toISOString().slice(0, 10) : "",
    active: r.isActive ?? r.active ?? true,
  };
}

function popupFrequencyFor(f: AdminPopup["frequency"]): string {
  if (f === "once-per-day") return "ONCE_PER_DAY";
  if (f === "every-visit") return "EVERY_VISIT";
  return "ONCE_PER_SESSION";
}

// ---- Dashboard (aggregates — demo until a stats endpoint lands) ----
export async function getDashboardStats() {
  // TODO backend: GET /api/stats (aggregate endpoint, Phase 4)
  return DEMO_STATS;
}
export async function getRecentActivity() {
  // TODO backend: GET /api/activity (audit log, Phase 4)
  return DEMO_ACTIVITY;
}
export async function getUpcomingTests(): Promise<AdminTest[]> {
  // TODO backend: GET /api/tests?upcoming=true
  return DEMO_UPCOMING_TESTS;
}
export async function getAttendanceOverview() {
  // TODO backend: GET /api/attendance/overview (aggregate, Phase 4)
  return DEMO_ATTENDANCE_OVERVIEW;
}
export async function getWebsiteStatus() {
  // TODO backend: derive from /api/health + banner/popup counts
  return DEMO_WEBSITE_STATUS;
}

// ---- Students ----
export async function getStudents(): Promise<AdminStudent[]> {
  const data = await callApi<{ items: AdminStudent[] }>("/api/students");
  return unwrapItems<AdminStudent>(data, DEMO_STUDENTS);
}
export async function createStudent(input: Omit<AdminStudent, "id">): Promise<AdminStudent> {
  const data = await callApi<{ item: AdminStudent }>("/api/students", {
    method: "POST",
    body: JSON.stringify({ name: input.name, email: input.email, phone: input.phone, studentId: input.studentId }),
  });
  return data?.item ?? { ...input, id: `s-${Date.now()}` };
}
export async function updateStudent(id: string, patch: Partial<AdminStudent>): Promise<AdminStudent> {
  const data = await callApi<{ item: AdminStudent }>(`/api/students/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, status: patch.status === "active" ? "ACTIVE" : patch.status === "inactive" ? "INACTIVE" : undefined }),
  });
  const found = DEMO_STUDENTS.find((s) => s.id === id) ?? DEMO_STUDENTS[0];
  return data?.item ?? { ...found, ...patch, id };
}
export async function deleteStudent(id: string): Promise<void> {
  await callApi(`/api/students/${id}`, { method: "DELETE" });
}

// ---- Faculty ----
export async function getFaculty(): Promise<AdminFaculty[]> {
  const data = await callApi<{ items: AdminFaculty[] }>("/api/faculty");
  return unwrapItems<AdminFaculty>(data, DEMO_FACULTY);
}
export async function createFaculty(input: Omit<AdminFaculty, "id">): Promise<AdminFaculty> {
  const data = await callApi<{ item: AdminFaculty }>("/api/faculty", {
    method: "POST",
    body: JSON.stringify({ name: input.name, email: input.email, phone: input.phone }),
  });
  return data?.item ?? { ...input, id: `f-${Date.now()}` };
}
export async function updateFaculty(id: string, patch: Partial<AdminFaculty>): Promise<AdminFaculty> {
  const data = await callApi<{ item: AdminFaculty }>(`/api/faculty/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, status: patch.status === "active" ? "ACTIVE" : patch.status === "inactive" ? "INACTIVE" : undefined }),
  });
  const found = DEMO_FACULTY.find((f) => f.id === id) ?? DEMO_FACULTY[0];
  return data?.item ?? { ...found, ...patch, id };
}

// ---- Batches ----
export async function getBatches(): Promise<AdminBatch[]> {
  const data = await callApi<{ items: AdminBatch[] }>("/api/batches");
  return unwrapItems<AdminBatch>(data, DEMO_BATCHES);
}

// ---- Tests (Phase 2 placeholder — full test engine comes later) ----
export async function getAdminTests(): Promise<AdminTest[]> {
  // /api/tests returns DB rows (different shape) — accept only AdminTest-shaped items.
  const data = await callApi<{ items: AdminTest[] }>("/api/tests");
  const items = unwrapItems<AdminTest>(data, DEMO_TESTS);
  if (items.length > 0 && typeof (items[0] as AdminTest).batch !== "string") return DEMO_TESTS;
  return items;
}

// ---- Banners ----
export async function getBanners(): Promise<AdminBanner[]> {
  const data = await callApi<{ items: AdminBanner[] }>("/api/banners");
  const items = unwrapItems<AdminBanner>(data, DEMO_BANNERS);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return items.map((r: any) => (typeof r.imageUrl === "string" || typeof r.isActive === "boolean" ? toAdminBanner(r) : (r as AdminBanner)));
}
export async function createBanner(input: Omit<AdminBanner, "id">): Promise<AdminBanner> {
  const data = await callApi<{ item: AdminBanner }>("/api/banners", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      subtitle: input.subtitle,
      description: input.description,
      imageUrl: input.image,
      videoUrl: input.videoUrl,
      buttonText: input.buttonText,
      buttonUrl: input.buttonUrl,
      startDate: input.startDate || undefined,
      endDate: input.endDate || undefined,
      isActive: input.active,
      displayOrder: input.order,
    }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data?.item ? toAdminBanner(data.item as any) : { ...input, id: `bn-${Date.now()}` };
}
export async function updateBanner(id: string, patch: Partial<AdminBanner>): Promise<AdminBanner> {
  const data = await callApi<{ item: AdminBanner }>(`/api/banners/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...patch,
      imageUrl: patch.image,
      isActive: patch.active,
      displayOrder: patch.order,
    }),
  });
  const found = DEMO_BANNERS.find((b) => b.id === id) ?? DEMO_BANNERS[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data?.item ? toAdminBanner(data.item as any) : { ...found, ...patch, id };
}

// ---- Popups ----
export async function getPopups(): Promise<AdminPopup[]> {
  const data = await callApi<{ items: AdminPopup[] }>("/api/popups");
  const items = unwrapItems<AdminPopup>(data, DEMO_POPUPS);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return items.map((r: any) => (typeof r.imageUrl === "string" || typeof r.isActive === "boolean" ? toAdminPopup(r) : (r as AdminPopup)));
}
export async function createPopup(input: Omit<AdminPopup, "id">): Promise<AdminPopup> {
  const data = await callApi<{ item: AdminPopup }>("/api/popups", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      message: input.message,
      imageUrl: input.image || undefined,
      videoUrl: input.videoUrl || undefined,
      buttonText: input.buttonText,
      buttonUrl: input.buttonUrl,
      frequency: popupFrequencyFor(input.frequency),
      startDate: input.startDate || undefined,
      endDate: input.endDate || undefined,
      isActive: input.active,
    }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data?.item ? toAdminPopup(data.item as any) : { ...input, id: `pp-${Date.now()}` };
}
export async function updatePopup(id: string, patch: Partial<AdminPopup>): Promise<AdminPopup> {
  const data = await callApi<{ item: AdminPopup }>(`/api/popups/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...patch,
      imageUrl: patch.image,
      isActive: patch.active,
      frequency: patch.frequency ? popupFrequencyFor(patch.frequency) : undefined,
    }),
  });
  const found = DEMO_POPUPS.find((p) => p.id === id) ?? DEMO_POPUPS[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data?.item ? toAdminPopup(data.item as any) : { ...found, ...patch, id };
}

// ---- Announcements ----
export async function getAnnouncements() {
  const data = await callApi<{ items: typeof DEMO_ANNOUNCEMENTS }>("/api/announcements");
  return unwrapItems(data, DEMO_ANNOUNCEMENTS);
}

// ---- Enquiries ----
export async function getEnquiries(): Promise<AdminEnquiry[]> {
  const data = await callApi<{ items: AdminEnquiry[] }>("/api/enquiries");
  return unwrapItems<AdminEnquiry>(data, DEMO_ENQUIRIES);
}
export async function updateEnquiryStatus(id: string, status: AdminEnquiry["status"]): Promise<void> {
  await callApi(`/api/enquiries/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: status.toUpperCase() }),
  });
}

// ---- Notifications ----
export async function getNotifications(): Promise<AdminNotification[]> {
  const data = await callApi<{ items: AdminNotification[] }>("/api/notifications");
  return unwrapItems<AdminNotification>(data, DEMO_NOTIFICATIONS);
}
export async function sendNotification(input: { title: string; message: string; audience: string }): Promise<AdminNotification> {
  const audience = input.audience === "Faculty" ? "FACULTY" : input.audience === "All students" ? "ALL_STUDENTS" : "BATCH";
  const data = await callApi<{ item: { id: string } }>("/api/notifications", {
    method: "POST",
    body: JSON.stringify({ title: input.title, message: input.message, audience, sendNow: true }),
  });
  void data;
  return { ...input, id: `n-${Date.now()}`, date: new Date().toISOString().slice(0, 10), status: "Sent" };
}
