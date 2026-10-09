// Phase 18b — centralized notification engine (SERVER-ONLY).
// Phase 18c — core correctness: canonical types, audience-safe storage,
// universal idempotency, template validation, real priority, honest fan-out.
// Phase 18c-step3 — persistent delivery audit + race-safe idempotency:
//   Notification.idempotencyKey (unique, sharded "<dispatch>#<shard>") +
//   Notification.priority + Notification.requestedChannels +
//   NotificationDelivery rows per (notification, channel, recipient).
//   Delivery state machine (DeliveryStatus): CREATED → QUEUED → PROCESSING →
//   SENT (provider accepted: MSG91 Flow success, push acceptance) — DELIVERED
//   is NEVER claimed on acceptance; DELIVERED = durable in-app write visible
//   to the recipient (or a future provider receipt; SMS never uses it).
//   FAILED = channel failed (retryable flag + safe errorCode, no secrets).
//   SKIPPED = not attempted (policy/unconfigured/invalid/cap overflow).
//   RETRYING is reserved for the future worker (persisted retryable +
//   attemptCount + nextAttemptAt, but NEVER auto-retried here).
//   SCHEDULED headers stay SCHEDULED with CREATED deliveries until the
//   project scheduler executes them (no cron here).
//
//   EVENT / OTP / ADMIN ACTION
//           ↓
//   dispatchNotification (this file: validate → authorize → resolve)
//           ↓
//   AUDIENCE RESOLVER (server-side only, role-scoped)
//           ↓
//   CHANNEL ROUTER (policy from lib/notification-events.ts)
//     ┌──────────┬──────────┬──────────┐
//     SMS        PUSH       IN-APP
//     Msg91      VAPID      Prisma Notification row
//     provider   stub       (safeNotify)
//     └──────────┴──────────┘
//           ↓
//   DELIVERY REPORT (normalized states, per channel, independent)
//
// Canonical type contract (§18c.1): the stored Notification.type IS the event
// name verbatim (canonicalNotificationType). Creation, duplicate lookup,
// route checks and UI filters all use the same value. No aliases.
//
// Delivery-state vocabulary (§13), persisted per recipient/channel in
// NotificationDelivery (Phase 18c-step3 audit schema):
//   CREATED .... delivery row persisted, not yet attempted (scheduled lanes)
//   QUEUED ..... recipients + channels resolved, dispatch starting
//   PROCESSING . fan-out in progress
//   SENT ...... provider accepted (SMS) / push acceptance. DELIVERED is
//               never claimed: MSG91 confirms acceptance, not handset delivery.
//   DELIVERED . durable in-app write visible to the recipient (or a future
//               provider delivery receipt; SMS never uses DELIVERED).
//   FAILED .... channel failed; other channels still attempted (isolation).
//               Missing template variables are a config FAILED (attemptCount 0,
//               never attempted) while the live report also counts those
//               recipients as skipped for capacity parity — see the SMS branch.
//   SKIPPED ... channel not in policy / unconfigured / invalid recipient /
//               fan-out cap overflow. Counted explicitly, never hidden.
//   SCHEDULED . future scheduledAt persisted (status SCHEDULED); execution
//               needs the project's scheduler/cron — never faked.
//   DUPLICATE . idempotencyKey matched a prior dispatch — nothing re-sent.
//               Every event (including manual announcements) is deduped; the
//               caller provides the key per logical send, persisted via the
//               unique Notification.idempotencyKey ("<dispatch>#<shard>").
//               Concurrent losers hit P2002 and send nothing.
//   RETRYABLE . transient provider fault (timeout/network/5xx) flagged for a
//               future worker (retryable + nextAttemptAt persisted).
//               No retry loops here: one attempt per channel.
//
// In-app storage contract (§18c.2): single broadcast rows only where the
// schema can represent the audience (ALL_STUDENTS, BATCH, FACULTY,
// INDIVIDUAL with explicit targets). REGULAR/SCHOLARSHIP fan out to one
// INDIVIDUAL row per eligible student (never a generic ALL_STUDENTS row).
// ALL_USERS persists two rows (ALL_STUDENTS + FACULTY) so both cohorts see
// it. COURSE is rejected until the schema can represent it — no audience
// silently sends to nobody.
//
// Priority (§18c.7): resolved, validated and carried through every report,
// then persisted on every Notification header and NotificationDelivery row
// (Phase 18c-step3 audit schema). Only LOW/NORMAL/HIGH/CRITICAL are stored.
//
// Failure isolation: in-app creation, SMS fan-out and push fan-out each run
// in their own try/catch. MSG91 down ⇒ SMS FAILED, push + in-app unaffected.
// This function NEVER throws — triggers await it without risk to their
// transaction. It NEVER logs phones (masked), OTPs, keys, or raw payloads.

import type { PrismaClient } from "@prisma/client";
import {
  canonicalNotificationType,
  isKnownEvent,
  resolveChannels,
  resolvePriority,
  type NotificationEvent,
  type NotifyChannel,
  type NotifyPriority,
} from "@/lib/notification-events";
import {
  academyName,
  flowIdFor,
  isSmsTemplateKey,
  isTemplateAllowedForEvent,
  renderSmsTemplate,
  type SmsTemplateKey,
} from "@/lib/sms-templates";
import { normalizeIndianMobile } from "@/lib/otp";
import { safeNotify } from "@/lib/notify";
import { sendSms } from "@/services/msg91";
import { sendNotification as sendPush } from "@/services/webPush";

type Db = PrismaClient;

/** Bounded fan-out per dispatch — no unbounded SMS loops. Worker-ready. */
export const MAX_SMS_PER_DISPATCH = 200;
/** Interactive mass SMS always needs an explicit human confirm flag. */
export const MASS_SMS_INTERACTIVE_LIMIT = 1;

/** Phase 18c — COURSE removed: the schema has no targetCourseId, so a course
 * audience would be invisible in-app. Rejected with NOTIFY_BAD_AUDIENCE
 * until the schema can represent it. */
export type AudienceKind =
  | "INDIVIDUAL"
  | "BATCH"
  | "ALL_STUDENTS"
  | "REGULAR"
  | "SCHOLARSHIP"
  | "FACULTY"
  | "ALL_FACULTY"
  | "ALL_USERS";

export interface EngineAudience {
  kind: AudienceKind;
  studentId?: string;
  userId?: string;
  facultyId?: string;
  batchId?: string;
}

export interface EngineActor {
  id: string;
  role: string;
}

export interface DispatchInput {
  event: NotificationEvent | string;
  actor: EngineActor;
  audience: EngineAudience;
  title: string;
  message: string;
  /** SMS template; defaults per event below. Must pair with the event. */
  templateKey?: string;
  /** Template variables (studentName, testName, batchName, ...). */
  vars?: Record<string, unknown>;
  priority?: string;
  channels?: unknown;
  scheduledAt?: Date | null;
  /** Caller-provided key per logical send (ADMIN_ANNOUNCEMENT:<id>, ...).
   * The same key on retry must not re-deliver. Never a bare timestamp. */
  idempotencyKey?: string;
  /** Server-side triggers pass internal: true (auditable, idempotent). */
  internal?: boolean;
  /** Interactive admin mass SMS must pass confirmMassSend: true. */
  confirmMassSend?: boolean;
  testId?: string;
  createdById?: string;
}

export interface ChannelSummary {
  state: "SENT" | "PARTIAL" | "FAILED" | "SKIPPED" | "SCHEDULED" | "DUPLICATE";
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  retryable: boolean;
  /** Structured explanation for SKIPPED/FAILED/PARTIAL (missing template,
   * missing variables, fan-out cap). Never secrets, phones, or bodies. */
  error?: string;
}

export interface DispatchReport {
  ok: boolean;
  code: string;
  event: string;
  /** Resolved priority for this dispatch (request-validated, see §18c.7). */
  priority?: NotifyPriority;
  duplicate?: boolean;
  scheduled?: boolean;
  inApp: { state: "SENT" | "SCHEDULED" | "FAILED" | "SKIPPED"; id?: string };
  sms: ChannelSummary;
  push: ChannelSummary;
  error?: string;
}

interface Recipient {
  studentId?: string;
  facultyId?: string;
  userId?: string;
  name: string;
  phone: string;
}

const EVENT_TEMPLATE: Partial<Record<NotificationEvent, SmsTemplateKey>> = {
  TEST_PUBLISHED: "TEST_PUBLISHED",
  TEST_REMINDER: "TEST_REMINDER",
  RESULT_RELEASED: "RESULT_RELEASED",
  ATTENDANCE_MARKED: "ATTENDANCE_MARKED",
  ATTENDANCE_ABSENT: "ATTENDANCE_ABSENT",
  BATCH_ANNOUNCEMENT: "BATCH_ANNOUNCEMENT",
  ADMIN_ANNOUNCEMENT: "ADMIN_ANNOUNCEMENT",
  ACADEMIC_NOTICE: "ACADEMIC_NOTICE",
  ADMISSION_UPDATE: "ADMISSION_UPDATE",
  REGISTRATION_UPDATE: "REGISTRATION_UPDATE",
  ACCESS_GRANTED: "ACCESS_GRANTED",
  ACCESS_REVOKED: "ACCESS_REVOKED",
  FACULTY_NOTIFICATION: "FACULTY_NOTIFICATION",
  EMERGENCY_ALERT: "EMERGENCY_ALERT",
};

/** Template variables supplied per recipient at fan-out (never required up front). */
const RECIPIENT_SUPPLIED_VARS: ReadonlySet<string> = new Set(["studentName", "facultyName", "batchName"]);

function emptySummary(state: ChannelSummary["state"]): ChannelSummary {
  return { state, attempted: 0, sent: 0, failed: 0, skipped: 0, retryable: false };
}

// Phase 18c-step3 — persistent idempotency helpers. Every dispatch resolves
// to ONE dispatchKey (caller key → natural key → 10-min fallback bucket).
// Headers store "<dispatchKey>#<shard>" (unique) so concurrent retries hit
// P2002 instead of double-sending. No findFirst()-then-create() alone.
function naturalDispatchKey(
  event: NotificationEvent,
  input: DispatchInput
): string | undefined {
  const aud = input.audience;
  if (event === "TEST_PUBLISHED" && input.testId) return `TEST_PUBLISHED:${input.testId}`;
  if (event === "RESULT_RELEASED" && input.testId && aud.studentId) {
    return `RESULT_RELEASED:${input.testId}:${aud.studentId}`;
  }
  if (event === "ATTENDANCE_ABSENT" && aud.studentId) {
    // Phase 18c-step5 (P2): attendance idempotency day is the UTC calendar
    // date (attendanceIdempotencyDayUTC). The legacy findDuplicate lookup
    // below uses a local-midnight window as a backstop; the persistent
    // natural key is authoritative for deduplication across restarts and
    // instances regardless of server timezone.
    return `ATTENDANCE_ABSENT:${aud.studentId}:${attendanceIdempotencyDayUTC()}`;
  }
  if ((event === "ACCESS_GRANTED" || event === "ACCESS_REVOKED") && input.testId && aud.studentId) {
    return `${event}:${input.testId}:${aud.studentId}`;
  }
  return undefined;
}

function hashShort(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/** Phase 18c-step5 (P2): UTC calendar date (YYYY-MM-DD) scoping attendance
 * idempotency. Documented policy: one ATTENDANCE_ABSENT alert per student per
 * UTC day. Server timezone never affects the persistent key. */
export function attendanceIdempotencyDayUTC(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

function fallbackDispatchKey(
  event: NotificationEvent,
  input: DispatchInput
): string {
  const aud = input.audience;
  const audId = aud.studentId ?? aud.facultyId ?? aud.userId ?? aud.batchId ?? aud.kind;
  const bucket = Math.floor(Date.now() / 600_000);
  const h = hashShort(`${input.title}\n${input.message}\n${aud.kind}:${audId}`);
  return `FALLBACK:${event}:${aud.kind}:${h}:${bucket}`;
}

function resolveDispatchKey(event: NotificationEvent, input: DispatchInput): string {
  const raw = typeof input.idempotencyKey === "string" ? input.idempotencyKey.trim() : "";
  if (raw) return raw.slice(0, 100);
  return naturalDispatchKey(event, input) ?? fallbackDispatchKey(event, input);
}

/** Deterministic per-recipient dedup identity. Never phones/secrets. */
function recipientKeyFor(r: Recipient): string {
  if (r.userId) return `user:${r.userId}`;
  if (r.studentId) return `student:${r.studentId}`;
  if (r.facultyId) return `faculty:${r.facultyId}`;
  return `name:${String(r.name ?? "unknown").slice(0, 40)}`;
}

function providerForChannel(c: NotifyChannel): "MSG91" | "WEB_PUSH" | "IN_APP" {
  if (c === "SMS") return "MSG91";
  if (c === "PUSH") return "WEB_PUSH";
  return "IN_APP";
}

function isP2002(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const code = (err as { code?: unknown })?.code;
  return code === "P2002" || msg.includes("P2002") || msg.includes("Unique constraint");
}

/** Persistent duplicate lookup via sharded idempotencyKey prefix. */
async function findPersistentDuplicate(db: Db, dispatchKey: string): Promise<boolean> {
  try {
    const anyDb = db as unknown as {
      notification?: { findFirst?: (args: unknown) => Promise<{ id: string } | null> };
    };
    if (!anyDb.notification?.findFirst) return false;
    const hit = await anyDb.notification.findFirst({
      where: { idempotencyKey: { startsWith: `${dispatchKey}#` } },
      select: { id: true },
    });
    if (hit) return true;
    // Fallback for fake doubles that ignore `startsWith` filtering and for
    // exact-key rows: any hit means a prior dispatch owns this key.
    const exact = await anyDb.notification
      .findFirst({ where: { idempotencyKey: dispatchKey }, select: { id: true } })
      .catch(() => null);
    return !!exact;
  } catch {
    return false;
  }
}

/** Exact sharded-key lookup (convergence, never throws). */
async function findNotificationIdByKey(db: Db, key: string): Promise<string | null> {
  try {
    const anyDb = db as unknown as {
      notification?: { findFirst?: (args: unknown) => Promise<{ id: string } | null> };
    };
    if (!anyDb.notification?.findFirst) return null;
    const hit = await anyDb.notification
      .findFirst({
        where: { idempotencyKey: key },
        select: { id: true },
      })
      .catch(() => null);
    return hit?.id ?? null;
  } catch {
    return null;
  }
}

/** Expected header count for a dispatch (shard plan). */
function expectedHeaderCount(kind: AudienceKind, recipients: Recipient[]): number {
  if (kind === "REGULAR" || kind === "SCHOLARSHIP") return recipients.filter((x) => x.studentId).length;
  if (kind === "ALL_USERS") return 2;
  return 1;
}

/** Best-effort delivery write. Never throws; never stores secrets/phones. */
async function safeDeliveryCreate(
  db: Db,
  data: {
    notificationId: string;
    userId?: string;
    studentId?: string;
    facultyId?: string;
    recipientKey: string;
    channel: NotifyChannel;
    status: "CREATED" | "QUEUED" | "PROCESSING" | "SENT" | "DELIVERED" | "FAILED" | "RETRYING" | "SKIPPED";
    priority: NotifyPriority;
    provider: "IN_APP" | "MSG91" | "WEB_PUSH";
    providerMessageId?: string;
    errorCode?: string;
    errorMessage?: string;
    retryable: boolean;
    attemptCount: number;
    nextAttemptAt?: Date;
    queuedAt?: Date;
    sentAt?: Date;
    deliveredAt?: Date;
    failedAt?: Date;
    lastAttemptAt?: Date;
  }
): Promise<void> {
  try {
    const anyDb = db as unknown as {
      notificationDelivery?: { create?: (args: unknown) => Promise<unknown> };
    };
    if (!anyDb.notificationDelivery?.create) return;
    // Safety: never persist secrets, OTPs, phones, or raw payloads.
    const safe: Record<string, unknown> = {
      notificationId: data.notificationId,
      recipientKey: String(data.recipientKey).slice(0, 120),
      channel: data.channel,
      status: data.status,
      priority: data.priority,
      provider: data.provider,
      retryable: data.retryable,
      attemptCount: data.attemptCount,
    };
    if (data.userId) safe.userId = data.userId;
    if (data.studentId) safe.studentId = data.studentId;
    if (data.facultyId) safe.facultyId = data.facultyId;
    if (data.providerMessageId) safe.providerMessageId = String(data.providerMessageId).slice(0, 120);
    if (data.errorCode) safe.errorCode = String(data.errorCode).slice(0, 60);
    if (data.errorMessage) safe.errorMessage = String(data.errorMessage).slice(0, 300);
    if (data.nextAttemptAt) safe.nextAttemptAt = data.nextAttemptAt;
    if (data.queuedAt) safe.queuedAt = data.queuedAt;
    if (data.sentAt) safe.sentAt = data.sentAt;
    if (data.deliveredAt) safe.deliveredAt = data.deliveredAt;
    if (data.failedAt) safe.failedAt = data.failedAt;
    if (data.lastAttemptAt) safe.lastAttemptAt = data.lastAttemptAt;
    await anyDb.notificationDelivery.create({ data: safe });
  } catch (err) {
    // Delivery audit never breaks the dispatch (isolation). Unique conflicts
    // (concurrent retry, P2002) are swallowed: the winner's rows stand.
    void isP2002(err);
  }
}

function retryAt(retryable: boolean): Date | undefined {
  return retryable ? new Date(Date.now() + 15 * 60 * 1000) : undefined;
}

/** Map a recipient to its audit header id (cohort fan-out aware).
 * Phase 18c-step5 (P1): strict mapping — unmapped recipients resolve to
 * undefined and are skipped by callers. Attaching a delivery to an unrelated
 * header via an ids[0] fallback is never allowed. */
function scheduledHeaderFor(
  kind: AudienceKind,
  ids: string[],
  recipients: Recipient[]
): (r: Recipient) => string | undefined {
  if (kind === "REGULAR" || kind === "SCHOLARSHIP") {
    const filtered = recipients.filter((x) => x.studentId);
    const byId = new Map(filtered.map((x, i) => [x.studentId as string, ids[i]]));
    return (r) => (r.studentId ? byId.get(r.studentId) : undefined);
  }
  if (kind === "ALL_USERS") {
    return (r) => (r.facultyId ? ids[1] : ids[0]);
  }
  return () => ids[0];
}

/** Recipients that own an IN_APP delivery row (cohort fan-out aware). */
function recipientsForInApp(kind: AudienceKind, recipients: Recipient[]): Recipient[] {
  if (kind === "REGULAR" || kind === "SCHOLARSHIP") return recipients.filter((r) => r.studentId);
  return recipients;
}

type RowAudience = "ALL_STUDENTS" | "BATCH" | "FACULTY" | "INDIVIDUAL";

/** Row audiences a dispatch of this kind persists (dedup fallback scope). */
function rowAudiencesFor(kind: AudienceKind): RowAudience[] {
  if (kind === "BATCH") return ["BATCH"];
  if (kind === "FACULTY" || kind === "ALL_FACULTY") return ["FACULTY"];
  if (kind === "INDIVIDUAL") return ["INDIVIDUAL"];
  if (kind === "REGULAR" || kind === "SCHOLARSHIP") return ["INDIVIDUAL"];
  if (kind === "ALL_USERS") return ["ALL_STUDENTS", "FACULTY"];
  return ["ALL_STUDENTS"];
}

/** Natural-key duplicate lookup on existing Notification columns (no migration).
 * Looks up the SAME canonical type the dispatch persists — creation and
 * search can never disagree. */
async function findDuplicate(
  db: Db,
  event: NotificationEvent,
  input: DispatchInput
): Promise<boolean> {
  try {
    const aud = input.audience;
    const ctype = canonicalNotificationType(event);
    if (event === "TEST_PUBLISHED" && input.testId) {
      const hit = await db.notification.findFirst({
        where: { type: ctype, testId: input.testId },
        select: { id: true },
      });
      return !!hit;
    }
    if (event === "RESULT_RELEASED" && input.testId && aud.studentId) {
      const hit = await db.notification.findFirst({
        where: { type: ctype, testId: input.testId, targetStudentId: aud.studentId },
        select: { id: true },
      });
      return !!hit;
    }
    if (event === "ATTENDANCE_ABSENT" && aud.studentId) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      const hit = await db.notification.findFirst({
        where: { type: ctype, targetStudentId: aud.studentId, createdAt: { gte: day } },
        select: { id: true },
      });
      return !!hit;
    }
    if ((event === "ACCESS_GRANTED" || event === "ACCESS_REVOKED") && input.testId && aud.studentId) {
      const needle = event === "ACCESS_GRANTED" ? "granted access" : "has been revoked";
      const hit = await db.notification.findFirst({
        where: { type: ctype, testId: input.testId, targetStudentId: aud.studentId, message: { contains: needle } },
        select: { id: true },
      });
      return !!hit;
    }
    // Generic fallback (covers manual announcements): identical canonical
    // type + persisted audience + title + message in the last 10 min.
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const hit = await db.notification.findFirst({
      where: {
        audience: { in: rowAudiencesFor(aud.kind) },
        type: ctype,
        title: input.title.slice(0, 120),
        message: input.message.slice(0, 1000),
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    return !!hit;
  } catch {
    return false;
  }
}

async function facultyBatchIds(db: Db, facultyUserId: string): Promise<string[] | null> {
  try {
    const fac = await db.faculty.findFirst({
      where: { userId: facultyUserId, status: "ACTIVE" },
      select: { id: true, batches: { select: { id: true } } },
    });
    if (!fac) return null;
    return fac.batches.map((b) => b.id);
  } catch {
    return null;
  }
}

/** Persist in-app rows per the §18c.2 storage contract.
 * Returns created ids plus how many this call created itself.
 * Phase 18c-step3: every row carries priority + requestedChannels + a
 * sharded idempotencyKey ("<dispatch>#<shard>") so concurrent retries hit
 * the unique constraint (P2002) instead of double-writing.
 * Phase 18c-step5 (P1): on a P2002 loss the winner's header id is resolved
 * via the exact sharded key (convergence). `createdNew` lets callers tell a
 * clean win (all shards created here → safe to dispatch channels) from a
 * duplicate retry (none created here → send nothing) and from a genuinely
 * partial fan-out (some created, some missing → abort, never misattribute).
 * Genuine store failures resolve to neither and are simply absent. */
async function persistInAppRows(
  db: Db,
  opts: {
    title: string;
    message: string;
    ctype: string;
    audience: EngineAudience;
    recipients: Recipient[];
    testId?: string;
    createdById: string;
    scheduledAt?: Date | null;
    dispatchKey?: string;
    priority?: NotifyPriority;
    requestedChannels?: NotifyChannel[];
  }
): Promise<{ ids: string[]; createdNew: number }> {
  const ids: string[] = [];
  let createdNew = 0;
  const timing = opts.scheduledAt ? { scheduledAt: opts.scheduledAt } : undefined;
  const keyFor = (shard: string): string | undefined =>
    opts.dispatchKey ? `${opts.dispatchKey}#${shard}` : undefined;
  const base = {
    title: opts.title,
    message: opts.message,
    type: opts.ctype,
    testId: opts.testId,
    createdById: opts.createdById,
    priority: opts.priority,
    requestedChannels: opts.requestedChannels,
  };
  type NotifyData = Parameters<typeof safeNotify>[1];
  const createOrFind = async (data: NotifyData, key: string | undefined): Promise<void> => {
    const id = await safeNotify(db, key ? { ...data, idempotencyKey: key } : data, timing);
    if (id) {
      ids.push(id);
      createdNew += 1;
      return;
    }
    // Null means P2002 loss (winner exists) or genuine store failure.
    // Resolve the exact sharded key: a hit is convergence (counted as an
    // id but NOT as created-new); a miss is a real failure (absent).
    if (key) {
      const existing = await findNotificationIdByKey(db, key);
      if (existing) ids.push(existing);
    }
  };
  const kind = opts.audience.kind;
  if (kind === "INDIVIDUAL") {
    const r = opts.recipients[0];
    await createOrFind(
      {
        ...base,
        audience: "INDIVIDUAL",
        targetStudentId: opts.audience.studentId,
        targetFacultyId: opts.audience.facultyId,
        targetUserId: opts.audience.userId ?? r?.userId,
      },
      keyFor("INDIVIDUAL")
    );
  } else if (kind === "BATCH") {
    await createOrFind(
      { ...base, audience: "BATCH", targetBatchId: opts.audience.batchId },
      keyFor(`BATCH:${opts.audience.batchId ?? "?"}`)
    );
  } else if (kind === "FACULTY" || kind === "ALL_FACULTY") {
    await createOrFind({ ...base, audience: "FACULTY" }, keyFor("FACULTY"));
  } else if (kind === "ALL_STUDENTS") {
    await createOrFind({ ...base, audience: "ALL_STUDENTS" }, keyFor("ALL_STUDENTS"));
  } else if (kind === "REGULAR" || kind === "SCHOLARSHIP") {
    for (const r of opts.recipients) {
      if (!r.studentId) continue;
      await createOrFind(
        { ...base, audience: "INDIVIDUAL", targetStudentId: r.studentId, targetUserId: r.userId },
        keyFor(`STU:${r.studentId}`)
      );
    }
  } else if (kind === "ALL_USERS") {
    await createOrFind({ ...base, audience: "ALL_STUDENTS" }, keyFor("ALL_STUDENTS"));
    await createOrFind({ ...base, audience: "FACULTY" }, keyFor("FACULTY"));
  }
  return { ids, createdNew };
}

/** Server-side audience resolution with role scoping. Never trusts the client. */
async function resolveRecipients(
  db: Db,
  actor: EngineActor,
  audience: EngineAudience
): Promise<{ recipients: Recipient[]; error?: string; code?: string }> {
  const isAdmin = actor.role === "ADMIN";
  const isFaculty = actor.role === "FACULTY";
  const isStudent = actor.role === "STUDENT";
  if (!isAdmin && !isFaculty && !isStudent) {
    return { recipients: [], error: "Not authorized to send notifications.", code: "NOTIFY_FORBIDDEN" };
  }
  // Students may only ever trigger their OWN individual notification
  // (result release on their own submit) — every other audience is denied.
  if (isStudent && audience.kind !== "INDIVIDUAL") {
    return { recipients: [], error: "Not authorized to send notifications.", code: "NOTIFY_FORBIDDEN" };
  }

  let ownBatches: string[] | null = null;
  if (isFaculty) {
    ownBatches = await facultyBatchIds(db, actor.id);
    if (!ownBatches) {
      return { recipients: [], error: "Faculty profile not found.", code: "NOTIFY_FORBIDDEN" };
    }
    // Faculty may only reach their own batches / students in them.
    if (
      audience.kind === "ALL_STUDENTS" ||
      audience.kind === "ALL_USERS" ||
      audience.kind === "FACULTY" ||
      audience.kind === "ALL_FACULTY" ||
      audience.kind === "REGULAR" ||
      audience.kind === "SCHOLARSHIP"
    ) {
      return { recipients: [], error: "Faculty can notify only their assigned batches.", code: "NOTIFY_SCOPE_DENIED" };
    }
    if (audience.kind === "BATCH" && (!audience.batchId || !ownBatches.includes(audience.batchId))) {
      return { recipients: [], error: "Faculty can notify only their assigned batches.", code: "NOTIFY_SCOPE_DENIED" };
    }
  }

  try {
    if (audience.kind === "INDIVIDUAL") {
      if (audience.studentId) {
        const s = await db.student.findUnique({
          where: { id: audience.studentId },
          select: { id: true, name: true, phone: true, userId: true, batchId: true, status: true },
        });
        if (!s) return { recipients: [], error: "Student not found.", code: "NOTIFY_NO_RECIPIENTS" };
        if (isFaculty && (!s.batchId || !ownBatches!.includes(s.batchId))) {
          return { recipients: [], error: "Student is outside your assigned batches.", code: "NOTIFY_SCOPE_DENIED" };
        }
        if (isStudent && s.userId !== actor.id) {
          return { recipients: [], error: "You can only notify yourself.", code: "NOTIFY_FORBIDDEN" };
        }
        if (s.status !== "ACTIVE") return { recipients: [], error: "Student profile is not active.", code: "NOTIFY_NO_RECIPIENTS" };
        return { recipients: [{ studentId: s.id, userId: s.userId ?? undefined, name: s.name, phone: s.phone }] };
      }
      if (audience.facultyId) {
        if (isFaculty) {
          return { recipients: [], error: "Faculty cannot message other faculty.", code: "NOTIFY_SCOPE_DENIED" };
        }
        const f = await db.faculty.findUnique({
          where: { id: audience.facultyId },
          select: { id: true, name: true, phone: true, userId: true, status: true },
        });
        if (!f || f.status !== "ACTIVE") return { recipients: [], error: "Faculty not found.", code: "NOTIFY_NO_RECIPIENTS" };
        return { recipients: [{ facultyId: f.id, userId: f.userId ?? undefined, name: f.name, phone: f.phone }] };
      }
      if (audience.userId) {
        const u = await db.user.findUnique({
          where: { id: audience.userId },
          select: { id: true, name: true, phone: true },
        });
        if (!u) return { recipients: [], error: "User not found.", code: "NOTIFY_NO_RECIPIENTS" };
        return { recipients: [{ userId: u.id, name: u.name, phone: u.phone ?? "" }] };
      }
      return { recipients: [], error: "Individual audience needs studentId, facultyId or userId.", code: "NOTIFY_BAD_AUDIENCE" };
    }

    if (audience.kind === "BATCH" && audience.batchId) {
      const list = await db.student.findMany({
        where: { batchId: audience.batchId, status: "ACTIVE" },
        select: { id: true, name: true, phone: true, userId: true },
      });
      return {
        recipients: list.map((s) => ({ studentId: s.id, userId: s.userId ?? undefined, name: s.name, phone: s.phone })),
      };
    }

    if (audience.kind === "FACULTY" || audience.kind === "ALL_FACULTY") {
      const list = await db.faculty.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, phone: true, userId: true },
      });
      return {
        recipients: list.map((f) => ({ facultyId: f.id, userId: f.userId ?? undefined, name: f.name, phone: f.phone })),
      };
    }

    if (
      audience.kind === "ALL_STUDENTS" ||
      audience.kind === "REGULAR" ||
      audience.kind === "SCHOLARSHIP" ||
      audience.kind === "ALL_USERS"
    ) {
      const studentType =
        audience.kind === "REGULAR" || audience.kind === "SCHOLARSHIP" ? audience.kind : undefined;
      const [students, faculty] =
        audience.kind === "ALL_USERS"
          ? await Promise.all([
              db.student.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, phone: true, userId: true } }),
              db.faculty.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, phone: true, userId: true } }),
            ])
          : [
              await db.student.findMany({
                where: { status: "ACTIVE", ...(studentType ? { studentType } : {}) },
                select: { id: true, name: true, phone: true, userId: true },
              }),
              [],
            ];
      return {
        recipients: [
          ...students.map((s) => ({ studentId: s.id, userId: s.userId ?? undefined, name: s.name, phone: s.phone })),
          ...faculty.map((f) => ({ facultyId: f.id, userId: f.userId ?? undefined, name: f.name, phone: f.phone })),
        ],
      };
    }

    return { recipients: [], error: "Unsupported audience.", code: "NOTIFY_BAD_AUDIENCE" };
  } catch {
    return { recipients: [], error: "Could not resolve recipients.", code: "NOTIFY_RESOLVE_FAILED" };
  }
}

export async function dispatchNotification(db: Db, input: DispatchInput): Promise<DispatchReport> {
  const fail = (code: string, error: string): DispatchReport => ({
    ok: false,
    code,
    event: typeof input.event === "string" ? input.event : "UNKNOWN",
    inApp: { state: "SKIPPED" },
    sms: emptySummary("SKIPPED"),
    push: emptySummary("SKIPPED"),
    error,
  });
  try {
    if (!isKnownEvent(input.event)) return fail("NOTIFY_BAD_EVENT", "Unknown notification event.");
    const event: NotificationEvent = input.event;
    const title = String(input.title ?? "").trim();
    const message = String(input.message ?? "").trim();
    if (!title || !message) return fail("NOTIFY_BAD_BODY", "Title and message are required.");
    if (title.length > 120 || message.length > 1000) return fail("NOTIFY_BAD_BODY", "Title (120) / message (1000) too long.");

    const channels: NotifyChannel[] = resolveChannels(event, input.channels);
    // Phase 18c — priority is resolved, validated and carried through every
    // report below (never discarded).
    const priority: NotifyPriority = resolvePriority(event, input.priority);
    const failP = (code: string, error: string): DispatchReport => ({ ...fail(code, error), priority });

    // Phase 18c — strict EVENT ↔ TEMPLATE pairing (UI never trusted).
    const requestedTemplate =
      input.templateKey && isSmsTemplateKey(input.templateKey) ? input.templateKey : undefined;
    const templateKey: SmsTemplateKey = requestedTemplate ?? EVENT_TEMPLATE[event] ?? "ADMIN_ANNOUNCEMENT";
    if (!isTemplateAllowedForEvent(event, templateKey)) {
      return failP("NOTIFY_BAD_TEMPLATE", `Template ${templateKey} cannot be used for ${event}.`);
    }

    const audience = input.audience;
    if (!audience || typeof audience.kind !== "string") return failP("NOTIFY_BAD_AUDIENCE", "Audience is required.");

    const ctype = canonicalNotificationType(event);
    const createdById = input.createdById ?? input.actor.id;

    const { recipients, error, code } = await resolveRecipients(db, input.actor, audience);
    if (error) return failP(code ?? "NOTIFY_NO_RECIPIENTS", error);
    if (recipients.length === 0) return failP("NOTIFY_NO_RECIPIENTS", "Audience resolved to nobody.");

    // Phase 18c-step3 — persistent dispatch key (caller → natural → fallback
    // bucket). Survives restart/instances; concurrent retries share the key.
    const dispatchKey = resolveDispatchKey(event, input);

    // Idempotency: EVERY event (automatic and manual) is deduped. A second
    // delivery of the same logical send persists and sends nothing.
    // Race-safe: persistent unique first, then legacy natural lookup.
    {
      const persistentDup = await findPersistentDuplicate(db, dispatchKey);
      if (persistentDup) {
        return {
          ok: true,
          code: "DUPLICATE",
          event,
          priority,
          duplicate: true,
          inApp: { state: "SKIPPED" },
          sms: emptySummary("DUPLICATE"),
          push: emptySummary("DUPLICATE"),
        };
      }
      const dup = await findDuplicate(db, event, input);
      if (dup) {
        return {
          ok: true,
          code: "DUPLICATE",
          event,
          priority,
          duplicate: true,
          inApp: { state: "SKIPPED" },
          sms: emptySummary("DUPLICATE"),
          push: emptySummary("DUPLICATE"),
        };
      }
    }

    // Scheduling: persist SCHEDULED state honestly; execution needs cron.
    // SCHEDULED is never reported as SENT and no PATCH may promote it.
    // Retry foundation only: CREATED deliveries persist (no worker yet).
    if (input.scheduledAt instanceof Date && !Number.isNaN(input.scheduledAt.getTime()) && input.scheduledAt.getTime() > Date.now() + 60_000) {
      const persisted = await persistInAppRows(db, {
        title,
        message,
        ctype,
        audience,
        recipients,
        testId: input.testId,
        createdById,
        scheduledAt: input.scheduledAt,
        dispatchKey,
        priority,
        requestedChannels: channels,
      });
      const ids = persisted.ids;
      // Phase 18c-step5 (P1): createdNew === 0 means every shard pre-existed
      // (duplicate retry) or total store failure — same race-safe handling as
      // the immediate path. A short-but-nonzero set is a genuinely partial
      // fan-out: abort with an explicit error and schedule nothing, rather
      // than persisting CREATED deliveries against misattributed headers.
      if (persisted.createdNew === 0) {
        const raced = (await findPersistentDuplicate(db, dispatchKey)) || (await findDuplicate(db, event, input));
        if (raced) {
          return {
            ok: true,
            code: "DUPLICATE",
            event,
            priority,
            duplicate: true,
            inApp: { state: "SKIPPED" },
            sms: emptySummary("DUPLICATE"),
            push: emptySummary("DUPLICATE"),
          };
        }
        return failP("NOTIFY_STORE_FAILED", "Could not persist the scheduled notification.");
      }
      if (ids.length < expectedHeaderCount(audience.kind, recipients)) {
        return failP(
          "NOTIFY_PARTIAL_FANOUT",
          `Only ${ids.length} of ${expectedHeaderCount(audience.kind, recipients)} notification headers persisted. Nothing was scheduled; retry with a new idempotency key. The same key will not resend.`
        );
      }
      // Persist CREATED deliveries for every requested channel/recipient
      // (scheduled ≠ sent; no attempts yet, no worker).
      try {
        const now = new Date();
        const headerFor = scheduledHeaderFor(audience.kind, ids, recipients);
        for (const r of recipients) {
          const hid = headerFor(r);
          if (!hid) continue;
          const rk = recipientKeyFor(r);
          for (const ch of channels) {
            await safeDeliveryCreate(db, {
              notificationId: hid,
              userId: r.userId,
              studentId: r.studentId,
              facultyId: r.facultyId,
              recipientKey: rk,
              channel: ch,
              status: "CREATED",
              priority,
              provider: providerForChannel(ch),
              retryable: false,
              attemptCount: 0,
              queuedAt: now,
            });
          }
        }
      } catch {
        /* audit best-effort */
      }
      return {
        ok: true,
        code: "SCHEDULED",
        event,
        priority,
        scheduled: true,
        inApp: { state: "SCHEDULED", id: ids[0] },
        sms: emptySummary("SCHEDULED"),
        push: emptySummary("SCHEDULED"),
      };
    }

    const smsWanted = channels.includes("SMS");
    const smsCount = smsWanted ? recipients.length : 0;
    if (smsWanted && smsCount > MASS_SMS_INTERACTIVE_LIMIT && !input.internal && !input.confirmMassSend) {
      // Never send mass SMS from a single accidental click.
      return failP("MASS_CONFIRM_REQUIRED", `This reaches ${smsCount} SMS recipients. Confirm mass SMS explicitly.`);
    }

    // ---- IN-APP (durable record; never depends on SMS/push) ----
    // Phase 18c-step3: headers always persist as the audit anchor (even for
    // SMS-only lanes) with priority + requestedChannels + sharded
    // idempotencyKey. The mine feed hides non-IN_APP headers (see
    // app/api/notifications/mine) so SMS-only audit rows never leak in-app.
    let inAppIds: string[] = [];
    const persistedHeaders = await persistInAppRows(db, {
      title,
      message,
      ctype,
      audience,
      recipients,
      testId: input.testId,
      createdById,
      dispatchKey,
      priority,
      requestedChannels: channels,
    });
    inAppIds = persistedHeaders.ids;
    // Race-safe: createdNew === 0 means every shard pre-existed (a concurrent
    // retry lost the unique race) or total store failure. The winner's key is
    // now visible — report DUPLICATE and send nothing on any channel.
    if (persistedHeaders.createdNew === 0) {
      const raced = (await findPersistentDuplicate(db, dispatchKey)) || (await findDuplicate(db, event, input));
      if (raced) {
        return {
          ok: true,
          code: "DUPLICATE",
          event,
          priority,
          duplicate: true,
          inApp: { state: "SKIPPED" },
          sms: emptySummary("DUPLICATE"),
          push: emptySummary("DUPLICATE"),
        };
      }
    }
    // Phase 18c-step5 (P1): some shards created, some missing — a genuinely
    // partial fan-out (store failure or interleaved duplicate attempt). Never
    // dispatch SMS/push against misattributed headers: fail explicitly with
    // nothing sent. The same key will not resend (DUPLICATE on retry); use a
    // new idempotency key to send again.
    if (inAppIds.length > 0 && inAppIds.length < expectedHeaderCount(audience.kind, recipients)) {
      return failP(
        "NOTIFY_PARTIAL_FANOUT",
        `Only ${inAppIds.length} of ${expectedHeaderCount(audience.kind, recipients)} notification headers persisted. Nothing was sent; retry with a new idempotency key.`
      );
    }
    const headerFor = scheduledHeaderFor(audience.kind, inAppIds, recipients);
    const inAppWanted = channels.includes("IN_APP");
    // Persist IN_APP deliveries (DELIVERED = durable local write visible to
    // the recipient). One channel failing never affects the others.
    if (inAppWanted && inAppIds.length > 0) {
      const nowInApp = new Date();
      for (const r of recipientsForInApp(audience.kind, recipients)) {
        const hid = headerFor(r);
        if (!hid) continue;
        await safeDeliveryCreate(db, {
          notificationId: hid,
          userId: r.userId,
          studentId: r.studentId,
          facultyId: r.facultyId,
          recipientKey: recipientKeyFor(r),
          channel: "IN_APP",
          status: "DELIVERED",
          priority,
          provider: "IN_APP",
          retryable: false,
          attemptCount: 1,
          queuedAt: nowInApp,
          deliveredAt: nowInApp,
          lastAttemptAt: nowInApp,
        });
      }
    }

    // ---- SMS (Msg91Provider; independent of in-app/push) ----
    const sms: ChannelSummary = emptySummary("SKIPPED");
    if (smsWanted) {
      const flowId = flowIdFor(templateKey);
      if (!flowId) {
        sms.state = "SKIPPED";
        sms.skipped = recipients.length;
        sms.error = `SMS template ${templateKey} is not configured. Set MSG91_FLOW_ID_${templateKey} to enable it.`;
        for (const r of recipients) {
          const hid = headerFor(r);
          if (!hid) continue;
          await safeDeliveryCreate(db, {
            notificationId: hid,
            userId: r.userId,
            studentId: r.studentId,
            facultyId: r.facultyId,
            recipientKey: recipientKeyFor(r),
            channel: "SMS",
            status: "SKIPPED",
            priority,
            provider: "MSG91",
            errorCode: "SMS_TEMPLATE_NOT_CONFIGURED",
            errorMessage: `SMS template ${templateKey} is not configured.`,
            retryable: false,
            attemptCount: 0,
            queuedAt: new Date(),
          });
        }
      } else {
        // Recipient-supplied variables (names, batch) are filled per
        // recipient below; only the remaining required variables are
        // validated up front and reported structurally.
        const staticVars: Record<string, unknown> = { academyName: academyName(), message, ...(input.vars ?? {}) };
        const { text: _text, missing: rawMissing } = renderSmsTemplate(templateKey, staticVars);
        void _text;
        const staticMissing = rawMissing.filter((v) => !RECIPIENT_SUPPLIED_VARS.has(v));
        if (staticMissing.length > 0) {
          sms.state = "FAILED";
          sms.skipped = recipients.length;
          sms.error = `Missing SMS variables for ${templateKey}: ${staticMissing.join(", ")}.`;
          // Phase 18c-step5 (P2) semantics: a config failure is never
          // attempted (attemptCount 0, retryable false) but audited as FAILED
          // (SMS_MISSING_VARS) so it is visible in failed-only views. The
          // live report additionally counts these recipients as skipped to
          // keep attempted+skipped capacity accounting exact.
          for (const r of recipients) {
            const hid = headerFor(r);
            if (!hid) continue;
            await safeDeliveryCreate(db, {
              notificationId: hid,
              userId: r.userId,
              studentId: r.studentId,
              facultyId: r.facultyId,
              recipientKey: recipientKeyFor(r),
              channel: "SMS",
              status: "FAILED",
              priority,
              provider: "MSG91",
              errorCode: "SMS_MISSING_VARS",
              errorMessage: `Missing SMS variables: ${staticMissing.join(", ")}.`,
              retryable: false,
              attemptCount: 0,
              queuedAt: new Date(),
              failedAt: new Date(),
              lastAttemptAt: new Date(),
            });
          }
        } else {
          const needsRecipientName = rawMissing.some((v) => v === "studentName" || v === "facultyName");
          const batchName =
            audience.batchId
              ? await db.batch
                  .findUnique({ where: { id: audience.batchId }, select: { name: true } })
                  .then((b) => (b ? ` (${b.name})` : ""))
                  .catch(() => "")
              : "";
          const limited = recipients.slice(0, MAX_SMS_PER_DISPATCH);
          sms.attempted = limited.length;
          sms.skipped = recipients.length - limited.length;
          for (const r of limited) {
            const hid = headerFor(r);
            const rk = recipientKeyFor(r);
            const now = new Date();
            if (needsRecipientName && !r.name) {
              sms.skipped += 1;
              if (hid) {
                await safeDeliveryCreate(db, {
                  notificationId: hid,
                  userId: r.userId,
                  studentId: r.studentId,
                  facultyId: r.facultyId,
                  recipientKey: rk,
                  channel: "SMS",
                  status: "SKIPPED",
                  priority,
                  provider: "MSG91",
                  errorCode: "SMS_INVALID_RECIPIENT",
                  errorMessage: "Recipient name missing.",
                  retryable: false,
                  attemptCount: 0,
                  queuedAt: now,
                });
              }
              continue;
            }
            const normalized = normalizeIndianMobile(r.phone);
            if (!normalized) {
              sms.skipped += 1;
              if (hid) {
                await safeDeliveryCreate(db, {
                  notificationId: hid,
                  userId: r.userId,
                  studentId: r.studentId,
                  facultyId: r.facultyId,
                  recipientKey: rk,
                  channel: "SMS",
                  status: "SKIPPED",
                  priority,
                  provider: "MSG91",
                  errorCode: "SMS_INVALID_RECIPIENT",
                  errorMessage: "Invalid recipient number.",
                  retryable: false,
                  attemptCount: 0,
                  queuedAt: now,
                });
              }
              continue;
            }
            const flowVars: Record<string, string> = {};
            for (const [k, v] of Object.entries({ ...staticVars, studentName: r.name, facultyName: r.name, batchName })) {
              if (v !== undefined && v !== null && String(v) !== "") flowVars[k] = String(v).slice(0, 500);
            }
            try {
              const res = await sendSms(normalized, flowId, flowVars);
              if (res.ok) {
                sms.sent += 1;
                if (hid) {
                  await safeDeliveryCreate(db, {
                    notificationId: hid,
                    userId: r.userId,
                    studentId: r.studentId,
                    facultyId: r.facultyId,
                    recipientKey: rk,
                    channel: "SMS",
                    status: "SENT",
                    priority,
                    provider: "MSG91",
                    retryable: false,
                    attemptCount: 1,
                    queuedAt: now,
                    sentAt: new Date(),
                    lastAttemptAt: new Date(),
                  });
                }
              } else {
                sms.failed += 1;
                if (res.retryable) sms.retryable = true;
                if (hid) {
                  await safeDeliveryCreate(db, {
                    notificationId: hid,
                    userId: r.userId,
                    studentId: r.studentId,
                    facultyId: r.facultyId,
                    recipientKey: rk,
                    channel: "SMS",
                    status: "FAILED",
                    priority,
                    provider: "MSG91",
                    errorCode: res.code || "SMS_PROVIDER_ERROR",
                    errorMessage: "Could not send the SMS.",
                    retryable: !!res.retryable,
                    attemptCount: 1,
                    nextAttemptAt: retryAt(!!res.retryable),
                    queuedAt: now,
                    failedAt: new Date(),
                    lastAttemptAt: new Date(),
                  });
                }
              }
            } catch {
              sms.failed += 1;
              sms.retryable = true;
              if (hid) {
                await safeDeliveryCreate(db, {
                  notificationId: hid,
                  userId: r.userId,
                  studentId: r.studentId,
                  facultyId: r.facultyId,
                  recipientKey: rk,
                  channel: "SMS",
                  status: "FAILED",
                  priority,
                  provider: "MSG91",
                  errorCode: "SMS_PROVIDER_ERROR",
                  errorMessage: "Could not reach the SMS service.",
                  retryable: true,
                  attemptCount: 1,
                  nextAttemptAt: retryAt(true),
                  queuedAt: now,
                  failedAt: new Date(),
                  lastAttemptAt: new Date(),
                });
              }
            }
          }
          // Persist SKIPPED rows for fan-out overflow (never silently drop).
          const overflow = recipients.slice(MAX_SMS_PER_DISPATCH);
          for (const r of overflow) {
            const hid = headerFor(r);
            if (!hid) continue;
            await safeDeliveryCreate(db, {
              notificationId: hid,
              userId: r.userId,
              studentId: r.studentId,
              facultyId: r.facultyId,
              recipientKey: recipientKeyFor(r),
              channel: "SMS",
              status: "SKIPPED",
              priority,
              provider: "MSG91",
              errorCode: "FAN_OUT_CAPPED",
              errorMessage: `SMS fan-out capped at ${MAX_SMS_PER_DISPATCH} (worker pending).`,
              retryable: false,
              attemptCount: 0,
              queuedAt: new Date(),
            });
          }
          sms.state = sms.failed === 0 && sms.sent > 0 ? "SENT" : sms.sent > 0 ? "PARTIAL" : "FAILED";
          if (sms.attempted === 0) sms.state = "SKIPPED";
          // Never silently discard: the fan-out cap truncates, the report
          // states exactly how many were skipped (a queue/worker drains the
          // remainder in a later phase — no queue is implemented here).
          if (recipients.length > MAX_SMS_PER_DISPATCH) {
            sms.state = sms.sent > 0 ? "PARTIAL" : sms.state;
            sms.error = `SMS fan-out capped at ${MAX_SMS_PER_DISPATCH}; skipped ${sms.skipped} (worker pending).`;
          }
        }
      }
    }

    // ---- PUSH (VAPID provider stub; independent of SMS/in-app) ----
    const push: ChannelSummary = emptySummary("SKIPPED");
    if (channels.includes("PUSH")) {
      const userIds = [...new Set(recipients.map((r) => r.userId).filter((u): u is string => !!u))];
      push.attempted = userIds.length;
      const byUser = new Map<string, Recipient>();
      for (const r of recipients) if (r.userId && !byUser.has(r.userId)) byUser.set(r.userId, r);
      for (const userId of userIds) {
        const rep = byUser.get(userId);
        const hid = rep ? headerFor(rep) : undefined;
        const rk = rep ? recipientKeyFor(rep) : `user:${userId}`;
        const now = new Date();
        try {
          const subs = await db.pushSubscription.findMany({ where: { userId }, select: { endpoint: true } });
          if (subs.length === 0) {
            push.skipped += 1;
            if (hid && rep) {
              await safeDeliveryCreate(db, {
                notificationId: hid,
                userId,
                studentId: rep.studentId,
                facultyId: rep.facultyId,
                recipientKey: rk,
                channel: "PUSH",
                status: "SKIPPED",
                priority,
                provider: "WEB_PUSH",
                errorCode: "PUSH_NO_SUBSCRIPTION",
                errorMessage: "No push subscription.",
                retryable: false,
                attemptCount: 0,
                queuedAt: now,
              });
            }
            continue;
          }
          const res = await sendPush(db, userId, { title, message });
          if (res.ok) {
            push.sent += 1;
            if (hid && rep) {
              await safeDeliveryCreate(db, {
                notificationId: hid,
                userId,
                studentId: rep.studentId,
                facultyId: rep.facultyId,
                recipientKey: rk,
                channel: "PUSH",
                status: "SENT",
                priority,
                provider: "WEB_PUSH",
                retryable: false,
                attemptCount: 1,
                queuedAt: now,
                sentAt: new Date(),
                lastAttemptAt: new Date(),
              });
            }
          } else {
            push.failed += 1;
            if (hid && rep) {
              await safeDeliveryCreate(db, {
                notificationId: hid,
                userId,
                studentId: rep.studentId,
                facultyId: rep.facultyId,
                recipientKey: rk,
                channel: "PUSH",
                status: "FAILED",
                priority,
                provider: "WEB_PUSH",
                errorCode: res.code || "PUSH_PROVIDER_ERROR",
                errorMessage: "Push delivery failed.",
                retryable: false,
                attemptCount: 1,
                queuedAt: now,
                failedAt: new Date(),
                lastAttemptAt: new Date(),
              });
            }
          }
        } catch {
          push.failed += 1;
          if (hid && rep) {
            await safeDeliveryCreate(db, {
              notificationId: hid,
              userId,
              studentId: rep.studentId,
              facultyId: rep.facultyId,
              recipientKey: rk,
              channel: "PUSH",
              status: "FAILED",
              priority,
              provider: "WEB_PUSH",
              errorCode: "PUSH_PROVIDER_ERROR",
              errorMessage: "Push delivery failed.",
              retryable: false,
              attemptCount: 1,
              queuedAt: now,
              failedAt: new Date(),
              lastAttemptAt: new Date(),
            });
          }
        }
      }
      // Recipients without any user identity can never receive push.
      // Phase 18c-step5 (P2) semantics: these persist PUSH_NO_IDENTITY
      // SKIPPED rows, so push totals in the admin audit include them while
      // the live report's push.attempted counts only identity-bearing users.
      const noIdentity = recipients.filter((r) => !r.userId);
      for (const r of noIdentity) {
        const hid = headerFor(r);
        if (!hid) continue;
        await safeDeliveryCreate(db, {
          notificationId: hid,
          studentId: r.studentId,
          facultyId: r.facultyId,
          recipientKey: recipientKeyFor(r),
          channel: "PUSH",
          status: "SKIPPED",
          priority,
          provider: "WEB_PUSH",
          errorCode: "PUSH_NO_IDENTITY",
          errorMessage: "No user identity for push.",
          retryable: false,
          attemptCount: 0,
          queuedAt: new Date(),
        });
      }
      push.state = push.failed === 0 && push.sent > 0 ? "SENT" : push.sent > 0 ? "PARTIAL" : push.attempted === 0 ? "SKIPPED" : "FAILED";
    }

    const inAppState = inAppWanted ? (inAppIds.length > 0 ? "SENT" as const : "SKIPPED" as const) : ("SKIPPED" as const);
    const ok = (inAppWanted && inAppIds.length > 0) || sms.sent > 0 || push.sent > 0 || !inAppWanted;
    // Audit trail: event + counts only. NEVER phones, message text, keys.
    if (sms.attempted > 0 || !ok) {
      console.warn(
        `[notify] event=${event} inapp=${inAppIds.length > 0 ? "created" : "skipped"} sms=${sms.sent}/${sms.attempted} push=${push.sent}/${push.attempted} ok=${ok}`
      );
    }
    return {
      ok,
      code: ok ? "DISPATCHED" : "NOTIFY_STORE_FAILED",
      event,
      priority,
      error: ok ? undefined : "Could not create the notification.",
      inApp: { state: inAppState, ...(inAppWanted && inAppIds.length > 0 ? { id: inAppIds[0] } : {}) },
      sms,
      push,
    };
  } catch {
    return {
      ok: false,
      code: "ENGINE_ERROR",
      event: typeof input.event === "string" ? input.event : "UNKNOWN",
      error: "Notification engine error.",
      inApp: { state: "SKIPPED" },
      sms: emptySummary("SKIPPED"),
      push: emptySummary("SKIPPED"),
    };
  }
}

/** Audience size estimate for the admin center (no dispatch). ADMIN only. */
export async function estimateAudience(
  db: Db,
  audience: EngineAudience
): Promise<{ count: number; smsEligible: number }> {
  try {
    if (audience.kind === "INDIVIDUAL") return { count: 1, smsEligible: 1 };
    if (audience.kind === "BATCH" && audience.batchId) {
      const count = await db.student.count({ where: { batchId: audience.batchId, status: "ACTIVE" } });
      return { count, smsEligible: count };
    }
    if (audience.kind === "FACULTY" || audience.kind === "ALL_FACULTY") {
      const count = await db.faculty.count({ where: { status: "ACTIVE" } });
      return { count, smsEligible: count };
    }
    if (audience.kind === "ALL_USERS") {
      const [s, f] = await Promise.all([
        db.student.count({ where: { status: "ACTIVE" } }),
        db.faculty.count({ where: { status: "ACTIVE" } }),
      ]);
      return { count: s + f, smsEligible: s + f };
    }
    const count = await db.student.count({
      where: {
        status: "ACTIVE",
        ...(audience.kind === "REGULAR" || audience.kind === "SCHOLARSHIP" ? { studentType: audience.kind } : {}),
      },
    });
    return { count, smsEligible: count };
  } catch {
    return { count: 0, smsEligible: 0 };
  }
}
