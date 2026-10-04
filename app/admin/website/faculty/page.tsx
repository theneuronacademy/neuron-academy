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
import { FACULTY } from "@/data/faculty";

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
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    // TODO backend: GET /api/admin/website/faculty
    setRows(FACULTY.map((f) => ({ id: f.id, name: f.name, subject: f.subject, qualification: f.qualification, active: true })));
    setReady(true);
  }, [router]);

  const filtered = useMemo(() => rows.filter((r) => !search.trim() || `${r.name} ${r.subject}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  const save = () => {
    if (!name.trim()) return;
    if (editing) setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, name: name.trim() } : r)));
    else setRows((p) => [...p, { id: `f-${Date.now()}`, name: name.trim(), subject: "Physics", qualification: "—", active: true }]);
    setModal(false);
    setSaved("Saved (demo — backend sync later).");
    window.setTimeout(() => setSaved(null), 2500);
  };
  const remove = (r: Row) => {
    if (!window.confirm(`Remove "${r.name}" from the website?`)) return;
    setRows((p) => p.filter((x) => x.id !== r.id));
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
                      setModal(true);
                    }}
                    aria-label={`Edit ${r.name}`}
                    className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(r)} aria-label={`Delete ${r.name}`} className="rounded-lg border border-crimson-100 p-2 text-crimson-DEFAULT hover:bg-crimson-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ),
            },
          ]}
          rows={filtered}
        />
      )}
      <AdminModal open={modal} title={editing ? "Edit Faculty" : "Add Faculty"} onClose={() => setModal(false)}>
        <label className="block text-[12px] font-bold text-navy-700">
          Display name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="e.g. Dr. S. Rao — Physics" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save}>
            Save (demo)
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}
