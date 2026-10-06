"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Pencil, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminStatusBadge, statusToneFor } from "@/components/admin/AdminStatusBadge";
import { AdminModal, AdminDrawer } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { SearchBar, FilterBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone: string;
  studentType: "REGULAR" | "SCHOLARSHIP";
  status: "active" | "inactive";
  batch: string;
  batchId: string | null;
  course: string;
  joiningDate: string;
  city?: string | null;
  school?: string | null;
  className?: string | null;
  lastLoginAt?: string | null;
}

interface Batch { id: string; name: string }

function TypeBadge({ t }: { t: string }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-widest", t === "SCHOLARSHIP" ? "bg-amber-100 text-amber-800" : "bg-teal-50 text-teal-700")}>
      {t === "SCHOLARSHIP" ? "SCHOLARSHIP" : "REGULAR"}
    </span>
  );
}

/** Phase 14 — DB-backed student console: type, status, batch, contact editing. */
export default function StudentsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [edit, setEdit] = useState<Row | null>(null);
  const [view, setView] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Edit form state
  const [fType, setFType] = useState("REGULAR");
  const [fStatus, setFStatus] = useState("active");
  const [fBatch, setFBatch] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fCity, setFCity] = useState("");
  const [fSchool, setFSchool] = useState("");
  const [fClass, setFClass] = useState("");
  const [confirmType, setConfirmType] = useState(false);

  async function load() {
    try {
      const [sRes, bRes] = await Promise.all([
        fetch("/api/students", { cache: "no-store" }),
        fetch("/api/batches", { cache: "no-store" }),
      ]);
      const sJson = await sRes.json().catch(() => null);
      const bJson = await bRes.json().catch(() => null);
      if (sRes.ok && sJson?.success === true && Array.isArray(sJson.data?.items)) setRows(sJson.data.items as Row[]);
      if (bRes.ok && bJson?.success === true && Array.isArray(bJson.data?.items)) {
        setBatches(bJson.data.items.map((b: { id: string; name: string }) => ({ id: String(b.id), name: String(b.name) })));
      }
    } catch {
      /* empty states */
    }
  }

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      await load();
      setReady(true);
    })();
  }, [router]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (typeF === "all" || r.studentType === typeF) &&
          (statusF === "all" || r.status === statusF) &&
          (!search.trim() || `${r.name} ${r.studentId} ${r.email} ${r.phone}`.toLowerCase().includes(search.toLowerCase()))
      ),
    [rows, search, typeF, statusF]
  );

  const counts = useMemo(
    () => ({
      total: rows.length,
      regular: rows.filter((r) => r.studentType === "REGULAR").length,
      scholarship: rows.filter((r) => r.studentType === "SCHOLARSHIP").length,
      active: rows.filter((r) => r.status === "active").length,
    }),
    [rows]
  );

  function openEdit(r: Row) {
    setEdit(r);
    setFType(r.studentType);
    setFStatus(r.status);
    setFBatch(r.batchId ?? "");
    setFPhone(r.phone);
    setFEmail(r.email);
    setFCity(r.city ?? "");
    setFSchool(r.school ?? "");
    setFClass(r.className ?? "");
    setConfirmType(false);
    setErr(null);
  }

  async function saveEdit() {
    if (!edit) return;
    const typeChanged = fType !== edit.studentType;
    if (typeChanged && !confirmType) {
      setConfirmType(true);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/students/${edit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentType: fType,
          status: fStatus === "active" ? "ACTIVE" : "INACTIVE",
          batchId: fBatch || null,
          phone: fPhone.trim(),
          email: fEmail.trim(),
          city: fCity.trim() || null,
          school: fSchool.trim() || null,
          className: fClass.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Update failed.");
        return;
      }
      setEdit(null);
      setSaved(`Updated ${edit.name} — permissions apply immediately.`);
      window.setTimeout(() => setSaved(null), 3000);
      await load();
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <AdminLayout title="Students" subtitle="People → Students">
        <LoadingState message="Loading students…" />
      </AdminLayout>
    );
  }

  const inputCls = "mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500";

  return (
    <AdminLayout title="Students" subtitle={`${filtered.length} of ${rows.length} learners`}>
      <AdminPageHeader title="Student Management" description="Types, enrollment, batches and contact details." actionLabel="" actionIcon={Eye} onAction={() => undefined} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: "TOTAL STUDENTS", v: counts.total },
          { l: "REGULAR", v: counts.regular },
          { l: "SCHOLARSHIP", v: counts.scholarship },
          { l: "ACTIVE", v: counts.active },
        ].map((s) => (
          <div key={s.l} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
            <p className="text-[11px] font-bold tracking-widest text-muted">{s.l}</p>
            <p className="mt-1 text-3xl font-extrabold text-navy-700">{s.v}</p>
          </div>
        ))}
      </div>
      {saved ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      <div className="mt-3">
        <AdminToolbar>
          <SearchBar value={search} onChange={setSearch} placeholder="Search name, ID, email, phone…" />
          <FilterBar value={typeF} onChange={setTypeF} ariaLabel="Filter by type" options={[{ value: "all", label: "All types" }, { value: "REGULAR", label: "Regular" }, { value: "SCHOLARSHIP", label: "Scholarship" }]} />
          <FilterBar value={statusF} onChange={setStatusF} ariaLabel="Filter by status" options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
        </AdminToolbar>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No students found" desc="Students appear here after registration — no demo records are created." />
      ) : (
        <AdminTable<Row>
          columns={[
            {
              key: "s",
              header: "Student",
              render: (r) => (
                <div>
                  <p className="font-extrabold text-navy-700">{r.name}</p>
                  <p className="text-[12px] text-muted">{r.studentId} • {r.batch}</p>
                </div>
              ),
            },
            { key: "t", header: "Type", render: (r) => <TypeBadge t={r.studentType} /> },
            { key: "c", header: "Contact", render: (r) => <span className="text-[13px] text-muted">{r.phone}<br />{r.email}</span> },
            { key: "st", header: "Status", render: (r) => <AdminStatusBadge tone={statusToneFor(r.status)}>{r.status === "active" ? "Active" : "Inactive"}</AdminStatusBadge> },
            {
              key: "x",
              header: "Actions",
              className: "text-right",
              render: (r) => (
                <div className="flex justify-end gap-1.5">
                  <button onClick={() => setView(r)} aria-label={`View ${r.name}`} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button onClick={() => openEdit(r)} aria-label={`Edit ${r.name}`} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              ),
            },
          ]}
          rows={filtered}
        />
      )}

      <AdminDrawer open={view !== null} title={view ? view.name : "Student"} onClose={() => setView(null)}>
        {view ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-navy-800 p-4 text-white">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold tracking-widest text-teal-200">{view.studentId}</p>
                <TypeBadge t={view.studentType} />
              </div>
              <p className="mt-1 text-lg font-extrabold">{view.name}</p>
              <p className="text-[13px] text-silver-200">{view.course} • {view.batch}</p>
              <p className="mt-1 text-[12px] text-silver-300">Joined {view.joiningDate}{view.lastLoginAt ? ` • Last login ${new Date(view.lastLoginAt).toLocaleString()}` : ""}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <div className="rounded-xl bg-silver-50 p-3"><p className="text-[11px] font-bold text-muted">PHONE</p><p className="font-bold text-navy-700">{view.phone}</p></div>
              <div className="rounded-xl bg-silver-50 p-3"><p className="text-[11px] font-bold text-muted">EMAIL</p><p className="truncate font-bold text-navy-700">{view.email}</p></div>
              <div className="rounded-xl bg-silver-50 p-3"><p className="text-[11px] font-bold text-muted">SCHOOL</p><p className="font-bold text-navy-700">{view.school ?? "—"}</p></div>
              <div className="rounded-xl bg-silver-50 p-3"><p className="text-[11px] font-bold text-muted">CLASS</p><p className="font-bold text-navy-700">{view.className ?? "—"}</p></div>
            </div>
            <Button size="sm" className="w-full" onClick={() => { setView(null); openEdit(view); }}>Edit Student</Button>
          </div>
        ) : null}
      </AdminDrawer>

      <AdminModal open={edit !== null} title={edit ? `Edit — ${edit.name}` : "Edit"} onClose={() => setEdit(null)}>
        {err ? <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{err}</p> : null}
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-bold text-navy-700">Student type
              <select value={fType} onChange={(e) => { setFType(e.target.value); setConfirmType(false); }} className={inputCls}>
                <option value="REGULAR">REGULAR STUDENT</option>
                <option value="SCHOLARSHIP">SCHOLARSHIP STUDENT</option>
              </select>
            </label>
            <label className="block text-[12px] font-bold text-navy-700">Status
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={inputCls}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          {edit && fType !== edit.studentType ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-bold text-amber-800">
              {confirmType
                ? `Confirm: change ${edit.name} to ${fType}? Permissions apply immediately. Press Save to confirm.`
                : `Changing type affects permissions immediately. Press Save once to review, again to confirm.`}
            </p>
          ) : null}
          <label className="block text-[12px] font-bold text-navy-700">Batch (empty = remove)
            <select value={fBatch} onChange={(e) => setFBatch(e.target.value)} className={inputCls}>
              <option value="">No batch</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-bold text-navy-700">Mobile
              <input value={fPhone} onChange={(e) => setFPhone(e.target.value)} className={inputCls} />
            </label>
            <label className="block text-[12px] font-bold text-navy-700">Email
              <input value={fEmail} onChange={(e) => setFEmail(e.target.value)} className={inputCls} />
            </label>
            <label className="block text-[12px] font-bold text-navy-700">City
              <input value={fCity} onChange={(e) => setFCity(e.target.value)} className={inputCls} />
            </label>
            <label className="block text-[12px] font-bold text-navy-700">Class
              <input value={fClass} onChange={(e) => setFClass(e.target.value)} className={inputCls} />
            </label>
          </div>
          <label className="block text-[12px] font-bold text-navy-700">School
            <input value={fSchool} onChange={(e) => setFSchool(e.target.value)} className={inputCls} />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setEdit(null)}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={busy} onClick={() => void saveEdit()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {edit && fType !== edit.studentType && !confirmType ? "Review Change" : "Save"}
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}
