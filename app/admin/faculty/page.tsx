"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Eye, Trash2, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminStatusBadge, statusToneFor } from "@/components/admin/AdminStatusBadge";
import { AdminModal, AdminDrawer } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { SearchBar, FilterBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getFaculty } from "@/services/adminApi";
import type { AdminFaculty } from "@/data/admin";

export default function FacultyAdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<AdminFaculty[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  // Phase 17 — explicit contact fields (never fabricated). API failure is
  // reported honestly; nothing is appended locally.
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [view, setView] = useState<AdminFaculty | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      // Real fetch: GET /api/faculty (service falls back to demo data when DB is unavailable)
      setRows(await getFaculty());
      setReady(true);
    })();
  }, [router]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => (status === "all" || r.status === status) && (!search.trim() || `${r.name} ${r.subject} ${r.email}`.toLowerCase().includes(search.toLowerCase()))
      ),
    [rows, search, status]
  );

  const flashSaved = (msg: string) => {
    setSaved(msg);
    window.setTimeout(() => setSaved(null), 2500);
  };

  /** Demo rows use short ids (f1…) or local f-<ts>; anything else is treated as a DB id. */
  function isDbId(id: string): boolean {
    return !id.startsWith("f-") && id.length >= 10;
  }

  const onboardFaculty = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setFormError(null);
    const mail = email.trim().toLowerCase();
    const tel = phone.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setFormError("Enter a valid email address.");
      return;
    }
    if (tel.replace(/\D/g, "").length < 10) {
      setFormError("Enter a valid phone number (min 10 digits).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/faculty", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, email: mail, phone: tel, subject: subject.trim() || undefined }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { item?: AdminFaculty }; error?: string } | null;
      const created = json?.data?.item;
      if (res.ok && json?.success && created) {
        setRows((p) => [created, ...p]);
        setModal(false);
        setName("");
        setEmail("");
        setPhone("");
        setSubject("");
        flashSaved("Faculty onboarded.");
      } else {
        setFormError(json?.error ?? "Could not onboard faculty. Check for duplicate email/phone.");
      }
    } catch {
      setFormError("Cannot reach the server. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (row: AdminFaculty) => {
    const next = row.status === "active" ? "inactive" : "active";
    // Phase 17 — server is authoritative; failures surface honestly.
    setPageError(null);
    if (!isDbId(row.id)) {
      setPageError("Demo rows cannot be changed. Onboard faculty to manage status.");
      return;
    }
    try {
      const res = await fetch(`/api/faculty/${row.id}`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next === "active" ? "ACTIVE" : "INACTIVE" }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { item?: AdminFaculty }; error?: string } | null;
      const updated = json?.data?.item;
      if (res.ok && json?.success && updated) {
        setRows((p) => p.map((x) => (x.id === row.id ? updated : x)));
        return;
      }
      setPageError(json?.error ?? "Could not change status.");
    } catch {
      setPageError("Cannot reach the server. Status unchanged.");
    }
  };

  const deleteFaculty = async (row: AdminFaculty) => {
    if (!window.confirm(`Remove faculty "${row.name}"? Assigned batches block deletion.`)) return;
    setPageError(null);
    try {
      const res = await fetch(`/api/faculty/${row.id}`, { method: "DELETE", cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (res.ok && json?.success !== false) {
        setRows((p) => p.filter((x) => x.id !== row.id));
        flashSaved("Faculty removed.");
        return;
      }
      // Phase 17 — 409 dependency guard message reaches the admin verbatim.
      setPageError(json?.error ?? "Could not remove faculty.");
    } catch {
      setPageError("Cannot reach the server. Nothing was deleted.");
    }
  };

  if (!ready) {
    return (
      <AdminLayout title="Faculty" subtitle="People → Faculty">
        <LoadingState message="Loading faculty…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Faculty" subtitle="Mentors, subjects and batch assignments">
      <AdminPageHeader title="Faculty Management" description={`${filtered.length} faculty • assign batches and subjects.`} actionLabel="Add Faculty" actionIcon={Plus} onAction={() => { setName(""); setEmail(""); setPhone(""); setSubject(""); setFormError(null); setModal(true); }} />
      {pageError ? (
        <p className="rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">
          {pageError}
        </p>
      ) : null}
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search faculty…" />
        <FilterBar value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="No faculty found" desc="Onboard the first mentor." />
      ) : (
        <AdminTable<AdminFaculty>
          columns={[
            {
              key: "f",
              header: "Faculty",
              render: (r) => (
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-700 text-[13px] font-extrabold text-white">{r.name.charAt(0)}</span>
                  <span>
                    <span className="block font-extrabold text-navy-700">{r.name}</span>
                    <span className="block text-[12px] text-muted">{r.subject} • {r.experience}</span>
                  </span>
                </div>
              ),
            },
            { key: "q", header: "Qualification", render: (r) => <span className="text-muted">{r.qualification}</span> },
            { key: "b", header: "Batches", render: (r) => <span className="text-[13px] font-semibold text-navy-700">{r.batches.join(", ")}</span> },
            { key: "s", header: "Status", render: (r) => <AdminStatusBadge tone={statusToneFor(r.status)}>{r.status}</AdminStatusBadge> },
            {
              key: "x",
              header: "Actions",
              className: "text-right",
              render: (r) => (
                <div className="flex justify-end gap-1.5">
                  <button onClick={() => setView(r)} aria-label={`View ${r.name}`} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleStatus(r)}
                    aria-label={`${r.status === "active" ? "Deactivate" : "Activate"} ${r.name}`}
                    className="rounded-lg border border-silver-300 px-2.5 py-2 text-[12px] font-bold text-navy-700 hover:border-teal-500"
                  >
                    {r.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => deleteFaculty(r)}
                    aria-label={`Delete ${r.name}`}
                    className="rounded-lg border border-crimson-100 p-2 text-crimson hover:bg-crimson-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ),
            },
          ]}
          rows={filtered}
        />
      )}
      <AdminModal open={modal} title="Add Faculty" onClose={() => setModal(false)}>
        <label className="block text-[12px] font-bold text-navy-700">
          Full name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr. S. Rao" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="faculty@example.com" inputMode="email" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" inputMode="tel" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Subject (optional)
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Physics" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
        </label>
        {formError ? (
          <p className="mt-3 rounded-xl bg-crimson-50 px-3.5 py-2.5 text-[13px] font-bold text-crimson" role="alert">{formError}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onboardFaculty} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </AdminModal>
      <AdminDrawer open={view !== null} title={view ? view.name : "Faculty"} onClose={() => setView(null)}>
        {view ? (
          <div className="space-y-3 text-[13px]">
            <p className="font-bold text-navy-700">{view.subject} • {view.qualification}</p>
            <p className="text-muted">{view.experience} experience</p>
            <p><span className="font-bold text-navy-700">Email:</span> {view.email}</p>
            <p><span className="font-bold text-navy-700">Phone:</span> {view.phone}</p>
            <p><span className="font-bold text-navy-700">Batches:</span> {view.batches.join(", ") || "Unassigned"}</p>
            <p className="text-muted">Assign batches from the Batches page (faculty assignment).</p>
          </div>
        ) : null}
      </AdminDrawer>
    </AdminLayout>
  );
}
