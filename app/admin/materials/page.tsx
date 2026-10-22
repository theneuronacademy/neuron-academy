"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { CloudinaryUpload } from "@/components/admin/CloudinaryUpload";
import { Button } from "@/components/ui/primitives";

interface Material {
  id: string; title: string; subject: string | null; kind: string;
  url: string | null; description: string | null; isActive: boolean; displayOrder: number;
}

const KINDS = ["NOTE", "VIDEO", "LINK", "PDF"];

export default function AdminMaterialsPage() {
  const ready = useAdminGuard();
  const [items, setItems] = useState<Material[]>([]);
  const [form, setForm] = useState({ title: "", subject: "", kind: "NOTE", url: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/materials", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      setItems(res.ok && json?.success === true && Array.isArray(json.data?.items) ? json.data.items : []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    if (ready) void load();
  }, [ready]);

  async function create() {
    if (!form.title.trim()) { setErr("Title is required."); return; }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title.trim(), subject: form.subject.trim() || undefined, kind: form.kind, url: form.url.trim() || undefined, description: form.description.trim() || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Could not create material.");
        return;
      }
      setForm({ title: "", subject: "", kind: "NOTE", url: "", description: "" });
      setMsg("Material added.");
      await load();
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(m: Material) {
    try {
      const res = await fetch("/api/materials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, isActive: !m.isActive }),
      });
      if (res.ok) await load();
    } catch {
      setErr("Cannot reach the server.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this material?")) return;
    try {
      const res = await fetch(`/api/materials?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) await load();
    } catch {
      setErr("Cannot reach the server.");
    }
  }

  const inputCls = "rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500";

  return (
    <AdminLayout title="Study Material" subtitle="Notes, videos and links for students">
      {err ? <p className="rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson-600" role="alert">{err}</p> : null}
      {msg ? <p className="mt-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-[13px] font-bold text-teal-700" role="status">{msg}</p> : null}

      <div className="mt-3 rounded-card border border-silver-200 bg-white p-4 shadow-card">
        <p className="text-[14px] font-extrabold text-navy-700">Add material</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" className={inputCls} />
          <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Subject" className={inputCls} />
          <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))} className={inputCls}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://… (optional)" className={inputCls} />
          <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short description" className={inputCls} />
        </div>
        <CloudinaryUpload
          category="study-material"
          accept="image/*,video/*,application/pdf"
          resourceType={form.kind === "VIDEO" ? "video" : "image"}
          label={form.kind === "LINK" || form.kind === "NOTE" ? "Media URL (enter above)" : "Upload media file"}
          buttonLabel={form.url ? "Replace media" : "Upload media"}
          onUploadComplete={(url) => setForm((f) => ({ ...f, url }))}
        />
        <button onClick={create} disabled={busy} className="mt-2 rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-50">Add Material</button>
      </div>

      <div className="mt-3 space-y-2">
        {items.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-silver-200 bg-white px-4 py-3 shadow-card">
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-navy-700">{m.title} <span className="ml-1 rounded-full bg-silver-100 px-2 py-0.5 text-[10px] text-muted">{m.kind}</span></p>
              <p className="text-[12px] text-muted">{m.subject ?? "—"}{m.url ? ` · ${m.url.slice(0, 40)}` : ""} · {m.isActive ? "Active" : "Hidden"}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toggle(m)} className="rounded-lg border border-silver-300 px-3 py-1.5 text-[12px] font-bold text-navy-700 hover:border-teal-500">
                {m.isActive ? "Hide" : "Show"}
              </button>
              <button onClick={() => remove(m.id)} className="rounded-lg border border-silver-300 px-3 py-1.5 text-[12px] font-bold text-crimson-600 hover:border-crimson-500">Delete</button>
            </div>
          </div>
        ))}
        {items.length === 0 ? <p className="rounded-card border border-dashed border-silver-300 bg-white p-6 text-center text-sm font-bold text-muted">No materials yet.</p> : null}
      </div>
    </AdminLayout>
  );
}
