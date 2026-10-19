// Faculty Assignments Page - Homework/Assignment management
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Trash2, ClipboardList, Eye, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { FacultyShell } from "@/components/faculty/FacultyShell";
import { useFacultyAssignments, useCreateAssignment, useFacultyBatches, useFacultyTests } from "@/lib/faculty-hooks";
import type { AssignmentItem } from "@/types/faculty";
import { cn } from "@/lib/utils";

const STATUSES = ["DRAFT", "PUBLISHED", "CLOSED"] as const;

export default function FacultyAssignmentsPage() {
  const router = useRouter();
  const { data: batches } = useFacultyBatches();
  const { data: tests } = useFacultyTests();
  const [batchId, setBatchId] = useState("");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; assignment?: AssignmentItem } | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    testId: "",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    maxMarks: 100,
    weight: 10,
    status: "DRAFT" as "DRAFT" | "PUBLISHED" | "CLOSED",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: assignments, isLoading, refetch } = useFacultyAssignments(batchId || undefined);
  const createMut = useCreateAssignment({ onSuccess: () => { setModal(null); refetch(); } });

  useEffect(() => {
    if (batches?.length && !batchId) setBatchId(batches[0].id);
  }, [batches, batchId]);

  function openCreate() {
    setFormData({
      title: "",
      description: "",
      testId: "",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      maxMarks: 100,
      weight: 10,
      status: "DRAFT",
    });
    setModal({ mode: "create" });
  }

  function openEdit(a: AssignmentItem) {
    setFormData({
      title: a.title,
      description: a.description ?? "",
      testId: a.testId ?? "",
      dueDate: a.dueDate ? new Date(a.dueDate).toISOString().slice(0, 16) : "",
      maxMarks: a.maxMarks,
      weight: a.weight,
      status: a.status as "DRAFT" | "PUBLISHED" | "CLOSED",
    });
    setModal({ mode: "edit", assignment: a });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (modal?.mode === "create") {
        await createMut.mutateAsync({ ...formData, batchId: batchId! });
      } else if (modal?.assignment) {
        // Update not implemented in hook yet
        setErr("Edit not yet implemented");
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }

  function getStatusBadge(status: string) {
    return (
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
        status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" :
        status === "CLOSED" ? "bg-silver-100 text-muted" :
        "bg-amber-50 text-amber-700"
      )}>
        {status}
      </span>
    );
  }

  function isOverdue(dueDate: string) {
    return new Date(dueDate) < new Date();
  }

  if (isLoading) {
    return (
      <FacultyShell title="Assignments" subtitle="Homework & assignments for your batches">
        <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading assignments…</p>
      </FacultyShell>
    );
  }

  return (
    <FacultyShell title="Assignments" subtitle="Create & manage homework for your batches">
      {err && <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{err}</p>}

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-[13px] font-bold text-navy-700">
          {batches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button onClick={openCreate} className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800 flex items-center gap-2"><Plus className="h-4 w-4" /> Create Assignment</button>
      </div>

      {assignments?.length === 0 ? (
        <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No assignments yet. Click \u201cCreate Assignment\u201d to start.</p>
      ) : (
        <div className="space-y-3">
          {assignments!.map((a) => (
            <div key={a.id} className="rounded-card border border-silver-200 bg-white p-4 shadow-card hover:border-teal-300 hover:shadow-lg transition">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <ClipboardList className="h-5 w-5 text-teal-600" />
                    <div>
                      <p className="font-extrabold text-navy-700 truncate">{a.title}</p>
                      <p className="text-[12px] text-muted">{a.batch ?? "No batch"} · Due: {a.dueDate ? new Date(a.dueDate).toLocaleString() : "—"}</p>
                    </div>
                    {a.test && <span className="rounded-full bg-teal-50 text-teal-700 px-2 py-0.5 text-[10px] font-bold">Linked Test</span>}
                  </div>
                  {a.description && <p className="mt-2 text-[13px] text-muted line-clamp-2">{a.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
                    <span className="flex items-center gap-1 text-muted"><Clock className="h-3.5 w-3.5" /> Max Marks: {a.maxMarks}</span>
                    <span className="flex items-center gap-1 text-muted"><CheckCircle2 className="h-3.5 w-3.5" /> Weight: {a.weight}%</span>
                    {isOverdue(a.dueDate) && a.status !== "CLOSED" && (
                      <span className="flex items-center gap-1 text-crimson"><AlertCircle className="h-3.5 w-3.5" /> Overdue</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(a.status)}
                  <button onClick={() => openEdit(a)} className="rounded-lg border border-silver-300 p-1.5 text-navy-700 hover:border-teal-500" aria-label="Edit"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => router.push(`/faculty/assignments/${a.id}/submissions`)} className="rounded-lg border border-silver-300 p-1.5 text-navy-700 hover:border-teal-500" aria-label="View Submissions"><Eye className="h-4 w-4" /></button>
                  <button onClick={() => { if (window.confirm("Delete this assignment?")) {/* delete */ }} } className="rounded-lg border border-crimson-100 p-1.5 text-crimson hover:bg-crimson-50" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold text-navy-700">{modal.mode === "create" ? "Create Assignment" : "Edit Assignment"}</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              {err && <p className="rounded-xl bg-crimson-50 px-3 py-2 text-[13px] font-bold text-crimson">{err}</p>}
              <label className="block text-[12px] font-bold text-navy-700">Title<input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
              <label className="block text-[12px] font-bold text-navy-700">Description<textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={2} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
              <label className="block text-[12px] font-bold text-navy-700">Link to Test (optional)<select value={formData.testId} onChange={(e) => setFormData({...formData, testId: e.target.value})} className="mt-1.5 w-full rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500">
                <option value="">None</option>
                {tests?.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.batch})</option>)}
              </select></label>
              <label className="block text-[12px] font-bold text-navy-700">Due Date<input type="datetime-local" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} required className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[12px] font-bold text-navy-700">Max Marks<input type="number" value={formData.maxMarks} onChange={(e) => setFormData({...formData, maxMarks: Number(e.target.value)})} min="1" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
                <label className="block text-[12px] font-bold text-navy-700">Weight (%)<input type="number" value={formData.weight} onChange={(e) => setFormData({...formData, weight: Number(e.target.value)})} min="0" max="100" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
              </div>
              <label className="block text-[12px] font-bold text-navy-700">Status<select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as "DRAFT"|"PUBLISHED"|"CLOSED"})} className="mt-1.5 w-full rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModal(null)} className="rounded-xl border border-silver-300 px-4 py-2 text-sm font-bold text-navy-700 hover:border-teal-500">Cancel</button>
                <button type="submit" disabled={busy || createMut.isPending} className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-60">
                  {busy || createMut.isPending ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </FacultyShell>
  );
}