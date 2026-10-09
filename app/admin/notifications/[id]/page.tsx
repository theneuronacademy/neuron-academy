"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminStatusBadge, statusToneFor } from "@/components/admin/AdminStatusBadge";
import { AdminTable } from "@/components/admin/AdminTable";
import { LoadingState } from "@/components/admin/AdminStates";
import { isAdminAuthenticated } from "@/lib/adminAuth";

interface DetailItem {
  id: string;
  event: string;
  title: string;
  message: string;
  priority: string;
  audience: string;
  channels: string[];
  status: string;
  created: string;
  scheduled: string | null;
  sent: string | null;
}

interface DeliveryRow {
  id: string;
  channel: string;
  status: string;
  priority: string;
  provider: string;
  errorCode: string | null;
  errorMessage: string | null;
  retryable: boolean;
  attemptCount: number;
  recipientKey: string;
  user?: { id: string; name: string; email: string; role: string } | null;
  studentId?: string | null;
  facultyId?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  failedAt?: string | null;
  lastAttemptAt?: string | null;
  nextAttemptAt?: string | null;
}

interface Summary {
  sms: { total: number; sent: number; failed: number; skipped: number; retryable: number };
  push: { total: number; sent: number; failed: number; skipped: number };
  inApp: { total: number; delivered: number; failed: number };
}

export default function NotificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [item, setItem] = useState<DetailItem | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [failedOnly, setFailedOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Phase 18c-step5 (P0): delivery-audit availability from the server.
  const [auditWarning, setAuditWarning] = useState<string | null>(null);

  const load = async (over?: { channel?: string; status?: string; failedOnly?: boolean }) => {
    setError(null);
    try {
      const c = over?.channel ?? channel;
      const s = over?.status ?? status;
      const f = over?.failedOnly ?? failedOnly;
      const qs = new URLSearchParams({ limit: "50", offset: "0" });
      if (c) qs.set("channel", c);
      if (s) qs.set("status", s);
      if (f) qs.set("failedOnly", "1");
      const res = await fetch(`/api/notifications/${id}?${qs.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { item?: DetailItem; deliverySummary?: Summary; deliveries?: DeliveryRow[]; deliveryPagination?: { total: number }; deliveryAudit?: string; deliveryAuditReason?: string };
        error?: string;
      };
      if (!res.ok || !json?.success || !json?.data?.item) {
        setError(json?.error ?? "Could not load the notification.");
        return;
      }
      setItem(json.data.item);
      setSummary(json.data.deliverySummary ?? null);
      setRows((json.data.deliveries ?? []) as DeliveryRow[]);
      setTotal(json.data.deliveryPagination?.total ?? 0);
      if (json.data.deliveryAudit === "unavailable") {
        setAuditWarning(
          json.data.deliveryAuditReason === "migration-missing"
            ? "Delivery audit unavailable: the notification delivery migration is not applied. Summary counts are incomplete."
            : "Delivery audit unavailable: delivery queries failed. Summary counts are incomplete."
        );
      } else {
        setAuditWarning(null);
      }
    } catch {
      setError("Cannot reach the server.");
    }
  };

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    void load().then(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, id]);

  if (!ready) {
    return (
      <AdminLayout title="Notification detail" subtitle="Delivery audit">
        <LoadingState message="Loading delivery audit…" />
      </AdminLayout>
    );
  }
  if (error || !item) {
    return (
      <AdminLayout title="Notification detail" subtitle="Delivery audit">
        <p role="alert" className="rounded-xl bg-crimson-50 px-4 py-3 text-[13px] font-bold text-crimson">{error ?? "Not found."}</p>
      </AdminLayout>
    );
  }
  return (
    <AdminLayout title={item.title} subtitle={`Event ${item.event} · Priority ${item.priority}`}>
      <div className="grid gap-3">
        {auditWarning ? (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] font-bold text-amber-800" role="alert">{auditWarning}</p>
        ) : null}
        <section className="rounded-xl border border-silver-200 bg-white px-4 py-3" aria-label="Notification">
          <h2 className="text-[13px] font-extrabold text-navy-700">Notification</h2>
          <p className="mt-1 text-[13px] text-navy-700">{item.message}</p>
          <p className="mt-1 text-[12px] text-muted">
            Event {item.event} · Audience {String(item.audience)} · Channels {(item.channels ?? []).join("+") || "—"} · Status {item.status}
          </p>
          <p className="text-[12px] text-muted">
            Created {item.created} · Scheduled {item.scheduled ?? "—"} · Sent {item.sent ?? "—"}
          </p>
        </section>
        {summary ? (
          <section className="grid gap-2 rounded-xl border border-silver-200 bg-white px-4 py-3 md:grid-cols-3" aria-label="Delivery summary">
            <div>
              <h3 className="text-[12px] font-extrabold text-navy-700">SMS</h3>
              <p className="text-[12px] text-muted">Total {summary.sms.total} · Sent {summary.sms.sent} · Failed {summary.sms.failed} · Skipped {summary.sms.skipped} · Retryable {summary.sms.retryable}</p>
            </div>
            <div>
              <h3 className="text-[12px] font-extrabold text-navy-700">Push</h3>
              <p className="text-[12px] text-muted">Total {summary.push.total} · Sent {summary.push.sent} · Failed {summary.push.failed} · Skipped {summary.push.skipped}</p>
            </div>
            <div>
              <h3 className="text-[12px] font-extrabold text-navy-700">In-app</h3>
              <p className="text-[12px] text-muted">Total {summary.inApp.total} · Delivered {summary.inApp.delivered} · Failed {summary.inApp.failed}</p>
            </div>
          </section>
        ) : null}
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-silver-200 bg-white px-3.5 py-3" aria-label="Delivery filters">
          <label className="block text-[11px] font-bold text-navy-700">
            Channel
            <select value={channel} onChange={(e) => { setChannel(e.target.value); void load({ channel: e.target.value }); }} aria-label="Filter by channel" className="mt-1 block rounded-lg border border-silver-300 px-2 py-1.5 text-sm">
              <option value="">All</option>
              <option value="SMS">SMS</option>
              <option value="PUSH">Push</option>
              <option value="IN_APP">In-app</option>
            </select>
          </label>
          <label className="block text-[11px] font-bold text-navy-700">
            Status
            <select value={status} onChange={(e) => { setStatus(e.target.value); void load({ status: e.target.value }); }} aria-label="Filter by status" className="mt-1 block rounded-lg border border-silver-300 px-2 py-1.5 text-sm">
              <option value="">All</option>
              <option value="SENT">Sent</option>
              <option value="DELIVERED">Delivered</option>
              <option value="FAILED">Failed</option>
              <option value="SKIPPED">Skipped</option>
              <option value="CREATED">Created</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-navy-700">
            <input type="checkbox" checked={failedOnly} onChange={(e) => { setFailedOnly(e.target.checked); void load({ failedOnly: e.target.checked }); }} aria-label="Failed only" />
            Failed only
          </label>
          <span className="text-[12px] text-muted" role="status">{total} delivery row{total === 1 ? "" : "s"} (paginated, max 50)</span>
        </div>
        <AdminTable<DeliveryRow>
          columns={[
            { key: "rk", header: "Recipient", render: (r) => <span className="text-[12px] font-bold text-navy-700">{r.user?.name ?? r.recipientKey}</span> },
            { key: "c", header: "Channel", render: (r) => <span className="text-[12px]">{r.channel}</span> },
            { key: "s", header: "Status", render: (r) => <AdminStatusBadge tone={statusToneFor(r.status)}>{r.status}</AdminStatusBadge> },
            { key: "a", header: "Attempts", render: (r) => <span className="text-[12px]">{r.attemptCount}{r.retryable ? " · retryable" : ""}</span> },
            { key: "e", header: "Error", render: (r) => <span className="text-[12px] text-muted">{r.errorCode ?? "—"}</span> },
          ]}
          rows={rows}
        />
      </div>
    </AdminLayout>
  );
}
