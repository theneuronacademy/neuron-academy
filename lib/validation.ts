// Phase 3 — lightweight server-side validation (no new deps).
// Never trust client-side validation alone; every API route checks inputs here.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s-]{6,18}$/;

export function isEmail(v: unknown): v is string {
  return typeof v === "string" && EMAIL_RE.test(v.trim());
}

export function isPhone(v: unknown): v is string {
  return typeof v === "string" && PHONE_RE.test(v.trim());
}

export function isNonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Returns names of missing/empty required string fields. */
export function missingFields(body: Record<string, unknown>, fields: string[]): string[] {
  return fields.filter((f) => !isNonEmpty(body[f]));
}

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function parseDate(v: unknown): Date | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
}
