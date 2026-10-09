// Phase 18b — centralized SMS template catalog (pure, server-side only).
// Templates render {{variables}} into plain text. Provider (DLT/Flow)
// template IDs are resolved from environment (MSG91_FLOW_ID_<KEY>) so DLT
// approvals can be wired without rewriting business logic — see flowIdFor().
// No template text below is sent until a flow ID is configured; without one
// the SMS channel honestly reports SMS_TEMPLATE_NOT_CONFIGURED while Push +
// In-app still deliver (failure isolation).
//
// Phase 18c — explicit EVENT → ALLOWED TEMPLATE(S) mapping lives here
// (isTemplateAllowedForEvent). Strict same-name pairing; the OTP template is
// only valid for OTP events. The engine rejects mismatched pairs server-side.

import type { NotificationEvent } from "@/lib/notification-events";

export const SMS_TEMPLATE_KEYS = [
  "OTP",
  "TEST_PUBLISHED",
  "TEST_REMINDER",
  "RESULT_RELEASED",
  "ATTENDANCE_MARKED",
  "ATTENDANCE_ABSENT",
  "BATCH_ANNOUNCEMENT",
  "ADMIN_ANNOUNCEMENT",
  "ACADEMIC_NOTICE",
  "ADMISSION_UPDATE",
  "REGISTRATION_UPDATE",
  "ACCESS_GRANTED",
  "ACCESS_REVOKED",
  "FACULTY_NOTIFICATION",
  "EMERGENCY_ALERT",
] as const;

export type SmsTemplateKey = (typeof SMS_TEMPLATE_KEYS)[number];

export interface SmsTemplate {
  key: SmsTemplateKey;
  /** Human label for the admin template picker. */
  label: string;
  /** Body with {{variables}}. Keep under 160 chars where possible. */
  body: string;
  /** Variables that must be supplied (engine validates). */
  requiredVars: string[];
}

function t(key: SmsTemplateKey, label: string, body: string, requiredVars: string[]): SmsTemplate {
  return { key, label, body, requiredVars };
}

export const SMS_TEMPLATES: Record<SmsTemplateKey, SmsTemplate> = {
  OTP: t("OTP", "One-time password", "{{academyName}}: your OTP is {{otp}}. It expires in {{expiryMin}} min. Never share it.", ["academyName", "otp", "expiryMin"]),
  TEST_PUBLISHED: t("TEST_PUBLISHED", "Test published", "{{academyName}}: {{testName}} is now live{{batchName}}. Open the app to start.", ["academyName", "testName"]),
  TEST_REMINDER: t("TEST_REMINDER", "Test reminder", "{{academyName}}: reminder — {{testName}} on {{testDate}}{{testTime}}. Don't miss it.", ["academyName", "testName", "testDate"]),
  RESULT_RELEASED: t("RESULT_RELEASED", "Result released", "{{academyName}}: {{studentName}}, your result for {{testName}} is out: {{result}}. Check the app.", ["academyName", "studentName", "testName", "result"]),
  ATTENDANCE_MARKED: t("ATTENDANCE_MARKED", "Attendance update", "{{academyName}}: attendance for {{studentName}} marked on {{testDate}}.", ["academyName", "studentName", "testDate"]),
  ATTENDANCE_ABSENT: t("ATTENDANCE_ABSENT", "Absent alert", "{{academyName}}: {{studentName}} was marked absent on {{testDate}}{{batchName}}. Contact office if wrong.", ["academyName", "studentName", "testDate"]),
  BATCH_ANNOUNCEMENT: t("BATCH_ANNOUNCEMENT", "Batch announcement", "{{academyName}}{{batchName}}: {{message}}", ["academyName", "message"]),
  ADMIN_ANNOUNCEMENT: t("ADMIN_ANNOUNCEMENT", "Admin announcement", "{{academyName}}: {{message}}", ["academyName", "message"]),
  ACADEMIC_NOTICE: t("ACADEMIC_NOTICE", "Academic notice", "{{academyName}} notice: {{message}}", ["academyName", "message"]),
  ADMISSION_UPDATE: t("ADMISSION_UPDATE", "Admission update", "{{academyName}}: hi {{studentName}}, {{message}}", ["academyName", "studentName", "message"]),
  REGISTRATION_UPDATE: t("REGISTRATION_UPDATE", "Registration update", "{{academyName}}: hi {{studentName}}, {{message}}", ["academyName", "studentName", "message"]),
  ACCESS_GRANTED: t("ACCESS_GRANTED", "Access granted", "{{academyName}}: {{studentName}}, access granted for {{testName}}. Open the app to start.", ["academyName", "studentName", "testName"]),
  ACCESS_REVOKED: t("ACCESS_REVOKED", "Access revoked", "{{academyName}}: {{studentName}}, access revoked for {{testName}}. Contact office for help.", ["academyName", "studentName", "testName"]),
  FACULTY_NOTIFICATION: t("FACULTY_NOTIFICATION", "Faculty notice", "{{academyName}}: hi {{facultyName}}, {{message}}", ["academyName", "facultyName", "message"]),
  EMERGENCY_ALERT: t("EMERGENCY_ALERT", "Emergency alert", "{{academyName}} URGENT: {{message}}", ["academyName", "message"]),
};

export function isSmsTemplateKey(v: unknown): v is SmsTemplateKey {
  return typeof v === "string" && (SMS_TEMPLATE_KEYS as readonly string[]).includes(v);
}

/**
 * Phase 18c — explicit EVENT → ALLOWED TEMPLATE(S) mapping.
 * Strict same-name pairing for broadcast/academic events; the OTP template
 * is valid only for the four OTP/security events. The engine rejects any
 * other pairing with NOTIFY_BAD_TEMPLATE — the UI picker is never trusted.
 */
const EVENT_TEMPLATE_ALLOWLIST: Record<NotificationEvent, readonly SmsTemplateKey[]> = {
  OTP_REQUESTED: ["OTP"],
  OTP_VERIFIED: ["OTP"],
  LOGIN_SECURITY_OTP: ["OTP"],
  PASSWORD_RESET_OTP: ["OTP"],
  TEST_PUBLISHED: ["TEST_PUBLISHED"],
  TEST_REMINDER: ["TEST_REMINDER"],
  RESULT_RELEASED: ["RESULT_RELEASED"],
  ATTENDANCE_MARKED: ["ATTENDANCE_MARKED"],
  ATTENDANCE_ABSENT: ["ATTENDANCE_ABSENT"],
  BATCH_ANNOUNCEMENT: ["BATCH_ANNOUNCEMENT"],
  ADMIN_ANNOUNCEMENT: ["ADMIN_ANNOUNCEMENT"],
  ACADEMIC_NOTICE: ["ACADEMIC_NOTICE"],
  ADMISSION_UPDATE: ["ADMISSION_UPDATE"],
  REGISTRATION_UPDATE: ["REGISTRATION_UPDATE"],
  ACCESS_GRANTED: ["ACCESS_GRANTED"],
  ACCESS_REVOKED: ["ACCESS_REVOKED"],
  FACULTY_NOTIFICATION: ["FACULTY_NOTIFICATION"],
  EMERGENCY_ALERT: ["EMERGENCY_ALERT"],
};

/** True when `templateKey` may be used for `event`. Absent template (undefined) is always allowed. */
export function isTemplateAllowedForEvent(event: NotificationEvent, templateKey: unknown): boolean {
  if (templateKey === undefined) return true;
  if (!isSmsTemplateKey(templateKey)) return false;
  return EVENT_TEMPLATE_ALLOWLIST[event].includes(templateKey);
}

/**
 * Derive the dispatch event for a template picked in the admin composer
 * (same-name event when one exists, e.g. TEST_PUBLISHED → TEST_PUBLISHED).
 * Returns null when the template has no same-name event (OTP) — callers
 * then keep the manual-announcement default and let validation decide.
 */
export function eventForTemplate(templateKey: SmsTemplateKey): NotificationEvent | null {
  if ((EVENT_TEMPLATE_ALLOWLIST[templateKey as NotificationEvent] ?? []).includes(templateKey)) {
    return templateKey as NotificationEvent;
  }
  return null;
}

/**
 * Provider (MSG91 Flow/DLT) template identifier for an SMS template.
 * Configure per template without touching business logic, e.g.
 * MSG91_FLOW_ID_TEST_PUBLISHED="345...". Empty when unconfigured.
 */
export function flowIdFor(key: SmsTemplateKey): string {
  return (process.env[`MSG91_FLOW_ID_${key}`] ?? "").trim();
}

/** Render {{vars}}. Returns { text, missing } — engine rejects missing required vars. */
export function renderSmsTemplate(
  key: SmsTemplateKey,
  vars: Record<string, unknown>
): { text: string; missing: string[] } {
  const tpl = SMS_TEMPLATES[key];
  const missing = tpl.requiredVars.filter((v) => {
    const val = vars[v];
    return val === undefined || val === null || String(val).trim() === "";
  });
  const text = tpl.body.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_m, name: string) => {
    const val = vars[name];
    return val === undefined || val === null ? "" : String(val);
  });
  return { text, missing };
}

export function academyName(): string {
  return (process.env.ACADEMY_NAME ?? "Neuron Academy").slice(0, 60);
}
