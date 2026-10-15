"use client";

import { useEffect, useMemo, useState } from "react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { cn } from "@/lib/utils";

interface Material {
  id: string;
  title: string;
  subject: string | null;
  kind: "NOTE" | "VIDEO" | "LINK" | "PDF";
  url: string | null;
  description: string | null;
}

const KIND_TONE: Record<string, string> = {
  NOTE: "bg-navy-50 text-navy-700",
  VIDEO: "bg-crimson-50 text-crimson-600",
  LINK: "bg-teal-50 text-teal-700",
  PDF: "bg-amber-50 text-amber-700",
};

export default function StudentMaterialsPage() {
  const session = useStudentGuard();
  const [items, setItems] = useState<Material[] | null>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const res = await fetch("/api/materials", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        setItems(res.ok && json?.success === true && Array.isArray(json.data?.items) ? json.data.items : []);
      } catch {
        setItems([]);
      }
    })();
  }, [session]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (items ?? []).filter(
      (m) =>
        (!kind || m.kind === kind) &&
        (!s || `${m.title} ${m.subject ?? ""} ${m.description ?? ""}`.toLowerCase().includes(s))
    );
  }, [items, search, kind]);

  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  return (
    <StudentShell title="Study Material" subtitle="Notes, videos and links curated by your academy">
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, subject…" className="min-w-[200px] flex-1 rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500" />
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-[13px] font-bold text-navy-700">
          <option value="">All types</option>
          <option value="NOTE">Notes</option>
          <option value="VIDEO">Videos</option>
          <option value="LINK">Links</option>
          <option value="PDF">PDFs</option>
        </select>
      </div>
      {items === null ? (
        <p className="mt-3 rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading material…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-3 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No study material found.</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {filtered.map((m) => (
            <div key={m.id} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-extrabold", KIND_TONE[m.kind] ?? KIND_TONE.NOTE)}>{m.kind}</span>
              <p className="mt-2 text-[15px] font-extrabold text-navy-700">{m.title}</p>
              {m.subject ? <p className="text-[12px] font-bold text-muted">{m.subject}</p> : null}
              {m.description ? <p className="mt-1 text-[13px] text-navy-700">{m.description}</p> : null}
              {m.url ? (
                <a href={m.url} target="_blank" rel="noreferrer" className="mt-2 inline-block rounded-xl bg-navy-700 px-4 py-2 text-[13px] font-bold text-white hover:bg-navy-800">
                  Open {m.kind === "VIDEO" ? "Video" : "Resource"} →
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </StudentShell>
  );
}
