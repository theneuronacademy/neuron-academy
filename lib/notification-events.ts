// Phase 18b — centralized notification event catalog (pure, server + tests).
// Single source of truth for event names, default channel policy and default
// priorities. The engine (services/notificationEngine.ts) enforces this
// policy; routes declare an event and never implement channel logic.
// OTP/security events are SMS-only and mandatory (never user-disableable).

export const NOTIFICATION_EVENTS = [
  "OTP_REQUESTED",
  "OTP_VERIFIED",
  "LOGIN_SECURITY_OTP",
  "PASSWORD_RESET_OTP",
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

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export type NotifyChannel = "SMS" | "PUSH" | "IN_APP";
export type NotifyPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export const NOTIFY_CHANNELS: readonly NotifyChannel[] = ["SMS", "PUSH", "IN_APP"];
export const NOTIFY_PRIORITIES: readonly NotifyPriority[] = ["LOW", "NORMAL", "HIGH", "CRITICAL"];

/**
 * Exact default channel policy. OTP/security → MSG91 SMS only (mandatory).
 * Everything academy-wide except plain ATTENDANCE_MARKED → SMS + Push + In-app.
 * Do not silently change this policy — edits here are audited by otp:check
 * and notification:check.
 */
export const DEFAULT_CHANNEL_POLICY: Record<NotificationEvent, readonly NotifyChannel[]> = {
  OTP_REQUESTED: ["SMS"],
  OTP_VERIFIED: ["SMS"],
  LOGIN_SECURITY_OTP: ["SMS"],
  PASSWORD_RESET_OTP: ["SMS"],
  TEST_PUBLISHED: ["SMS", "PUSH", "IN_APP"],
  TEST_REMINDER: ["SMS", "PUSH", "IN_APP"],
  RESULT_RELEASED: ["SMS", "PUSH", "IN_APP"],
  ATTENDANCE_MARKED: ["PUSH", "IN_APP"],
  ATTENDANCE_ABSENT: ["SMS", "PUSH", "IN_APP"],
  BATCH_ANNOUNCEMENT: ["SMS", "PUSH", "IN_APP"],
  ADMIN_ANNOUNCEMENT: ["SMS", "PUSH", "IN_APP"],
  ACADEMIC_NOTICE: ["SMS", "PUSH", "IN_APP"],
  ADMISSION_UPDATE: ["SMS", "PUSH", "IN_APP"],
  REGISTRATION_UPDATE: ["SMS", "PUSH", "IN_APP"],
  ACCESS_GRANTED: ["SMS", "PUSH", "IN_APP"],
  ACCESS_REVOKED: ["SMS", "PUSH", "IN_APP"],
  FACULTY_NOTIFICATION: ["SMS", "PUSH", "IN_APP"],
  EMERGENCY_ALERT: ["SMS", "PUSH", "IN_APP"],
};

export const DEFAULT_PRIORITY: Record<NotificationEvent, NotifyPriority> = {
  OTP_REQUESTED: "HIGH",
  OTP_VERIFIED: "HIGH",
  LOGIN_SECURITY_OTP: "HIGH",
  PASSWORD_RESET_OTP: "HIGH",
  TEST_PUBLISHED: "NORMAL",
  TEST_REMINDER: "NORMAL",
  RESULT_RELEASED: "HIGH",
  ATTENDANCE_MARKED: "NORMAL",
  ATTENDANCE_ABSENT: "HIGH",
  BATCH_ANNOUNCEMENT: "NORMAL",
  ADMIN_ANNOUNCEMENT: "NORMAL",
  ACADEMIC_NOTICE: "HIGH",
  ADMISSION_UPDATE: "NORMAL",
  REGISTRATION_UPDATE: "NORMAL",
  ACCESS_GRANTED: "HIGH",
  ACCESS_REVOKED: "HIGH",
  FACULTY_NOTIFICATION: "NORMAL",
  EMERGENCY_ALERT: "CRITICAL",
};

/** OTP/security events are mandatory — recipients can never disable them. */
export function isMandatoryEvent(event: NotificationEvent): boolean {
  return (
    event === "OTP_REQUESTED" ||
    event === "OTP_VERIFIED" ||
    event === "LOGIN_SECURITY_OTP" ||
    event === "PASSWORD_RESET_OTP" ||
    event === "EMERGENCY_ALERT"
  );
}

export function isKnownEvent(v: unknown): v is NotificationEvent {
  return typeof v === "string" && (NOTIFICATION_EVENTS as readonly string[]).includes(v);
}

/**
 * Phase 18c — canonical stored `Notification.type` vocabulary.
 * The stored type IS the event name verbatim (e.g. "TEST_PUBLISHED").
 * Creation (engine), duplicate lookup (findDuplicate), route pre-checks and
 * UI filters must all use this helper. No aliases are maintained: legacy
 * lowercase kinds ("test", "result", "attendance", "access") are retired and
 * must not be queried for new rows.
 */
export function canonicalNotificationType(event: NotificationEvent): string {
  return event;
}

/** Server-validated channel override: unknown values dropped, mandatory policy enforced. */
export function resolveChannels(event: NotificationEvent, requested?: unknown): NotifyChannel[] {
  if (!Array.isArray(requested) || requested.length === 0) return [...DEFAULT_CHANNEL_POLICY[event]];
  const clean = requested.filter((c): c is NotifyChannel =>
    c === "SMS" || c === "PUSH" || c === "IN_APP"
  );
  if (clean.length === 0) return [...DEFAULT_CHANNEL_POLICY[event]];
  // Phase 18c — mandatory events enforce the exact established policy.
  // The server enforces this even if the browser sends modified JSON, so a
  // mandatory channel can never be removed by the client.
  if (isMandatoryEvent(event)) {
    return [...DEFAULT_CHANNEL_POLICY[event]];
  }
  return [...new Set(clean)];
}

export function resolvePriority(event: NotificationEvent, requested?: unknown): NotifyPriority {
  if (typeof requested === "string" && (NOTIFY_PRIORITIES as readonly string[]).includes(requested)) {
    return requested as NotifyPriority;
  }
  return DEFAULT_PRIORITY[event];
}
