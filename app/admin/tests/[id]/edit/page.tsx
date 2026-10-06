"use client";

// C5 canonicalization — test meta edits run through PATCH /api/tests/[id].
// Statuses are the server enum (DRAFT/SCHEDULED/PUBLISHED/LIVE/COMPLETED);
// the publish safety gate stays server-side.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { Button } from "@/components/ui/primitives";

const inputCls = "w-full rounded-xl border border-silver-300 bg-white px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none";
const labelCls = "mb-1.5 block text-[12px] font-bold tracking-wide text-navy-700";

const STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "LIVE", "COMPLETED"] as const;

function toInputDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

export default function EditTestPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const ready = useAdminGuard();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState<string>("DRAFT");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const res = await fetch(`/api/tests/${id}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const t = json?.success === true ? json.data?.item : null;
        if (!t) {
          setMissing(true);
          return;
        }
        setTitle(String(t.title ?? ""));
        setName(String(t.title ?? ""));
        setDesc(String(t.description ?? ""));
        setStatus(typeof t.status === "string" ? t.status : "DRAFT");
        setStartAt(toInputDate(t.startTime ?? null));
        setEndAt(toInputDate(t.endTime ?? null));
      } catch {
        setMissing(true);
      } finally {
        setLoaded(true);
      }
    })();
  }, [ready, id]);

  async function save() {
    setError(null);
    try {
      const res = await fetch(`/api/tests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: name.trim() || title,
          description: desc,
          status,
          startTime: startAt || null,
          endTime: endAt || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setError(json?.error ?? "Save failed.");
        return;
      }
      setSaved(true);
      setTimeout(() => router.push("/admin/tests"), 900);
    } catch {
      setError("Cannot reach the server.");
    }
  }

  if (!ready || !loaded) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;
  if (missing) {
    return (
      <AdminLayout title="Edit Test">
        <p className="rounded-card bg-white p-6 text-sm font-bold text-muted">Test not found. <Link href="/admin/tests" className="text-teal-600 underline">Back</Link></p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`Edit — ${title}`} subtitle="Meta + scheduling (questions live under Question Review)">
      {saved ? <p className="mb-4 rounded-xl bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-700" role="status">Saved.</p> : null}
      {error ? <p className="mb-4 rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
      <div className="max-w-xl space-y-3 rounded-card border border-silver-200 bg-white p-5 shadow-card">
        <div><label className={labelCls} htmlFor="et-name">Test Name</label><input id="et-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className={labelCls} htmlFor="et-desc">Description</label><textarea id="et-desc" rows={3} className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <div>
          <label className={labelCls} htmlFor="et-status">Status</label>
          <select id="et-status" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls} htmlFor="et-start">Start</label><input id="et-start" type="datetime-local" className={inputCls} value={startAt} onChange={(e) => setStartAt(e.target.value)} /></div>
          <div><label className={labelCls} htmlFor="et-end">End</label><input id="et-end" type="datetime-local" className={inputCls} value={endAt} onChange={(e) => setEndAt(e.target.value)} /></div>
        </div>
        <Button onClick={() => void save()}>Save Changes</Button>
        <Link href={`/admin/tests/${id}/questions`} className="block text-center text-[13px] font-bold text-teal-600 hover:underline">Manage questions →</Link>
      </div>
    </AdminLayout>
  );
}
