"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle2, Send } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminStatusBadge, statusToneFor } from "@/components/admin/AdminStatusBadge";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { Button } from "@/components/ui/primitives";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { getNotifications } from "@/services/adminApi";
import type { AdminNotification } from "@/data/admin";

const DEFAULT_AUDIENCES = ["All students", "Faculty", "JEE 2027-A", "NEET 2027-A", "AMU-XI", "JMI-IX", "Foundation X", "Individual student"];

const CHANNEL_OPTIONS = ["IN_APP", "PUSH", "SMS"] as const;
const PRIORITY_OPTIONS = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
// Phase 18b — admin template picker (SMS text lives in lib/sms-templates.ts;
// provider DLT/Flow IDs resolve from MSG91_FLOW_ID_<KEY> server-side).
const TEMPLATE_OPTIONS = [
  { key: "", label: "No SMS template (in-app/push text only)" },
  { key: "BATCH_ANNOUNCEMENT", label: "Batch announcement" },
  { key: "ADMIN_ANNOUNCEMENT", label: "Admin announcement" },
  { key: "ACADEMIC_NOTICE", label: "Academic notice" },
  { key: "TEST_PUBLISHED", label: "Test published" },
  { key: "TEST_REMINDER", label: "Test reminder" },
  { key: "RESULT_RELEASED", label: "Result released" },
  { key: "ATTENDANCE_ABSENT", label: "Absent alert" },
  { key: "ADMISSION_UPDATE", label: "Admission update" },
  { key: "ACCESS_GRANTED", label: "Access granted" },
  { key: "ACCESS_REVOKED", label: "Access revoked" },
  { key: "FACULTY_NOTIFICATION", label: "Faculty notice" },
  { key: "EMERGENCY_ALERT", label: "Emergency alert" },
] as const;

interface BatchListItem {
  name?: string;
}

interface NotificationApiItem {
  id?: string;
  title?: string;
  message?: string;
  status?: string;
  createdAt?: string;
  scheduledAt?: string;
}

function audienceEnumFor(label: string): string {
  if (label === "All students") return "ALL_STUDENTS";
  if (label === "Faculty") return "FACULTY";
  if (label === "Individual student") return "INDIVIDUAL";
  return "BATCH";
}

// Phase 18c — one idempotency key per explicit Send action. Generated once
// when the composer opens and reused across HTTP retries, so a network
// timeout retry can never create duplicate SMS/push/in-app notifications.
// Never a bare timestamp.
function newIdempotencyKey(): string {
  try {
    const g = globalThis.crypto;
    if (g && typeof g.randomUUID === "function") return `ADMIN_ANNOUNCEMENT:${g.randomUUID()}`;
  } catch {
    /* random fallback below */
  }
  const r = `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
  return `ADMIN_ANNOUNCEMENT:${r}`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { ready: authReady, isAdmin } = useAdminAuth();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<AdminNotification[]>([]);
  const [audiences, setAudiences] = useState<string[]>(DEFAULT_AUDIENCES);
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState(DEFAULT_AUDIENCES[0]);
  const [schedule, setSchedule] = useState("");
  const [channels, setChannels] = useState<string[]>(["IN_APP", "PUSH"]);
  const [priority, setPriority] = useState<string>("NORMAL");
  const [templateKey, setTemplateKey] = useState<string>("");
  // Phase 18c — idempotency key for this composer session (one per Send
  // action, reused on retry, regenerated for the next send).
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [estimate, setEstimate] = useState<{ count: number; smsEligible: number } | null>(null);
  const [confirmMassSms, setConfirmMassSms] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Phase 17 — send/schedule failures stay in the modal (nothing faked).
  const [formError, setFormError] = useState<string | null>(null);
  // Phase 18c-step3 — delivery history filters (server-side, bounded).
  const [fChannel, setFChannel] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPriority, setFPriority] = useState("");

  const [fEvent, setFEvent] = useState("");
  const [fFailedOnly, setFFailedOnly] = useState(false);
  // Phase 18c-step5 (P0) — delivery-audit availability. When the server flags
  // deliveryAudit "unavailable", counts are zero/partial and must not be read
  // as audited. The banner below makes that unmissable.
  const [auditWarning, setAuditWarning] = useState<string | null>(null);
  // Phase 18c-step3 — delivery history (persisted audit). Every number comes
  // from the server (Notification + NotificationDelivery rows); filters are
  // server-side and bounded. Detail lives at /admin/notifications/[id].
  // Phase 18c-step5 (P0/P1): the server reports deliveryAudit ok|unavailable
  // and rejects unappliable filters with DELIVERY_AUDIT_UNAVAILABLE (409).
  // Both surface here as a warning — never as silent zeroes or silent
  // unfiltered rows.
  const refreshHistory = async (over?: { channel?: string; status?: string; priority?: string; event?: string; failedOnly?: boolean }) => {
    try {
      const c = over?.channel ?? fChannel;
      const s = over?.status ?? fStatus;
      const p = over?.priority ?? fPriority;
      const e = over?.event ?? fEvent;
      const f = over?.failedOnly ?? fFailedOnly;
      const qs = new URLSearchParams({ limit: "100" });
      if (c) qs.set("channel", c);
      if (s) qs.set("status", s);
      if (p) qs.set("priority", p);
      if (e) qs.set("event", e);
      if (f) qs.set("failedOnly", "1");
      const res = await fetch(`/api/notifications?${qs.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { items?: AdminNotification[]; deliveryAudit?: string; deliveryAuditReason?: string };
        error?: string;
        code?: string;
      };
      if (!res.ok || !json?.success) {
        if (json?.code === "DELIVERY_AUDIT_UNAVAILABLE") {
          setAuditWarning(json?.error ?? "Delivery audit is unavailable for the requested filters.");
        }
        return;
      }
      if (Array.isArray(json?.data?.items)) setRows(json.data.items as AdminNotification[]);
      if (json?.data?.deliveryAudit === "unavailable") {
        setAuditWarning(
          json?.data?.deliveryAuditReason === "migration-missing"
            ? "Delivery audit unavailable: the notification delivery migration is not applied. Counts below are incomplete."
            : "Delivery audit unavailable: delivery queries failed. Counts below are incomplete."
        );
      } else {
        setAuditWarning(null);
      }
    } catch {
      /* keep current rows */
    }
  };

  useEffect(() => {
    if (!authReady || !isAdmin) return;
    (async () => {
      // Real fetch: GET /api/batches for the audience list (fallback to defaults when DB is unavailable).
      try {
        const res = await fetch("/api/batches", { cache: "no-store" });
        const json = (await res.json()) as { success?: boolean; data?: { items?: BatchListItem[] } };
        if (json?.success && Array.isArray(json?.data?.items) && (json.data.items as BatchListItem[]).length > 0) {
          const names = (json.data.items as BatchListItem[]).map((b) => String(b.name ?? "").trim()).filter(Boolean);
          if (names.length > 0) {
            setAudiences(["All students", "Faculty", ...names, "Individual student"]);
          }
        }
      } catch {
        // Keep default audience list.
      }
      setRows(await getNotifications());
      // Phase 18c-step5 (P0): re-sync through the audit-flagged history
      // endpoint so an unavailable delivery schema surfaces its warning on
      // first paint (demo fallback above stays when the server is down).
      await refreshHistory();
      setReady(true);
    })();
  }, [router, authReady, isAdmin, refreshHistory]);

  // Phase 18c — the dispatch event follows the picked template (same-name
  // event when one exists). Mandatory events lock their channels: the server
  // enforces the policy even if the browser JSON is modified.
  const derivedEvent = templateKey ? templateKey : "ADMIN_ANNOUNCEMENT";
  const mandatoryLocked = derivedEvent === "EMERGENCY_ALERT";

  const openComposer = () => {
    setTitle("");
    setMessage("");
    setFormError(null);
    setConfirmMassSms(false);
    setEstimate(null);
    setIdempotencyKey(newIdempotencyKey());
    setModal(true);
  };

  const send = async (now: boolean) => {
    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();
    if (!trimmedTitle || !trimmedMessage || busy) return;
    // Mass SMS guard: SMS to more than one recipient needs explicit confirm.
    if (now && channels.includes("SMS") && (estimate?.smsEligible ?? 0) > 1 && !confirmMassSms) {
      setFormError(`This reaches ~${estimate?.smsEligible} SMS recipients. Tick the mass-SMS confirmation to proceed.`);
      return;
    }
    // Reuse this composer session's idempotency key across retries — never
    // mint a new one for the same logical send.
    const key = idempotencyKey || newIdempotencyKey();
    if (!idempotencyKey) setIdempotencyKey(key);
    setBusy(true);
    setFormError(null);
    const flash = (msg: string) => {
      setSaved(msg);
      window.setTimeout(() => setSaved(null), 5000);
    };
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          message: trimmedMessage,
          audience: audienceEnumFor(audience),
          event: derivedEvent,
          channels: mandatoryLocked ? ["SMS", "PUSH", "IN_APP"] : channels,
          priority,
          ...(templateKey ? { templateKey } : {}),
          ...(now ? { sendNow: true } : { sendNow: false, ...(schedule ? { scheduledAt: schedule } : {}) }),
          ...(confirmMassSms ? { confirmMassSend: true } : {}),
          idempotencyKey: key,
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { item?: NotificationApiItem; delivery?: { sms?: { sent?: number; failed?: number; skipped?: number; error?: string }; push?: { sent?: number; failed?: number; skipped?: number }; code?: string; priority?: string } }; error?: string; code?: string } | null;
      const created = json?.data?.item;
      if (res.ok && json?.success && created) {
        if (json?.data?.delivery?.code === "DUPLICATE") {
          setModal(false);
          setIdempotencyKey("");
          flash("Duplicate ignored — this send was already delivered. Nothing re-sent.");
          return;
        }
        const sms = json?.data?.delivery?.sms;
        const skipped = sms?.skipped ?? 0;
        setModal(false);
        setTitle("");
        setMessage("");
        setConfirmMassSms(false);
        setIdempotencyKey("");
        // Phase 18c-step3 — history is server-authoritative (persisted audit):
        // refetch so every number shown comes from the database.
        void refreshHistory();
        flash(now ? `Notification sent (priority ${json?.data?.delivery?.priority ?? priority}).${sms ? ` SMS ${sms.sent ?? 0} sent, ${sms.failed ?? 0} failed, ${skipped} skipped.${sms.error ? ` ${sms.error}` : ""}` : ""}` : "Notification scheduled — it will be delivered at the scheduled time.");
        return;
      }
      if (json?.code === "MASS_CONFIRM_REQUIRED") {
        setFormError(json?.error ?? "Mass SMS needs explicit confirmation.");
        return;
      }
      if (json?.code === "DUPLICATE") {
        setFormError("Duplicate ignored — this send was already delivered. Nothing re-sent.");
        return;
      }
      setFormError(json?.error ?? "Could not save the notification. Nothing was sent.");
    } catch {
      // Phase 17 — notifications are server-authoritative. Never create
      // local rows that mislead the admin into thinking a broadcast went out.
      // Retrying reuses the same idempotency key (see above).
      setFormError("Cannot reach the server. Nothing was sent or scheduled. Retry safely — the same send will not duplicate.");
    } finally {
      setBusy(false);
    }
  };

  // Phase 18b — estimated audience before sending (ADMIN estimate endpoint).
  const refreshEstimate = async (label: string) => {
    setEstimate(null);
    try {
      const res = await fetch(`/api/notifications?estimate=1&audience=${encodeURIComponent(audienceEnumFor(label))}`, { cache: "no-store" });
      const json = (await res.json()) as { success?: boolean; data?: { estimate?: { count: number; smsEligible: number } } };
      if (json?.success && json?.data?.estimate) setEstimate(json.data.estimate);
    } catch {
      // Estimate is advisory only; sending still validates server-side.
    }
  };

  if (!ready) {
    return (
      <AdminLayout title="Notifications" subtitle="Communication → Notifications">
        <LoadingState message="Loading notifications…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Notifications" subtitle="Announce to batches, faculty or individuals">
        <AdminPageHeader title="Notifications" description="Send in-app, push and SMS messages to students and staff." actionLabel="Send Notification" actionIcon={Plus} onAction={openComposer} />
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      {auditWarning ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] font-bold text-amber-800" role="alert">{auditWarning}</p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-silver-200 bg-white px-3.5 py-3" aria-label="Delivery filters">
        <label className="block text-[11px] font-bold text-navy-700">
          Channel
          <select value={fChannel} onChange={(e) => { setFChannel(e.target.value); void refreshHistory({ channel: e.target.value }); }} aria-label="Filter by channel" className="mt-1 block rounded-lg border border-silver-300 px-2 py-1.5 text-sm">
            <option value="">All</option>
            <option value="SMS">SMS</option>
            <option value="PUSH">Push</option>
            <option value="IN_APP">In-app</option>
          </select>
        </label>
        <label className="block text-[11px] font-bold text-navy-700">
          Status
          <select value={fStatus} onChange={(e) => { setFStatus(e.target.value); void refreshHistory({ status: e.target.value }); }} aria-label="Filter by status" className="mt-1 block rounded-lg border border-silver-300 px-2 py-1.5 text-sm">
            <option value="">All</option>
            <option value="SENT">Sent</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="DRAFT">Draft</option>
            <option value="FAILED">Failed</option>
            <option value="DELIVERED">Delivered</option>
          </select>
        </label>
        <label className="block text-[11px] font-bold text-navy-700">
          Priority
          <select value={fPriority} onChange={(e) => { setFPriority(e.target.value); void refreshHistory({ priority: e.target.value }); }} aria-label="Filter by priority" className="mt-1 block rounded-lg border border-silver-300 px-2 py-1.5 text-sm">
            <option value="">All</option>
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </label>
        <label className="block text-[11px] font-bold text-navy-700">
          Event
          <input value={fEvent} onChange={(e) => setFEvent(e.target.value)} onBlur={() => void refreshHistory()} placeholder="ADMIN_ANNOUNCEMENT" aria-label="Filter by event" className="mt-1 block w-44 rounded-lg border border-silver-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="flex items-center gap-1.5 text-[12px] font-bold text-navy-700">
          <input type="checkbox" checked={fFailedOnly} onChange={(e) => { setFFailedOnly(e.target.checked); void refreshHistory({ failedOnly: e.target.checked }); }} aria-label="Failed only" />
          Failed only
        </label>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No notifications yet" desc="Broadcast the first update to students or faculty." />
      ) : (
        <AdminTable<AdminNotification>
          columns={[
            { key: "t", header: "Title", render: (r) => <span><span className="block font-extrabold text-navy-700">{r.title}</span><span className="block max-w-md truncate text-[12px] text-muted">{r.message}</span><span className="block text-[11px] text-muted">{r.event ?? ""}{r.priority ? ` · ${r.priority}` : ""}{r.channels && r.channels.length > 0 ? ` · ${r.channels.join("+")}` : ""}</span></span> },
            { key: "a", header: "Audience", render: (r) => <span className="text-[13px] font-bold text-navy-700">{r.audience}</span> },
            { key: "r", header: "Recipients", render: (r) => <span className="text-[13px] font-bold text-navy-700">{r.recipientCount ?? "—"}</span> },
            { key: "sms", header: "SMS sent/failed", render: (r) => <span className="text-[12px] text-muted">{r.smsSent ?? 0}/{r.smsFailed ?? 0}</span> },
            { key: "push", header: "Push sent/failed", render: (r) => <span className="text-[12px] text-muted">{r.pushSent ?? 0}/{r.pushFailed ?? 0}</span> },
            { key: "inapp", header: "In-app", render: (r) => <span className="text-[12px] text-muted">{r.inAppCount ?? "—"}</span> },
            { key: "d", header: "Date", render: (r) => <span className="text-muted">{r.date}</span> },
            { key: "s", header: "Status", render: (r) => <AdminStatusBadge tone={statusToneFor(r.status)}>{r.status}</AdminStatusBadge> },
            { key: "v", header: "Detail", render: (r) => <a href={`/admin/notifications/${r.id}`} className="text-[12px] font-bold text-teal-700 underline">View</a> },
          ]}
          rows={rows}
        />
      )}
      <AdminModal open={modal} title="Create Notification" onClose={() => setModal(false)}>
        <div className="grid gap-3">
          <label className="block text-[12px] font-bold text-navy-700">
            Audience
            <select value={audience} onChange={(e) => { setAudience(e.target.value); void refreshEstimate(e.target.value); }} aria-label="Audience" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm">
              {audiences.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
          {estimate ? (
            <p className="rounded-xl bg-silver-100 px-3.5 py-2 text-[12px] font-bold text-navy-700" role="status">
              Estimated audience: {estimate.count} recipient{estimate.count === 1 ? "" : "s"}{channels.includes("SMS") ? ` (~${estimate.smsEligible} SMS)` : ""}
            </p>
          ) : null}
          <fieldset className="block text-[12px] font-bold text-navy-700">
            Channels{mandatoryLocked ? " (locked by mandatory policy)" : ""}
            <div className="mt-1.5 flex flex-wrap gap-3 rounded-xl border border-silver-300 px-3 py-2.5">
              {CHANNEL_OPTIONS.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={mandatoryLocked ? true : channels.includes(c)}
                    disabled={mandatoryLocked}
                    onChange={(e) => setChannels((p) => (e.target.checked ? [...p, c] : p.filter((x) => x !== c)))}
                  />
                  {c === "IN_APP" ? "In-app" : c === "PUSH" ? "Push" : "SMS"}
                </label>
              ))}
            </div>
            {mandatoryLocked ? (
              <p className="mt-1.5 text-[11px] font-bold text-navy-700">Emergency alerts always use SMS + Push + In-app. The server enforces this even if the request is modified.</p>
            ) : null}
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-bold text-navy-700">
              Priority
              <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm">
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="block text-[12px] font-bold text-navy-700">
              SMS template
              <select value={templateKey} onChange={(e) => { const v = e.target.value; setTemplateKey(v); if (v === "EMERGENCY_ALERT") setChannels(["SMS", "PUSH", "IN_APP"]); }} aria-label="SMS template" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm">
                {TEMPLATE_OPTIONS.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-[12px] font-bold text-navy-700">
            Title *
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mock on Sunday" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm" />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Message *
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="JEE Main Mock 14 starts 10 AM…" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm" />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Schedule (optional — leave empty for Send now)
            <input type="date" value={schedule} onChange={(e) => setSchedule(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm" />
          </label>
          {channels.includes("SMS") && (estimate?.smsEligible ?? 0) > 1 ? (
            <label className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[12px] font-bold text-amber-800">
              <input type="checkbox" checked={confirmMassSms} onChange={(e) => setConfirmMassSms(e.target.checked)} className="mt-0.5" />
              Confirm mass SMS to ~{estimate?.smsEligible} recipients. SMS charges and DLT rules apply.
            </label>
          ) : null}
          {formError ? (
            <p className="rounded-xl bg-crimson-50 px-3.5 py-2.5 text-[13px] font-bold text-crimson" role="alert">{formError}</p>
          ) : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => send(false)} disabled={busy}>
            Schedule
          </Button>
          <Button variant="primary" size="sm" onClick={() => send(true)} disabled={busy} aria-label="Send notification now">
            <Send className="h-4 w-4" /> {busy ? "Sending…" : "Send now"}
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}
