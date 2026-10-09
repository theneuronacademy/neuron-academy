"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Pencil, XCircle, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminToolbar, SearchBar, FilterBar } from "@/components/admin/SearchBar";
import { EmptyState } from "@/components/admin/AdminStates";
import { Button } from "@/components/ui/primitives";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { cn } from "@/lib/utils";

interface BiometricDeviceRow {
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
}

function getStatusText(isActive: boolean, lastSeenAt: string | null) {
  if (!lastSeenAt) return "NEVER CONNECTED";
  const diffMinutes = (new Date().getTime() - new Date(lastSeenAt).getTime()) / (1000 * 60);
  if (diffMinutes > 1440) return "STALE";
  if (diffMinutes > 60) return "RECENTLY SEEN";
  return "ACTIVE";
}

function getStatusTone(status: string) {
  return status === "ACTIVE" ? "green" : status === "RECENTLY_SEEN" ? "blue" : status === "STALE" ? "warning" : "gray";
}

export default function BiometricDevicesPage() {
  const router = useRouter();
  const ready = useAdminGuard();
  const [rows, setRows] = useState<BiometricDeviceRow[]>([]);
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/biometric/devices", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true && Array.isArray(json.data?.devices)) {
        setRows(json.data.devices as BiometricDeviceRow[]);
      }
    } catch {
      setErr("Cannot load biometric devices.");
    }
  }

  useEffect(() => {
    if (!ready) return;
    (async () => {
      await load();
    })();
  }, [router, ready]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (typeF === "all" || r.deviceType === typeF) &&
          (!search.trim() || `${r.name} ${r.serialNumber} ${r.ipAddress || ""} ${r.lastSeenAt || ""}`.toLowerCase().includes(search.toLowerCase()))
      ),
    [rows, search, typeF]
  );

  function openAdd() {
    setErr(null);
  }

  function openEdit(r: BiometricDeviceRow) {
    setErr(null);
    setEdit(r);
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEdit(null);
    setErr(null);
  }

  const [edit, setEdit] = useState<BiometricDeviceRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  async function saveEdit() {
    if (!edit) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/biometric/devices/${edit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: edit.name,
          serialNumber: edit.serialNumber,
          deviceType: edit.deviceType,
          ipAddress: edit.ipAddress || undefined,
          port: edit.port ?? undefined,
          protocol: edit.protocol,
          location: edit.location || undefined,
          isActive: edit.isActive,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Update failed.");
        return;
      }
      setSaved(`Updated ${edit.name}.`);
      setEditOpen(false);
      await load();
      setBusy(false);
    } catch {
      setErr("Cannot reach the server.");
      setBusy(false);
    }
  }

  async function deleteDevice(id: string) {
    if (!confirm("Are you sure you want to deactivate this biometric device?")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/biometric/devices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Failed to deactivate device (device API route pending Phase 12 scope).");
        return;
      }
      setSaved("Device deactivated.");
      await load();
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500";

  return (
    <AdminLayout title="Biometric Devices" subtitle="X2000 Device Management">
      <AdminPageHeader title="Biometric Device Management" description="X2000 ADMS device registration and status." actionLabel="" actionIcon={Eye} onAction={() => undefined} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: "TOTAL DEVICES", v: rows.length },
          { l: "ACTIVE", v: rows.filter((r) => r.isActive).length },
          { l: "INACTIVE", v: rows.filter((r) => !r.isActive).length },
        ].map((s) => (
          <div key={s.l} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
            <p className="text-[11px] font-bold tracking-widest text-muted">{s.l}</p>
            <p className="mt-1 text-3xl font-extrabold text-navy-700">{s.v}</p>
          </div>
        ))}
      </div>

      {saved ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-500">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}

      <ErrToast error={err} />

      <div className="mt-3">
        <AdminToolbar>
          <SearchBar value={search} onChange={setSearch} placeholder="Search name, serial number, IP…" />
          <FilterBar value={typeF} onChange={setTypeF} ariaLabel="Filter by device type" options={[{ value: "all", label: "All types" }, { value: "X2000", label: "X2000" }]} />
          <Button
            onClick={openAdd}
            className="rounded-xl bg-navy-700 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-navy-800"
          >
            + Add Device
          </Button>
        </AdminToolbar>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No devices found" desc="Register X2000 devices to begin biometric attendance tracking." />
      ) : (
        <table className="w-full rounded-card border border-silver-200 bg-white shadow-card">
          <thead>
            <tr className="text-xs text-silver-500">
              <th className="p-4">Name</th>
              <th className="p-4">Serial Number</th>
              <th className="p-4">Device Type</th>
              <th className="p-4">Protocol</th>
              <th className="p-4">IP Address</th>
              <th className="p-4">Port</th>
              <th className="p-4">Status</th>
              <th className="p-4">Last Seen</th>
              <th className="p-4">Total Events</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b transition-colors hover:bg-silver-50">
                <td className="p-4 font-medium text-navy-700">{r.name}</td>
                <td className="p-4">{r.serialNumber}</td>
                <td className="p-4">{r.deviceType}</td>
                <td className="p-4">{r.protocol}</td>
                <td className="p-4">{r.ipAddress || "—"}</td>
                <td className="p-4">{r.port || "—"}</td>
                <td className="p-4">
                  <span className={cn("px-2 py-1 rounded text-[10px] font-bold", getStatusTone(getStatusText(r.isActive, r.lastSeenAt)))}>
                    {getStatusText(r.isActive, r.lastSeenAt)}
                  </span>
                </td>
                <td className="p-4">{r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleString() : "—"}</td>
                <td className="p-4">{r.totalEvents}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => router.push(`/admin/biometric/devices/${r.id}`)}
                    className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500 text-[10px]"
                    title="View device"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => openEdit(r)}
                    className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500 text-[10px]"
                    title="Edit device"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => deleteDevice(r.id)}
                    className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-crimson-500 text-[10px]"
                    title="Deactivate device"
                  >
                    <XCircle className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

<AdminModal open={editOpen} title={edit ? `Edit Device — ${edit.name}` : "Add Device"} onClose={() => closeEdit()} wide>
          {edit ? (
            <div className="p-4 space-y-3">
              <form
                onSubmit={async (e: React.FormEvent) => {
                  e.preventDefault();
                  setErr(null);
                  try {
                    const res = await fetch(`/api/biometric/devices/${edit.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: edit.name,
                        serialNumber: edit.serialNumber,
                        deviceType: edit.deviceType,
                        ipAddress: edit.ipAddress || undefined,
                        port: edit.port ?? undefined,
                        protocol: edit.protocol,
                        location: edit.location || undefined,
                        isActive: edit.isActive,
                      }),
                    });
                    const json = await res.json().catch(() => null);
                    if (!res.ok || json?.success !== true) {
                      setErr(json?.error ?? "Update failed.");
                      return;
                    }
                    setSaved(`Updated ${edit.name}.`);
                    setEditOpen(false);
                    await load();
                  } catch {
                    setErr("Cannot reach the server.");
                  }
                }}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-navy-700">Name</label>
                    <input value={edit.name} onChange={(e) => setEdit((s) => (s ? { ...s, name: e.target.value } : s))} className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-navy-700">Serial Number</label>
                    <input value={edit.serialNumber} onChange={(e) => setEdit((s) => (s ? { ...s, serialNumber: e.target.value } : s))} className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-navy-700">Device Type</label>
                    <input value={edit.deviceType} onChange={(e) => setEdit((s) => (s ? { ...s, deviceType: e.target.value } : s))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-navy-700">Protocol</label>
                    <input value={edit.protocol} onChange={(e) => setEdit((s) => (s ? { ...s, protocol: e.target.value } : s))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-navy-700">IP Address</label>
                    <input value={edit.ipAddress || ""} onChange={(e) => setEdit((s) => (s ? { ...s, ipAddress: e.target.value } : s))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-navy-700">Port</label>
                    <input value={edit.port ?? ""} onChange={(e) => setEdit((s) => (s ? { ...s, port: Number(e.target.value) || null } : s))} className={inputCls} type="number" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-navy-700">Location</label>
                    <input value={edit.location || ""} onChange={(e) => setEdit((s) => (s ? { ...s, location: e.target.value } : s))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-navy-700">Active</label>
                    <select
                      value={edit.isActive ? "true" : "false"}
                      onChange={(e) => setEdit((s) => (s ? { ...s, isActive: e.target.value === "true" } : s))}
                      className={inputCls}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => closeEdit()} className="rounded-xl border border-silver-300 px-4 py-2.5 text-[13px] font-bold text-navy-700 hover:bg-silver-100">Cancel</button>
                  <button type="submit" className="rounded-xl bg-navy-700 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-navy-800">
                    Update
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </AdminModal>
      </AdminLayout>
  );
}

function ErrToast({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <p className="mt-3 rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson-600">
      {error}
    </p>
  );
}