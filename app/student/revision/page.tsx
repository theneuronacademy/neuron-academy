"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";

interface BookmarkRow {
  id: string;
  note: string | null;
  createdAt: string;
  test: { id: string; title: string };
  question: {
    id: string;
    questionText: string;
    correctAnswer: string | null;
    explanation: string | null;
    marks: number;
    subject: string | null;
  };
}

export default function StudentRevisionPage() {
  const session = useStudentGuard();
  const [items, setItems] = useState<BookmarkRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/bookmarks", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      setItems(res.ok && json?.success === true && Array.isArray(json.data?.items) ? json.data.items : []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    if (session) void load();
  }, [session]);

  const groups = useMemo(() => {
    const map = new Map<string, { title: string; testId: string; rows: BookmarkRow[] }>();
    for (const b of items ?? []) {
      const g = map.get(b.test.id) ?? { title: b.test.title, testId: b.test.id, rows: [] };
      g.rows.push(b);
      map.set(b.test.id, g);
    }
    return [...map.values()];
  }, [items]);

  async function remove(questionId: string) {
    setBusy(true);
    try {
      await fetch(`/api/bookmarks?questionId=${encodeURIComponent(questionId)}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  return (
    <StudentShell title="Revision" subtitle="Questions you bookmarked to revise later">
      {items === null ? (
        <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading bookmarks…</p>
      ) : groups.length === 0 ? (
        <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">
          Nothing bookmarked yet. Open any result review and tap “Revise later” on tricky questions.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.testId} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
              <p className="text-[14px] font-extrabold text-navy-700">
                {g.title} <span className="ml-1 rounded-full bg-navy-50 px-2 py-0.5 text-[11px] text-navy-700">{g.rows.length}</span>
              </p>
              <ul className="mt-2 space-y-3">
                {g.rows.map((b) => (
                  <li key={b.id} className="rounded-xl bg-silver-50 px-3 py-2.5">
                    <p className="text-[13px] font-semibold text-navy-700">{b.question.questionText}</p>
                    <p className="mt-1 text-[12px] font-bold text-teal-700">
                      Answer: {b.question.correctAnswer ?? "—"}
                      <span className="ml-2 font-semibold text-muted">({b.question.marks} marks{b.question.subject ? ` · ${b.question.subject}` : ""})</span>
                    </p>
                    {b.question.explanation ? <p className="mt-1 text-[12px] text-navy-700">💡 {b.question.explanation}</p> : null}
                    {b.note ? <p className="mt-1 text-[12px] italic text-muted">“{b.note}”</p> : null}
                    <div className="mt-1.5 flex gap-3">
                      <Link href={`/student/tests/${g.testId}/result`} className="text-[12px] font-bold text-teal-700 underline">Open review</Link>
                      <button onClick={() => remove(b.question.id)} disabled={busy} className="text-[12px] font-bold text-crimson-600 underline disabled:opacity-50">
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </StudentShell>
  );
}
