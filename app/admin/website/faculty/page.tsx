"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { SearchBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface Row {
  id: string;
  name: string;
  subject: string;
  qualification: string;
  active: boolean;
  email?: string;
  phone?: string;
}

export default function WebsiteFacultyPage() {
  const router = useRouter();
  const { ready: authReady, isAdmin } = useAdminAuth();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [qualification, setQualification] = useState("");
  // Phase 17 — faculty records require real contact data (never fabricated).
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady || !isAdmin) return;
    (async () => {
      try {
        const res = await fetch("/api/faculty", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json.data?.items)) {
          setRows((json.data.items as Array<{ id: string; name?: string; subject?: string; qualification?: string; isActive?: boolean }>).map((f) => ({
            id: f.id,
            name: f.name ?? "",
            subject: f.subject ?? "",
            qualification: f.qualification ?? "",
            active: f.isActive ?? true,
          })));
        } else {
          const { FACULTY } = await import("@/data/faculty");
          setRows(FACULTY.map((f) => ({ id: f.id, name: f.name, subject: f.subject, qualification: f.qualification, active: true })));
        }
      } catch {
        const { FACULTY } = await import("@/data/faculty");
        setRows(FACULTY.map((f) => ({ id: f.id, name: f.name, subject: f.subject, qualification: f.qualification, active: true })));
      }
      setReady(true);
    })();
  }, [router]);

  const filtered = useMemo(() => rows.filter((r) => !search.trim() || `${r.name} ${r.subject}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  const save = async () => {
    if (!name.trim()) return;
    // Phase 17 — faculty records persist via the API with real contact
    // data. Failures surface honestly; nothing is written locally.
    setFormError(null);
    const mail = email.trim().toLowerCase();
    const tel = phone.trim();
    if (!editing) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
        setFormError("Enter a valid email address.");
        return;
      }
      if (tel.replace(/\D/g, "").length < 10) {
        setFormError("Enter a valid phone number (min 10 digits).");
        return;
      }
    }
    const payload = { name: name.trim(), subject: subject.trim(), qualification: qualification.trim(), isActive: true };
    try {
      if (editing) {
        const res = await fetch(`/api/faculty/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success !== false) {
          setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, name: name.trim(), subject: subject.trim(), qualification: qualification.trim() } : r)));
          setSaved("Faculty profile updated.");
          setModal(false);
          setEditing(null);
        } else {
          setFormError(json?.error ?? "Could not update profile. Nothing was saved.");
          return;
        }
      } else {
        const res = await fetch("/api/faculty", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, email: mail, phone: tel }),
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && json.data?.item) {
          const item = json.data.item;
          setRows((p) => [...p, { id: item.id, name: item.name, subject: item.subject ?? "", qualification: item.qualification ?? "", active: true }]);
          setSaved("Faculty profile added.");
          setModal(false);
        } else {
          setFormError(json?.error ?? "Could not add profile. Check for duplicate email/phone. Nothing was saved.");
          return;
        }
      }
    } catch {
      setFormError("Cannot reach the server. Nothing was saved.");
      return;
    }
    setEditing(null);
    setName("");
    setEmail("");
    setPhone("");
    setSubject("Physics");
    setQualification("");
    window.setTimeout(() => setSaved(null), 2500);
  };

  const remove = async (r: Row) => {
    if (!window.confirm(`Remove "${r.name}" from the website? Faculty with assigned batches cannot be deleted — deactivate them instead.`)) return;
    setPageError(null);
    try {
      const res = await fetch(`/api/faculty/${r.id}`, { method: "DELETE", cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setRows((p) => p.filter((x) => x.id !== r.id));
        setSaved("Faculty profile removed.");
      } else {
        // Phase 17 — 409 dependency guard message reaches the admin verbatim.
        setPageError(json?.error ?? "Could not remove profile. Nothing was deleted.");
      }
    } catch {
      setPageError("Cannot reach the server. Nothing was deleted.");
    }
    window.setTimeout(() => setSaved(null), 2500);
  };

  // Phase 17 — visibility persists as faculty status (controls the website).
  const toggleActive = async (r: Row) => {
    setPageError(null);
    const next = !r.active;
    try {
      const res = await fetch(`/api/faculty/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next ? "ACTIVE" : "INACTIVE" }),
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success !== false) {
        setRows((p) => p.map((x) => (x.id === r.id ? { ...x, active: next } : x)));
      } else {
        setPageError(json?.error ?? "Could not change visibility.");
      }
    } catch {
      setPageError("Cannot reach the server. Visibility unchanged.");
    }
  };

  if (!ready) {
    return (
      <AdminLayout title="Faculty Page" subtitle="Website → Faculty">
        <LoadingState message="Loading faculty…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Faculty Page" subtitle="Public faculty profiles">
      <AdminPageHeader
        title="Website Faculty"
        description={`${filtered.length} profiles • photo, qualification and assigned subjects.`}
        actionLabel="Add Faculty"
        actionIcon={Plus}
        onAction={() => { setEditing(null); setName(""); setEmail(""); setPhone(""); setSubject("Physics"); setQualification(""); setFormError(null); setModal(true); }}
      />
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
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="No faculty found" desc="Add the first public faculty profile." />
      ) : (
        <AdminTable<Row>
          columns={[
            { key: "name", header: "Name", render: (r) => <span className="font-extrabold text-navy-700">{r.name}</span> },
            { key: "sub", header: "Subject", render: (r) => r.subject },
            { key: "q", header: "Qualification", render: (r) => <span className="text-muted">{r.qualification}</span> },
            {
              key: "st",
              header: "Status",
              render: (r) => (
                <button onClick={() => void toggleActive(r)} aria-label={`Toggle visibility of ${r.name}`} aria-pressed={r.active}>
                  <AdminStatusBadge tone={r.active ? "green" : "gray"}>{r.active ? "Active" : "Hidden"}</AdminStatusBadge>
                </button>
              ),
            },
            {
              key: "a",
              header: "Actions",
              className: "text-right",
              render: (r) => (
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => {
                      setEditing(r);
                      setName(r.name);
                      setEmail(r.email ?? "");
                      setPhone(r.phone ?? "");
                      setSubject(r.subject);
                      setQualification(r.qualification);
                      setFormError(null);
                      setModal(true);
                    }}
                    aria-label={`Edit ${r.name}`}
                    className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => void remove(r)} aria-label={`Delete ${r.name}`} className="rounded-lg border border-crimson-100 p-2 text-crimson hover:bg-crimson-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ),
            },
          ]}
          rows={filtered}
        />
      )}
      <AdminModal open={modal} title={editing ? "Edit Faculty" : "Add Faculty"} onClose={() => { setModal(false); setEditing(null); }}>
        <label className="block text-[12px] font-bold text-navy-700">
          Display name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="e.g. Dr. S. Rao — Physics" />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="faculty@example.com" inputMode="email" />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="10-digit mobile" inputMode="tel" />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="Physics" />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Qualification
          <input value={qualification} onChange={(e) => setQualification(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="M.Sc, Ph.D — 15 yrs exp" />
        </label>
        {formError ? (
          <p className="mt-3 rounded-xl bg-crimson-50 px-3.5 py-2.5 text-[13px] font-bold text-crimson" role="alert">{formError}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setModal(false); setEditing(null); }}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => void save()}>
            Save
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}