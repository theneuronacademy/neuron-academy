"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, CheckCircle2, Eye } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { Button } from "@/components/ui/primitives";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface Row {
  id: string;
  key: string;
  value: string;
  type: string;
  isActive: boolean;
}

export default function HomepageContentPage() {
  const router = useRouter();
  const { ready: authReady, isAdmin } = useAdminAuth();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState("text");
  const [saved, setSaved] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady || !isAdmin) return;
    (async () => {
      try {
        const res = await fetch("/api/homepage/content", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json.data?.items)) {
          setRows(
            (json.data.items as Array<{ id: string; key?: string; value?: string; type?: string; isActive?: boolean }>).map((i) => ({
              id: i.id,
              key: i.key ?? "",
              value: i.value ?? "",
              type: i.type ?? "text",
              isActive: i.isActive ?? true,
            }))
          );
        } else {
          setPageError(json?.error ?? "Could not load homepage content.");
        }
      } catch {
        setPageError("Cannot reach the server.");
      }
      setReady(true);
    })();
  }, [router, authReady, isAdmin]);

  const save = async () => {
    if (!key.trim()) {
      setFormError("Key is required.");
      return;
    }
    if (!value.trim()) {
      setFormError("Value is required.");
      return;
    }
    setFormError(null);
    try {
      if (editing) {
        const res = await fetch(`/api/homepage/content/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: value.trim(), type, isActive: true }),
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success !== false) {
          setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, value: value.trim(), type, isActive: true } : r)));
          setSaved("Homepage content updated.");
          setModal(false);
          setEditing(null);
        } else {
          setFormError(json?.error ?? "Could not update content. Nothing was saved.");
          return;
        }
      } else {
        const res = await fetch("/api/homepage/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: key.trim(), value: value.trim(), type }),
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && json.data?.item) {
          const item = json.data.item;
          setRows((p) => [...p, { id: item.id, key: item.key, value: item.value, type: item.type, isActive: true }]);
          setSaved("Homepage content added.");
          setModal(false);
        } else {
          setFormError(json?.error ?? "Could not add content. Nothing was saved.");
          return;
        }
      }
    } catch {
      setFormError("Cannot reach the server. Nothing was saved.");
      return;
    }
    setKey("");
    setValue("");
    setType("text");
    window.setTimeout(() => setSaved(null), 2500);
  };

  const toggleActive = async (r: Row) => {
    setPageError(null);
    const next = !r.isActive;
    try {
      const res = await fetch(`/api/homepage/content/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
        cache: "no-store",
      });
      if (res.ok) {
        setRows((p) => p.map((x) => (x.id === r.id ? { ...x, isActive: next } : x)));
      } else {
        setPageError("Could not change visibility.");
      }
    } catch {
      setPageError("Cannot reach the server. Visibility unchanged.");
    }
  };

  const remove = async (r: Row) => {
    if (!window.confirm(`Deactivate "${r.key}"?`)) return;
    setPageError(null);
    try {
      const res = await fetch(`/api/homepage/content/${r.id}`, { method: "DELETE", cache: "no-store" });
      if (res.ok) {
        setRows((p) => p.filter((x) => x.id !== r.id));
        setSaved("Content deactivated.");
      } else {
        setPageError("Could not deactivate content.");
      }
    } catch {
      setPageError("Cannot reach the server. Nothing was changed.");
    }
  };

  if (!ready) {
    return (
      <AdminLayout title="Homepage Content" subtitle="Website → Homepage">
        <LoadingState message="Loading homepage content…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Homepage Content" subtitle="Editable homepage headings and taglines">
      <AdminPageHeader
        title="Homepage Content Manager"
        description={`Edit homepage headings, taglines and CTA labels — ${rows.length} items`}
        actionLabel="Add Content"
        actionIcon={Plus}
        onAction={() => { setEditing(null); setKey(""); setValue(""); setType("text"); setFormError(null); setModal(true); }}
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
      {rows.length === 0 ? (
        <EmptyState title="No homepage content" desc="Add editable homepage text items." action={<Button variant="primary" size="sm" onClick={() => { setEditing(null); setKey(""); setValue(""); setType("text"); setFormError(null); setModal(true); }}>Add Content</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold tracking-widest text-muted uppercase">{r.key}</p>
                  <p className="mt-1 truncate text-[13px] font-extrabold text-navy-700">{r.value}</p>
                  <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${r.type === "url" ? "border-teal-200 bg-teal-50 text-teal-700" : "border-silver-200 bg-silver-50 text-muted"}`}>{r.type}</span>
                </div>
                <button onClick={() => toggleActive(r)} aria-label={`Toggle ${r.key}`} aria-pressed={r.isActive}>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${r.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-silver-200 bg-silver-50 text-muted"}`}>
                    {r.isActive ? "Active" : "Hidden"}
                  </span>
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  onClick={() => {
                    setEditing(r);
                    setKey(r.key);
                    setValue(r.value);
                    setType(r.type);
                    setFormError(null);
                    setModal(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-silver-300 px-2.5 py-1.5 text-[12px] font-bold text-navy-700 hover:border-teal-500"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button onClick={() => remove(r)} className="inline-flex items-center gap-1 rounded-lg border border-crimson-100 px-2.5 py-1.5 text-[12px] font-bold text-crimson hover:bg-crimson-50">
                  <Trash2 className="h-3.5 w-3.5" /> Deactivate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <AdminModal open={modal} title={editing ? "Edit Content" : "Add Content"} onClose={() => { setModal(false); setEditing(null); }}>
        <label className="block text-[12px] font-bold text-navy-700">
          Content key
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. hero.headline" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
          <p className="mt-1 text-[11px] text-muted">Used to look up the value on the public site.</p>
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Value
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. Neuron Academy — Shaheen Bagh" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Type
          <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500">
            <option value="text">Text</option>
            <option value="url">URL</option>
            <option value="html">HTML</option>
          </select>
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
