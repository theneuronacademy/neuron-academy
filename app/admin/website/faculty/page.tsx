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
import { isAdminAuthenticated } from "@/lib/adminAuth";

interface Row {
  id: string;
  name: string;
  subject: string;
  qualification: string;
  active: boolean;
}

export default function WebsiteFacultyPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [qualification, setQualification] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
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
    const payload = { name: name.trim(), subject: subject.trim(), qualification: qualification.trim(), isActive: true };
    try {
      if (editing) {
        const res = await fetch(`/api/faculty/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        if (res.ok) {
          setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, name: name.trim(), subject: subject.trim(), qualification: qualification.trim() } : r)));
          setSaved("Faculty profile updated.");
        } else {
          setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, name: name.trim(), subject: subject.trim(), qualification: qualification.trim() } : r)));
          setSaved("Updated locally (database unavailable).");
        }
      } else {
        const res = await fetch("/api/faculty", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, email: `${name.trim().toLowerCase().replace(/\s+/g, ".")}@neuronacademy.in`, phone: "+91 97119 17317" }),
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && json.data?.item) {
          const item = json.data.item;
          setRows((p) => [...p, { id: item.id, name: item.name, subject: item.subject ?? "", qualification: item.qualification ?? "", active: true }]);
          setSaved("Faculty profile added.");
        } else {
          setRows((p) => [...p, { id: `f-${Date.now()}`, name: name.trim(), subject: subject.trim(), qualification: qualification.trim(), active: true }]);
          setSaved("Added locally (database unavailable).");
        }
      }
    } catch {
      if (editing) setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, name: name.trim(), subject: subject.trim(), qualification: qualification.trim() } : r)));
      else setRows((p) => [...p, { id: `f-${Date.now()}`, name: name.trim(), subject: subject.trim(), qualification: qualification.trim(), active: true }]);
      setSaved("Saved locally (database unavailable).");
    }
    setModal(false);
    setEditing(null);
    setName("");
    setSubject("Physics");
    setQualification("");
    window.setTimeout(() => setSaved(null), 2500);
  };

  const remove = async (r: Row) => {
    if (!window.confirm(`Remove "${r.name}" from the website?`)) return;
    try {
      const res = await fetch(`/api/faculty/${r.id}`, { method: "DELETE", cache: "no-store" });
      if (res.ok) {
        setRows((p) => p.filter((x) => x.id !== r.id));
        setSaved("Faculty profile removed.");
      } else {
        setRows((p) => p.filter((x) => x.id !== r.id));
        setSaved("Removed locally (database unavailable).");
      }
    } catch {
      setRows((p) => p.filter((x) => x.id !== r.id));
      setSaved("Removed locally (database unavailable).");
    }
    window.setTimeout(() => setSaved(null), 2500);
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
        onAction={() => {
          setEditing(null);
          setName("");
          setSubject("Physics");
          setQualification("");
          setModal(true);
        }}
      />
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
                <button onClick={() => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)))}>
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
                      setSubject(r.subject);
                      setQualification(r.qualification);
                      setModal(true);
                    }}
                    aria-label={`Edit ${r.name}`}
                    className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(r)} aria-label={`Delete ${r.name}`} className="rounded-lg border border-crimson-100 p-2 text-crimson hover:bg-crimson-50">
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
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="Physics" />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Qualification
          <input value={qualification} onChange={(e) => setQualification(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="M.Sc, Ph.D — 15 yrs exp" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setModal(false); setEditing(null); }}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save}>
            Save
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}