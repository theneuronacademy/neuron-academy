"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { Button } from "@/components/ui/primitives";
import { CloudinaryUpload } from "@/components/admin/CloudinaryUpload";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { cn } from "@/lib/utils";

interface Book {
  id: string; title: string; description: string | null; author: string | null;
  subject: string | null; className: string | null; category: string | null;
  coverImageUrl: string | null; pdfUrl: string | null; externalUrl: string | null;
  visibleTo: "ALL" | "REGULAR_ONLY"; isActive: boolean; order: number;
  // Durable storage refs (present on API rows); the form round-trips refs,
  // never expiring signed display URLs, back into PATCH.
  coverRef?: string | null; pdfRef?: string | null;
}

const EMPTY: Partial<Book> = { title: "", description: "", author: "", subject: "", className: "", category: "", pdfUrl: "", externalUrl: "", visibleTo: "ALL", isActive: true, order: 0 };

/** Phase 14 — admin book library management (CRUD + activate + reorder). */
export default function AdminBooksPage() {
  const router = useRouter();
  const { ready: authReady, isAdmin } = useAdminAuth();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Book[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [form, setForm] = useState<Partial<Book>>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/books", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true && Array.isArray(json.data?.items)) setRows(json.data.items as Book[]);
    } catch {
      /* empty state */
    }
  }

  useEffect(() => {
    if (!authReady || !isAdmin) return;
    (async () => {
      await load();
      setReady(true);
    })();
  }, [router, authReady, isAdmin]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setErr(null);
    setModal(true);
  }

  function openEdit(b: Book) {
    setEditing(b);
    // Prefill durable refs so saving never persists a signed display URL.
    setForm({ ...b, coverImageUrl: b.coverRef ?? b.coverImageUrl, pdfUrl: b.pdfRef ?? b.pdfUrl });
    setErr(null);
    setModal(true);
  }

  async function uploadPdf(file: File) {
    setPdfBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/books/upload-pdf", { method: "POST", body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "PDF upload failed.");
        return;
      }
      setForm((f) => ({ ...f, pdfUrl: json.data.pdfUrl as string }));
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setPdfBusy(false);
    }
  }

  async function save() {
    if (!form.title?.trim()) {
      setErr("Title is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const url = editing ? `/api/admin/books/${editing.id}` : "/api/admin/books";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Save failed.");
        return;
      }
      setModal(false);
      setSaved(editing ? "Book updated." : "Book added.");
      window.setTimeout(() => setSaved(null), 2500);
      await load();
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(b: Book) {
    try {
      await fetch(`/api/admin/books/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !b.isActive }),
      });
      await load();
    } catch {
      /* ignore */
    }
  }

  async function remove(b: Book) {
    if (!window.confirm(`Delete "${b.title}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/admin/books/${b.id}`, { method: "DELETE" });
      await load();
    } catch {
      /* ignore */
    }
  }

  if (!ready) {
    return (
      <AdminLayout title="Books" subtitle="Academic → Books">
        <LoadingState message="Loading books…" />
      </AdminLayout>
    );
  }

  const inputCls = "mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500";
  const set = (k: keyof Book, v: string | boolean | number) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <AdminLayout title="Books" subtitle={`${rows.length} titles • only active books reach students`}>
      <AdminPageHeader title="Book Library" description="Study material: covers, PDFs and external resources." actionLabel="Add Book" actionIcon={Plus} onAction={openNew} />
      {saved ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <div className="mt-3"><EmptyState title="No books yet" desc="Add the first study book — nothing is seeded automatically." /></div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((b) => (
            <article key={b.id} className="flex flex-col overflow-hidden rounded-card border border-silver-200 bg-white shadow-card">
              <div className="relative h-32 bg-gradient-to-br from-navy-800 to-teal-700">
                {b.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.coverImageUrl} alt={`${b.title} cover`} className="h-full w-full object-cover" />
                ) : null}
                <span className={cn("absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-widest", b.isActive ? "bg-teal-500 text-white" : "bg-silver-200 text-muted")}>
                  {b.isActive ? "ACTIVE" : "HIDDEN"}
                </span>
                <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-extrabold text-navy-700">
                  {b.visibleTo === "ALL" ? "ALL STUDENTS" : "REGULAR ONLY"}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-[15px] font-extrabold text-navy-700">{b.title}</h3>
                <p className="mt-0.5 text-[12px] text-muted">{[b.author, b.subject, b.className, b.category].filter(Boolean).join(" • ") || "—"}</p>
                <div className="mt-3 flex items-center gap-1.5 border-t border-silver-100 pt-3">
                  <button onClick={() => openEdit(b)} aria-label={`Edit ${b.title}`} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => void toggleActive(b)} className="rounded-lg border border-silver-300 px-3 py-2 text-[12px] font-bold text-navy-700 hover:border-teal-500">
                    {b.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => void remove(b)} aria-label={`Delete ${b.title}`} className="ml-auto rounded-lg border border-crimson-100 p-2 text-crimson hover:bg-crimson-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <AdminModal open={modal} title={editing ? `Edit — ${editing.title}` : "Add Book"} onClose={() => setModal(false)}>
        {err ? <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{err}</p> : null}
        <div className="grid gap-3">
          <label className="block text-[12px] font-bold text-navy-700">Title *
            <input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="e.g. NCERT Physics Class XI" className={inputCls} />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">Description
            <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2} className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-bold text-navy-700">Author
              <input value={form.author ?? ""} onChange={(e) => set("author", e.target.value)} className={inputCls} />
            </label>
            <label className="block text-[12px] font-bold text-navy-700">Subject
              <input value={form.subject ?? ""} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Physics" className={inputCls} />
            </label>
            <label className="block text-[12px] font-bold text-navy-700">Class
              <input value={form.className ?? ""} onChange={(e) => set("className", e.target.value)} placeholder="e.g. XI" className={inputCls} />
            </label>
            <label className="block text-[12px] font-bold text-navy-700">Category
              <input value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="e.g. NCERT" className={inputCls} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-bold text-navy-700">Visible to
              <select value={form.visibleTo ?? "ALL"} onChange={(e) => set("visibleTo", e.target.value)} className={inputCls}>
                <option value="ALL">All students</option>
                <option value="REGULAR_ONLY">Regular only</option>
              </select>
            </label>
            <label className="block text-[12px] font-bold text-navy-700">Order
              <input type="number" value={form.order ?? 0} onChange={(e) => set("order", Number(e.target.value))} className={inputCls} />
            </label>
          </div>
          <div>
            <span className="block text-[12px] font-bold text-navy-700">Cover image (Cloudinary CDN)</span>
            <CloudinaryUpload
              category="courses"
              accept="image/jpeg,image/png,image/webp"
              resourceType="image"
              label="Cover image"
              buttonLabel={form.coverImageUrl ? "Replace cover" : "Upload cover"}
              onUploadComplete={(url) => setForm((f) => ({ ...f, coverImageUrl: url }))}
            />
            {form.coverImageUrl ? (
              <span className="truncate text-[12px] font-bold text-teal-700">Cover set ✓</span>
            ) : null}
          </div>
          <label className="block text-[12px] font-bold text-navy-700">PDF file (optional)
            <div className="mt-1.5 flex items-center gap-2">
              <label className="cursor-pointer rounded-xl border border-silver-300 px-4 py-2.5 text-[13px] font-bold text-navy-700 hover:border-teal-500">
                {pdfBusy ? "Uploading…" : form.pdfUrl ? "Replace PDF" : "Upload PDF"}
                <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={pdfBusy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPdf(f); e.target.value = ""; }} />
              </label>
              {form.pdfUrl ? <span className="truncate text-[12px] font-bold text-teal-700">PDF set ✓</span> : null}
            </div>
            <input value={form.pdfUrl ?? ""} onChange={(e) => set("pdfUrl", e.target.value)} placeholder="/uploads/… or https://…" className={`${inputCls} mt-2`} />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">External URL (optional)
            <input value={form.externalUrl ?? ""} onChange={(e) => set("externalUrl", e.target.value)} placeholder="https://…" className={inputCls} />
          </label>
          <label className="flex items-center gap-2 text-[13px] font-bold text-navy-700">
            <input type="checkbox" checked={form.isActive !== false} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-[#008C9E]" />
            Active (visible to students)
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={busy || pdfBusy} onClick={() => void save()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {editing ? "Save" : "Add Book"}
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}
