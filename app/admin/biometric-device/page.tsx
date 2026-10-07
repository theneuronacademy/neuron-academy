"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, XCircle, } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
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

function healthStatus(lastSeenAt: string | null, totalEvents: number) {
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
  params,
}: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<BiometricDeviceDetail | null>(null);
  const [events, setEvents] = useState<DeviceEventRow[]>([]);
  const [openMapping, setOpenMapping] = useState(false);
  const [mapping, setMapping] = useState<{ biometricUserId: string; userType: "student" | "faculty"; studentId: string; facultyId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const loadDevice = async (id: string) => {
    try {
      const res = await fetch(`/api/biometric/devices/${id}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true && json?.data?.device) {
        setDevice(json.data.device as BiometricDeviceDetail);
      }
    } catch {
      setErr("Cannot load device details.");
    }
    setReady(true);
  };

  const loadEvents = async (id: string) => {
    try {
      const res = await fetch(`/api/biometric/${id}/events`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true && Array.isArray(json?.events)) {
        setEvents(json.events as DeviceEventRow[]);
      }
    } catch {
      setErr("Cannot load device events.");
    }
  };

  useEffect(() => {
    let live = true;
    (async () => {
      const p = await params;
      if (!live) return;
      setDeviceId(p.id);
      await loadDevice(p.id);
      await loadEvents(p.id);
      if (live) setReady(true);
    })();
    return () => {
      live = false;
    };
  }, [params]);

  const openMappingForm = (biometricUserId: string) => {
    setMapping({
      biometricUserId,
      userType: "student",
      studentId: "",
      facultyId: "",
    });
    setOpenMapping(true);
  };

  const closeMappingForm = () => {
    setOpenMapping(false);
    setMapping(null);
    setErr(null);
  };

  const saveMapping = async () => {
    if (!mapping || !device) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/biometric/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          biometricUserId: mapping.biometricUserId,
          userType: mapping.userType,
          userId: mapping.userType === "student" ? mapping.studentId || "" : mapping.facultyId || "",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Mapping failed.");
        return;
      }
      setSaved(`Mapped ${mapping.biometricUserId} to ${mapping.userType}.`);
      setOpenMapping(false);
      await loadEvents(device.id);
      setBusy(false);
    } catch {
      setErr("Cannot reach the server.");
      setBusy(false);
    }
  };

  if (!ready || !device) {
    return (
      <AdminLayout title="Biometric Device" subtitle="Device details">
        <Eye className="h-6 w-6" /> <span className="ml-2">Loading device details…</span>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Biometric Device" subtitle={`Device: ${device.name}`}>
      <AdminPageHeader
        title="Device Details"
        description={`X2000 ADMS Device • ${device.serialNumber}`}
        actionLabel="Back"
        actionIcon={Eye}
        onAction={() => router.push("/admin/biometric-devices")}
      />

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
              <span className={cn("px-2 py-1 rounded text-[10px] font-bold", getTone(healthStatus(device?.lastSeenAt, device?.totalEvents)))}>
                {healthStatus(device?.lastSeenAt, device?.totalEvents)}
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
              <p className="text-[11px] font-bold tracking-widest text-muted">Created</p>
              <p className="text-lg text-silver-300">{new Date(device.createdAt).toLocaleDateString()}</p>
            </div>
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
                    <td className="p-4">{e.eventTimestamp}</td>
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
                        <a href="#" onClick={() => console.log("Attendance:", e.attendanceId)} className="underline text-navy-700 text-[10px]">
                          {e.attendanceId.substring(0, 8)}…
                        </a>
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
            Map a biometric User ID to a Student or Faculty member. Attendance will
            be created when the device event is processed with a recognized user.
          </p>

{mapping ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[11px] font-bold text-navy-700">
                    Biometric User ID
                    <span className="text-[10px] text-silver-500">{mapping.biometricUserId}</span>
                  </label>
                  <p className="mt-1 text-[10px] text-silver-500">
                    {mapping.userType === "student" ? "→ Student" : "→ Faculty"}
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-navy-700">
                    Target ID
                    <span className="text-[10px] text-silver-500">
                      {mapping.userType === "student" ? mapping.studentId || "—" : mapping.facultyId || "—"}
                    </span>
                  </label>
                </div>
              </div>
              <Button
                onClick={() => closeMappingForm()}
                className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-[13px] font-bold text-navy-700 hover:bg-silver-100">
                Cancel
              </Button>
              <Button
                onClick={() => saveMapping()}
                disabled={busy}
                className="w-full rounded-xl bg-navy-700 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-navy-800">
                {busy ? (
                  <span>
                    <span className="h-4 w-4 animate-spin" />
                    Saving…
                  </span>
                ) : "Map User"}
              </Button>
            </>
          ) : (
            <div>
              <p className="text-[11px] text-silver-500 mb-3">
                Enter a biometric User ID to map it to a Student or Faculty member.
              </p>
              <Button
                onClick={() => openMappingForm("")}
                className="w-full rounded-xl border border-navy-700 px-4 py-2.5 text-[13px] font-bold text-navy-700 hover:bg-navy-800">
                Map Biometric User
              </Button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}