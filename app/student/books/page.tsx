"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, ExternalLink, Search } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { Skeleton } from "@/components/student/charts";
import { cn } from "@/lib/utils";

interface Book {
  id: string; title: string; description: string | null; author: string | null;
  subject: string | null; className: string | null; category: string | null;
  coverImageUrl: string | null; pdfUrl: string | null; externalUrl: string | null;
}

/** Phase 14 — study library (active books; scholarship sees ALL-visibility). */
export default function StudentBooksPage() {
  const session = useStudentGuard();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [search, setSearch] = useState("");
  const [classF, setClassF] = useState("all");
  const [subjectF, setSubjectF] = useState("all");
  const [catF, setCatF] = useState("all");

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const res = await fetch("/api/books", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        setBooks(res.ok && json?.success === true && Array.isArray(json.data?.items) ? json.data.items : []);
      } catch {
        setBooks([]);
      }
    })();
  }, [session]);

  const classes = useMemo(() => ["all", ...Array.from(new Set((books ?? []).map((b) => b.className).filter(Boolean) as string[]))], [books]);
  const subjects = useMemo(() => ["all", ...Array.from(new Set((books ?? []).map((b) => b.subject).filter(Boolean) as string[]))], [books]);
  const cats = useMemo(() => ["all", ...Array.from(new Set((books ?? []).map((b) => b.category).filter(Boolean) as string[]))], [books]);

  const filtered = (books ?? []).filter(
    (b) =>
      (classF === "all" || b.className === classF) &&
      (subjectF === "all" || b.subject === subjectF) &&
      (catF === "all" || b.category === catF) &&
      (!search.trim() || `${b.title} ${b.author ?? ""}`.toLowerCase().includes(search.toLowerCase()))
  );

  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  const sel = "rounded-xl border border-silver-300 bg-white px-3 py-2 text-[13px] font-bold text-navy-700 focus:border-teal-500 focus:outline-none";

  return (
    <StudentShell title="Books" subtitle="Study material library">
      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-52 flex-1 items-center gap-2 rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or author…" aria-label="Search books" className="w-full bg-transparent outline-none" />
        </label>
        <select value={classF} onChange={(e) => setClassF(e.target.value)} aria-label="Filter by class" className={sel}>
          {classes.map((c) => <option key={c} value={c}>{c === "all" ? "All classes" : c}</option>)}
        </select>
        <select value={subjectF} onChange={(e) => setSubjectF(e.target.value)} aria-label="Filter by subject" className={sel}>
          {subjects.map((c) => <option key={c} value={c}>{c === "all" ? "All subjects" : c}</option>)}
        </select>
        <select value={catF} onChange={(e) => setCatF(e.target.value)} aria-label="Filter by category" className={sel}>
          {cats.map((c) => <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>)}
        </select>
      </div>
      {books === null ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-56" /><Skeleton className="h-56" /><Skeleton className="h-56" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-4 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No books found. Try different filters.</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <article key={b.id} className="card-lift group flex flex-col overflow-hidden rounded-card border border-silver-200 bg-white shadow-card transition hover:-translate-y-1 hover:border-teal-400">
              <div className="relative h-36 bg-gradient-to-br from-navy-800 via-navy-700 to-teal-700">
                {b.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.coverImageUrl} alt={`${b.title} cover`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                ) : (
                  <span className="flex h-full items-center justify-center"><BookOpen className="h-10 w-10 text-white/70" /></span>
                )}
                {b.category ? <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-extrabold tracking-widest text-navy-700">{b.category.toUpperCase()}</span> : null}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-[15px] font-extrabold tracking-tight text-navy-700">{b.title}</h3>
                <p className="mt-0.5 text-[12px] font-bold text-muted">{[b.author, b.subject, b.className].filter(Boolean).join(" • ") || "Study material"}</p>
                {b.description ? <p className="mt-1.5 line-clamp-2 text-[13px] text-muted">{b.description}</p> : null}
                <div className="mt-3 grid gap-2 border-t border-silver-100 pt-3">
                  {b.pdfUrl ? (
                    <a href={b.pdfUrl} target="_blank" rel="noreferrer" className={cn("rounded-xl bg-navy-700 px-4 py-2 text-center text-[13px] font-bold text-white transition hover:bg-teal-600")}>
                      {b.externalUrl ? "Read Book" : "Open PDF"}
                    </a>
                  ) : null}
                  {b.externalUrl ? (
                    <a href={b.externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 rounded-xl border border-silver-300 px-4 py-2 text-center text-[13px] font-bold text-navy-700 transition hover:border-teal-500">
                      <ExternalLink className="h-3.5 w-3.5" /> External Resource
                    </a>
                  ) : null}
                  {!b.pdfUrl && !b.externalUrl ? <p className="text-center text-[12px] font-bold text-muted">Resource coming soon</p> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </StudentShell>
  );
}
