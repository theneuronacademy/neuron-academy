// Faculty Materials Page - Lesson content management
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Trash2, FileText, Video, Link2, Download, Search } from "lucide-react";
import { FacultyShell } from "@/components/faculty/FacultyShell";
import { useFacultyMaterials, useCreateMaterial, useUpdateMaterial, useDeleteMaterial, useFacultyBatches } from "@/lib/faculty-hooks";
import type { MaterialItem } from "@/types/faculty";
import { cn } from "@/lib/utils";

const KINDS = [
  { value: "NOTE", label: "Note", icon: FileText },
  { value: "VIDEO", label: "Video", icon: Video },
  { value: "LINK", label: "Link", icon: Link2 },
  { value: "PDF", label: "PDF", icon: Download },
] as const;

export default function FacultyMaterialsPage() {
  const router = useRouter();
  const { data: batches } = useFacultyBatches();
  const [batchId, setBatchId] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; material?: MaterialItem } | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    kind: "NOTE" as "NOTE" | "VIDEO" | "LINK" | "PDF",
    url: "",
    description: "",
    displayOrder: 0,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: materials, isLoading, refetch } = useFacultyMaterials(batchId || undefined);
  const createMut = useCreateMaterial({ onSuccess: () => { setModal(null); refetch(); } });
  const updateMut = useUpdateMaterial({ onSuccess: () => { setModal(null); refetch(); } });
  const deleteMut = useDeleteMaterial({ onSuccess: () => refetch() });

  useEffect(() => {
    if (batches?.length && !batchId) setBatchId(batches[0].id);
  }, [batches, batchId]);

  function openCreate() {
    setFormData({ title: "", subject: "", kind: "NOTE", url: "", description: "", displayOrder: 0 });
    setModal({ mode: "create" });
  }

  function openEdit(m: MaterialItem) {
    setFormData({
      title: m.title,
      subject: m.subject ?? "",
      kind: m.kind as "NOTE" | "VIDEO" | "LINK" | "PDF",
      url: m.url ?? "",
      description: m.description ?? "",
      displayOrder: m.displayOrder,
    });
    setModal({ mode: "edit", material: m });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (modal?.mode === "create") {
        await createMut.mutateAsync({ ...formData, batchId: batchId! });
      } else if (modal?.material) {
        await updateMut.mutateAsync({ id: modal.material.id, payload: formData });
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this material?")) return;
    try {
      await deleteMut.mutateAsync(id);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const filtered = materials?.filter((m) =>
    !search || m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.subject?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  if (isLoading) {
    return (
      <FacultyShell title="Materials" subtitle="Lesson content for your batches">
        <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading materials…</p>
      </FacultyShell>
    );
  }

  return (
    <FacultyShell title="Materials" subtitle="Lesson notes, videos, links & PDFs">
      {err && <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{err}</p>}

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-[13px] font-bold text-navy-700">
          {batches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, subject…" className="min-w-[250px] flex-1 rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500" />
        <button onClick={openCreate} className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800 flex items-center gap-2"><Plus className="h-4 w-4" /> Add Material</button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No materials yet. Click \u201cAdd Material\u201d to create your first one.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => {
            const KindIcon = KINDS.find((k) => k.value === m.kind)?.icon ?? FileText;
            return (
              <div key={m.id} className="rounded-card border border-silver-200 bg-white p-4 shadow-card hover:border-teal-300 hover:shadow-lg transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <KindIcon className="h-5 w-5 text-teal-600" />
                    <div>
                      <p className="font-extrabold text-navy-700 truncate max-w-[200px]">{m.title}</p>
                      <p className="text-[12px] text-muted">{m.subject ?? "General"} · {m.batch?.name ?? "No batch"}</p>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", m.isActive ? "bg-emerald-50 text-emerald-700" : "bg-silver-100 text-muted")}>
                    {m.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                {m.description && <p className="mt-2 text-[13px] text-muted line-clamp-2">{m.description}</p>}
                {m.url && (
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-teal-600 hover:underline">
                    <Link2 className="h-3.5 w-3.5" /> Open Resource
                  </a>
                )}
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button onClick={() => openEdit(m)} className="rounded-lg border border-silver-300 p-1.5 text-navy-700 hover:border-teal-500" aria-label="Edit">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(m.id)} className="rounded-lg border border-crimson-100 p-1.5 text-crimson hover:bg-crimson-50" aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold text-navy-700">{modal.mode === "create" ? "Add Material" : "Edit Material"}</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              {err && <p className="rounded-xl bg-crimson-50 px-3 py-2 text-[13px] font-bold text-crimson">{err}</p>}
              <label className="block text-[12px] font-bold text-navy-700">Title<input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
              <label className="block text-[12px] font-bold text-navy-700">Subject<input value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
              <label className="block text-[12px] font-bold text-navy-700">Type<select value={formData.kind} onChange={(e) => setFormData({...formData, kind: e.target.value as "NOTE"|"VIDEO"|"LINK"|"PDF"})} className="mt-1.5 w-full rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500">
                {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select></label>
              <label className="block text-[12px] font-bold text-navy-700">URL (for Video/Link/PDF)<input value={formData.url} onChange={(e) => setFormData({...formData, url: e.target.value})} placeholder="https://..." className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
              <label className="block text-[12px] font-bold text-navy-700">Description<textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={3} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
              <label className="block text-[12px] font-bold text-navy-700">Display Order<input type="number" value={formData.displayOrder} onChange={(e) => setFormData({...formData, displayOrder: Number(e.target.value)})} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModal(null)} className="rounded-xl border border-silver-300 px-4 py-2 text-sm font-bold text-navy-700 hover:border-teal-500">Cancel</button>
                <button type="submit" disabled={busy || createMut.isPending || updateMut.isPending} className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-60">
                  {busy || createMut.isPending || updateMut.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </FacultyShell>
  );
}