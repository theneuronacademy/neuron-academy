"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { QuestionCard } from "@/components/admin/QuestionCard";
import { QuestionEditor } from "@/components/admin/QuestionEditor";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { bankPatchToApi, dbQuestionToBank } from "@/services/dbQuestionMap";
import { blankQuestion } from "@/services/questionService";
import type { BankQuestion } from "@/lib/testTypes";

export default function TestQuestionsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const ready = useAdminGuard();
  // C4 canonicalization — per-test questions are API-managed ONLY. The
  // legacy localStorage branch is removed; a test unknown to the API is
  // honestly reported instead of edited locally.
  const [dbTitle, setDbTitle] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const res = await fetch(`/api/tests/${id}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (json?.success === true && json.data?.item?.id) {
          setDbTitle(String(json.data.item.title ?? "Test"));
        }
      } catch {
        /* honestly unavailable below */
      } finally {
        setChecked(true);
      }
    })();
  }, [ready, id]);

  if (!ready || !checked)
    return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;
  if (!dbTitle) {
    return (
      <AdminLayout title="Questions">
        <p className="rounded-card bg-white p-6 text-sm font-bold text-muted">
          Test not found. <Link href="/admin/tests" className="text-teal-600 underline">Back to tests</Link>
        </p>
      </AdminLayout>
    );
  }
  return <DbQuestionsManager testId={id} testTitle={dbTitle} />;
}

// Phase 6 — API-backed per-test question manager (used only when this test
// exists in PostgreSQL). Same cards/editor, CRUD + reorder via /api/questions.
function DbQuestionsManager({ testId, testTitle }: { testId: string; testTitle: string }) {
  const [rows, setRows] = useState<BankQuestion[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<BankQuestion | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/questions?testId=${encodeURIComponent(testId)}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (json?.success === true && Array.isArray(json.data?.items)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setRows(json.data.items.map((r: any) => dbQuestionToBank(r, testTitle)));
      }
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  async function swap(a: BankQuestion, b: BankQuestion) {
    const orderA = rows.indexOf(a);
    const orderB = rows.indexOf(b);
    try {
      await Promise.all([
        fetch(`/api/questions/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: orderB }) }),
        fetch(`/api/questions/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: orderA }) }),
      ]);
      await load();
    } catch {
      window.alert("Reorder failed.");
    }
  }

  const visible = rows.filter((q) => !search.trim() || q.question.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout title={`Questions — ${testTitle}`} subtitle={`${rows.length} database questions • API-managed`}>
      <p className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-2.5 text-[13px] font-bold text-teal-700">
        Database live — questions belong to this test and save to PostgreSQL.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions…" aria-label="Search questions" className="min-w-[200px] flex-1 rounded-xl border border-silver-300 bg-white px-4 py-2 text-sm focus:border-teal-500 focus:outline-none sm:max-w-xs" />
        <button
          onClick={() => {
            setEditing({ ...blankQuestion(), subject: "Database", chapter: testTitle, sourceFile: "database" });
            setIsNew(true);
          }}
          className="rounded-xl bg-crimson px-4 py-2 text-sm font-bold text-white hover:bg-crimson-bright"
        >
          + Add Question
        </button>
        <Link href={`/admin/tests/${testId}/configure`} className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800">
          Continue → Configure Test
        </Link>
      </div>
      {!loaded ? (
        <p className="mt-4 rounded-card bg-white p-8 text-center text-sm font-bold text-muted">Loading database questions…</p>
      ) : visible.length === 0 ? (
        <p className="mt-4 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">
          No questions yet. Add the first question above.
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          {visible.map((q, i) => (
            <QuestionCard
              key={q.id}
              q={q}
              index={i}
              onEdit={() => {
                setEditing(q);
                setIsNew(false);
              }}
              onMoveUp={i === 0 ? undefined : () => void swap(q, visible[i - 1])}
              onMoveDown={i === visible.length - 1 ? undefined : () => void swap(q, visible[i + 1])}
              onDelete={async () => {
                if (!window.confirm("Delete this question from the database?")) return;
                try {
                  await fetch(`/api/questions/${q.id}`, { method: "DELETE" });
                  await load();
                } catch {
                  window.alert("Delete failed.");
                }
              }}
              onApprove={() => undefined}
            />
          ))}
        </div>
      )}
      {editing ? (
        <QuestionEditor
          initial={editing}
          onCancel={() => {
            setEditing(null);
            setIsNew(false);
          }}
          onSave={async (patch) => {
            try {
              const res = isNew
                ? await fetch("/api/questions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ testId, questionText: patch.question ?? "", ...bankPatchToApi({ ...patch, question: undefined }) }),
                  })
                : await fetch(`/api/questions/${editing.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(bankPatchToApi(patch)),
                  });
              if (!res.ok) {
                window.alert("Save failed — check required fields.");
                return;
              }
              setEditing(null);
              setIsNew(false);
              await load();
            } catch {
              window.alert("Save failed — check the database connection.");
            }
          }}
        />
      ) : null}
    </AdminLayout>
  );
}
