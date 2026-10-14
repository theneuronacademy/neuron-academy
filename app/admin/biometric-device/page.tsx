"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface BiometricDeviceDetail {
  id: string;
  name: string;
  serialNumber: string;
  deviceType: string;
  protocol: string;
  ipAddress: string | null;
  port: number | null;
  location: string | null;
  isActive: boolean;
  lastSeenAt: string | null;
  lastHeartbeatAt: string | null;
  lastError: string | null;
  totalEvents: number;
  failedEvents: number;
  createdAt: string;
  updatedAt: string;
}

interface DeviceEventRow {
  id: string;
  biometricUserId: string;
  eventTimestamp: string;
  eventType: string;
  processed: boolean | null;
  attendanceId: string | null;
  receivedAt: string;
}

interface MappingRow {
  id: string;
  biometricUserId: string;
  userType: "STUDENT" | "FACULTY";
  userId: string;
  isActive: boolean;
  label: string | null;
}

function healthStatus(lastSeenAt: string | null) {
  if (!lastSeenAt) return "NEVER CONNECTED";
  const diffHours = (new Date().getTime() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60);
  if (diffHours > 24) return "STALE";
  if (diffHours > 1) return "RECENTLY SEEN";
  return "ACTIVE";
}

function getTone(status: string) {
  return status === "ACTIVE" ? "green" : status === "RECENTLY_SEEN" ? "blue" : status === "STALE" ? "warning" : "gray";
}

export default function BiometricDeviceDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<BiometricDeviceDetail | null>(null);
  const [events, setEvents] = useState<DeviceEventRow[]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [form, setForm] = useState({ biometricUserId: "", userType: "STUDENT", userKey: "" });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadDevice = async (id: string) => {
    try {
      const res = await fetch(`/api/biometric/devices/${id}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true && json?.data?.device) {
        setDevice(json.data.device as BiometricDeviceDetail);
      } else {
        setErr(json?.error ?? "Device not found.");
      }
    } catch {
      setErr("Cannot load device details.");
    }
  };

  const loadEvents = async (id: string) => {
    try {
      const res = await fetch(`/api/biometric/${id}/events`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true && Array.isArray(json?.data?.events)) {
        setEvents(json.data.events as DeviceEventRow[]);
      }
    } catch {
      setErr("Cannot load device events.");
    }
  };

  const loadMappings = async (id: string) => {
    try {
      const res = await fetch(`/api/biometric/devices/${id}/mappings`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true && Array.isArray(json?.data?.mappings)) {
        setMappings(json.data.mappings as MappingRow[]);
      }
    } catch {
      /* mappings list is auxiliary; device view must still render */
    }
  };

  useEffect(() => {
    let live = true;
    (async () => {
      const sp = await searchParams;
      if (!live) return;
      if (!sp.id) {
        setErr("No device selected. Open a device from Biometric Devices.");
        setReady(true);
        return;
      }
      await loadDevice(sp.id);
      await loadEvents(sp.id);
      await loadMappings(sp.id);
      if (live) setReady(true);
    })();
    return () => {
      live = false;
    };
  }, [searchParams]);

  const createMapping = async () => {
    if (!device) return;
    if (!form.biometricUserId.trim() || !form.userKey.trim()) {
      setErr("Enter both the biometric User ID and the Student/Faculty ID or email.");
      return;
    }
    setBusy(true);
    setErr(null);
    setSaved(null);
    try {
      const res = await fetch(`/api/biometric/devices/${device.id}/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          biometricUserId: form.biometricUserId.trim(),
          userType: form.userType,
          userKey: form.userKey.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Mapping failed.");
        return;
      }
      setSaved(`Mapped ${form.biometricUserId.trim()} → ${json?.data?.label ?? form.userKey.trim()}.`);
      setForm({ biometricUserId: "", userType: "STUDENT", userKey: "" });
      await loadMappings(device.id);
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const toggleMapping = async (m: MappingRow) => {
    if (!device) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/biometric/devices/${device.id}/mappings/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !m.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Mapping update failed.");
        return;
      }
      setSaved(m.isActive ? "Mapping disabled." : "Mapping enabled.");
      await loadMappings(device.id);
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const deleteMapping = async (m: MappingRow) => {
    if (!device) return;
    if (!confirm(`Remove mapping ${m.biometricUserId} → ${m.label ?? m.userId}?`)) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/biometric/devices/${device.id}/mappings/${m.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Mapping delete failed.");
        return;
      }
      setSaved("Mapping removed.");
      await loadMappings(device.id);
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const rotateSecret = async () => {
    if (!device) return;
    if (!confirm("Rotate the bridge secret? The current secret stops working immediately.")) return;
    setBusy(true);
    setErr(null);
    setSaved(null);
    try {
      const res = await fetch(`/api/biometric/devices/${device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotateSecret: true }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Secret rotation failed.");
        return;
      }
      const secret = json?.data?.provisionedSecret as string | undefined;
      setSaved(secret ? `New bridge secret (copy NOW — never shown again): ${secret}` : "Secret rotated.");
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  };

  if (!ready || !device) {
    return (
      <AdminLayout title="Biometric Device" subtitle="Device details">
        <Eye className="h-6 w-6" /> <span className="ml-2">Loading device details…</span>
        {err ? (
          <p className="mt-3 rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson-600" role="alert">
            {err}
          </p>
        ) : null}
        <div className="mt-3">
          <Button onClick={() => router.push("/admin/biometric-devices")} className="rounded-xl border border-silver-300 px-4 py-2.5 text-[13px] font-bold text-navy-700">
            Back to Devices
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const inputCls = "mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500";

  return (
    <AdminLayout title="Biometric Device" subtitle={`Device: ${device.name}`}>
      <AdminPageHeader
        title="Device Details"
        description={`X2000 ADMS Device • ${device.serialNumber}`}
        actionLabel="Back"
        actionIcon={Eye}
        onAction={() => router.push("/admin/biometric-devices")}
      />

      {err ? (
        <p className="rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson-600" role="alert">
          {err}
        </p>
      ) : null}
      {saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-600 break-all">
          {saved}
        </p>
      ) : null}

      <div className="grid gap-6">
        {/* Device Health Summary */}
        <div className="rounded-card border border-silver-200 bg-white p-6 shadow-card">
          <h3 className="text-[15px] font-extrabold text-navy-700 mb-4">DEVICE HEALTH</h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-[11px] font-bold tracking-widest text-muted">Active</p>
              <AdminStatusBadge tone={device?.isActive ? "green" : "gray"}>
                {device?.isActive ? "Active" : "Inactive"}
              </AdminStatusBadge>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-muted">Status</p>
              <span className={cn("px-2 py-1 rounded text-[10px] font-bold", getTone(healthStatus(device?.lastSeenAt)))}>
                {healthStatus(device?.lastSeenAt)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-bold tracking-widest text-muted">Total Events</p>
              <p className="text-2xl font-extrabold text-navy-700">{device?.totalEvents}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-muted">Failed Events</p>
              <p className="text-2xl font-extrabold text-crimson-500">{device?.failedEvents}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-muted">Last Seen</p>
              <p className="text-lg text-silver-300">
                {device?.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "Never"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-muted">Last Heartbeat</p>
              <p className="text-lg text-silver-300">
                {device?.lastHeartbeatAt ? new Date(device.lastHeartbeatAt).toLocaleString() : "Never"}
              </p>
            </div>
          </div>

          {device?.lastError ? (
            <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[12px] font-bold text-amber-800" role="note">
              Last error: {device.lastError}
            </p>
          ) : null}

          <div className="mt-3">
            <Button onClick={rotateSecret} disabled={busy} className="rounded-xl border border-navy-700 px-4 py-2.5 text-[13px] font-bold text-navy-700 hover:bg-navy-800 hover:text-white disabled:opacity-50">
              Rotate Bridge Secret
            </Button>
          </div>
        </div>

        {/* Device Configuration */}
        <div className="rounded-card border border-silver-200 bg-white p-6 shadow-card">
          <h3 className="text-[15px] font-extrabold text-navy-700 mb-4">DEVICE CONFIG</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-bold tracking-widest text-muted">Serial Number</p>
              <p className="text-lg font-medium text-navy-700">{device?.serialNumber}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-muted">Device Type</p>
              <p className="text-lg font-medium text-navy-700">{device?.deviceType}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-muted">Protocol</p>
              <p className="text-lg font-medium text-navy-700">{device?.protocol}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-muted">IP Address</p>
              <p className="text-lg font-medium text-navy-700">{device?.ipAddress || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-muted">Port</p>
              <p className="text-lg font-medium text-navy-700">{device?.port || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-muted">Location</p>
              <p className="text-lg font-medium text-navy-700">{device?.location || "—"}</p>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-muted">
            Push target for the K90: the VPS bridge on port 8787 (see deployment notes in the biometric status file).
            When IP allowlist is set, only that source IP is accepted.
          </p>
        </div>

        {/* Recent Events */}
        <div className="rounded-card border border-silver-200 bg-white p-6 shadow-card">
          <h3 className="text-[15px] font-extrabold text-navy-700 mb-4">RECENT EVENTS</h3>
          {events.length === 0 ? (
            <p className="text-sm text-silver-500">No events recorded for this device.</p>
          ) : (
            <table className="w-full rounded-card border border-silver-200 bg-white shadow-card">
              <thead>
                <tr className="text-xs text-silver-500">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Biometric User ID</th>
                  <th className="p-4">Event Type</th>
                  <th className="p-4">Processed</th>
                  <th className="p-4">Attendance</th>
                  <th className="p-4">Received</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b hover:bg-silver-50">
                    <td className="p-4">{new Date(e.eventTimestamp).toLocaleString()}</td>
                    <td className="p-4 font-medium text-navy-700">{e.biometricUserId}</td>
                    <td className="p-4">{e.eventType}</td>
                    <td className="p-4">
                      {e.processed === true ? (
                        <span className="px-2 py-1 rounded text-[10px] text-teal-600">Yes</span>
                      ) : e.processed === false ? (
                        <span className="px-2 py-1 rounded text-[10px] text-crimson-500">No</span>
                      ) : (
                        <span className="px-2 py-1 rounded text-[10px] text-silver-500">Pending</span>
                      )}
                    </td>
                    <td className="p-4">
                      {e.attendanceId ? (
                        <span className="text-navy-700 text-[10px]">{e.attendanceId.substring(0, 8)}…</span>
                      ) : (
                        <span className="text-[10px] text-silver-500">—</span>
                      )}
                    </td>
                    <td className="p-4">{new Date(e.receivedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Biometric User Mapping */}
        <div className="rounded-card border border-silver-200 bg-white p-6 shadow-card">
          <h3 className="text-[15px] font-extrabold text-navy-700 mb-4">
            BIOMETRIC USER MAPPING
          </h3>

          <p className="text-[11px] text-silver-500 mb-4">
            Bind a device enrollment ID (the PIN the K90 sends) to a Student or Faculty record.
            Student punches create attendance; faculty presence is audit-logged only.
          </p>

          {mappings.length > 0 ? (
            <table className="mb-4 w-full rounded-card border border-silver-200 bg-white">
              <thead>
                <tr className="text-xs text-silver-500">
                  <th className="p-3 text-left">Device ID</th>
                  <th className="p-3 text-left">Mapped To</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id} className="border-b hover:bg-silver-50">
                    <td className="p-3 font-medium text-navy-700">{m.biometricUserId}</td>
                    <td className="p-3 text-[12px]">{m.label ?? `${m.userType} ${m.userId.substring(0, 8)}…`}</td>
                    <td className="p-3">
                      <span className={cn("px-2 py-1 rounded text-[10px] font-bold", m.isActive ? "text-teal-600" : "text-silver-500")}>
                        {m.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button onClick={() => toggleMapping(m)} disabled={busy} className="mr-2 rounded-lg border border-silver-300 px-2.5 py-1.5 text-[11px] font-bold text-navy-700 hover:border-teal-500 disabled:opacity-50">
                        {m.isActive ? "Disable" : "Enable"}
                      </button>
                      <button onClick={() => deleteMapping(m)} disabled={busy} className="rounded-lg border border-silver-300 px-2.5 py-1.5 text-[11px] font-bold text-crimson-600 hover:border-crimson-500 disabled:opacity-50">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mb-4 text-[12px] text-silver-500">No mappings yet — unmapped punches are preserved as unprocessed audit events.</p>
          )}

          <div className="grid gap-3 rounded-xl bg-silver-50 p-4 sm:grid-cols-3">
            <label className="block text-[11px] font-bold text-navy-700">
              Biometric User ID (device PIN)
              <input
                value={form.biometricUserId}
                onChange={(e) => setForm((f) => ({ ...f, biometricUserId: e.target.value }))}
                placeholder="e.g. 1042"
                className={inputCls}
              />
            </label>
            <label className="block text-[11px] font-bold text-navy-700">
              Record Type
              <select
                value={form.userType}
                onChange={(e) => setForm((f) => ({ ...f, userType: e.target.value }))}
                className={inputCls}
              >
                <option value="STUDENT">Student</option>
                <option value="FACULTY">Faculty</option>
              </select>
            </label>
            <label className="block text-[11px] font-bold text-navy-700">
              Student/Faculty ID or Email
              <input
                value={form.userKey}
                onChange={(e) => setForm((f) => ({ ...f, userKey: e.target.value }))}
                placeholder="e.g. NA-2026-001"
                className={inputCls}
              />
            </label>
          </div>
          <Button
            onClick={createMapping}
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-navy-700 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-50">
            {busy ? "Saving…" : "Map User"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
