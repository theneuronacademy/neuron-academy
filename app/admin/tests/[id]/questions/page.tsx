"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { QuestionCard } from "@/components/admin/QuestionCard";
import { QuestionEditor } from "@/components/admin/QuestionEditor";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { Button } from "@/components/ui/primitives";
import { getQuestionById, getQuestions, updateQuestion, deleteQuestion, updateTest } from "@/lib/storage";
import { approveQuestion, blankQuestion, bulkApprove, bulkDelete, markReview } from "@/services/questionService";
import { getTestById } from "@/services/testService";
import { isDbLive } from "@/services/dbLive";
import { bankPatchToApi, dbQuestionToBank } from "@/services/dbQuestionMap";
import type { BankQuestion } from "@/lib/testTypes";
import type { QuestionFilter } from "@/services/questionService";
import { filterQuestions } from "@/services/questionService";

const FILTERS: Array<{ v: QuestionFilter; label: string }> = [
  { v: "all", label: "All" },
  { v: "approved", label: "Approved" },
  { v: "review", label: "Needs Review" },
  { v: "missing-answer", label: "Missing Answer" },
  { v: "high", label: "High Confidence" },
  { v: "low", label: "Low Confidence" },
];

export default function TestQuestionsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const ready = useAdminGuard();
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<QuestionFilter>("all");
  const [editing, setEditing] = useState<BankQuestion | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  // Phase 6: when this test exists in PostgreSQL, manage its questions via API.
  const [dbTitle, setDbTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      if (!(await isDbLive())) return;
      try {
        const res = await fetch(`/api/tests/${id}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (json?.success === true && json.data?.item?.id) setDbTitle(String(json.data.item.title ?? "Test"));
      } catch {
        /* stay local */
      }
    })();
  }, [ready, id]);

  useEffect(() => {
    const onUpd = () => setTick((t) => t + 1);
    window.addEventListener("neuron-test-updated", onUpd);
    return () => window.removeEventListener("neuron-test-updated", onUpd);
  }, []);

  const test = getTestById(id);
  const all = useMemo(() => {
    void tick;
    if (!test) return [] as BankQuestion[];
    return test.questionIds.map((qid) => getQuestionById(qid)).filter((q): q is BankQuestion => !!q);
  }, [test?.questionIds.join(","), test?.updatedAt, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = filterQuestions(all, filter, search);
  const high = all.filter((q) => !q.needsReview).length;

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;
  if (dbTitle) return <DbQuestionsManager testId={id} testTitle={dbTitle} />;
  if (!test) {
    return (
      <AdminLayout title="Questions">
        <p className="rounded-card bg-white p-6 text-sm font-bold text-muted">Test not found. <Link href="/admin/tests" className="text-teal-600 underline">Back to tests</Link></p>
      </AdminLayout>
    );
  }

  const bankOthers = getQuestions().filter((q) => !test.questionIds.includes(q.id) && q.status === "approved").slice(0, 5);

  return (
    <AdminLayout title={`Questions — ${test.name}`} subtitle={`${all.length} questions • ${high} high confidence • ${all.length - high} need review`}>
      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions…" aria-label="Search questions" className="min-w-[200px] flex-1 rounded-xl border border-silver-300 bg-white px-4 py-2 text-sm focus:border-teal-500 focus:outline-none sm:max-w-xs" />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.v} onClick={() => setFilter(f.v)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${filter === f.v ? "bg-navy-700 text-white" : "border border-silver-300 bg-white text-navy-700"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {checked.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 rounded-card border border-teal-100 bg-teal-50 p-3">
          <span className="text-sm font-bold text-teal-700">{checked.length} selected</span>
          <button onClick={() => { bulkApprove(checked); setChecked([]); setTick((t) => t + 1); }} className="rounded-lg bg-teal-600 px-3 py-1.5 text-[12px] font-bold text-white">Approve Selected</button>
          <button
            onClick={() => {
              if (window.confirm(`Delete ${checked.length} questions?`)) {
                const remaining = test.questionIds.filter((qid) => !checked.includes(qid));
                updateTest(id, { questionIds: remaining });
                bulkDelete(checked);
                setChecked([]);
                setTick((t) => t + 1);
              }
            }}
            className="rounded-lg bg-crimson px-3 py-1.5 text-[12px] font-bold text-white"
          >
            Delete Selected
          </button>
          <button onClick={() => setChecked([])} className="rounded-lg border border-silver-300 bg-white px-3 py-1.5 text-[12px] font-bold">Clear</button>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="mt-4 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">
          No questions match. Adjust filters or add approved questions from the bank below.
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          {visible.map((q, i) => (
            <QuestionCard
              key={q.id}
              q={q}
              index={i}
              selectable
              selected={checked.includes(q.id)}
              onToggleSelect={() => setChecked((c) => (c.includes(q.id) ? c.filter((x) => x !== q.id) : [...c, q.id]))}
              onEdit={() => setEditing(q)}
              onMoveUp={(() => {
                const pos = test.questionIds.indexOf(q.id);
                if (pos <= 0) return undefined;
                return () => {
                  const ids = [...test.questionIds];
                  [ids[pos - 1], ids[pos]] = [ids[pos], ids[pos - 1]];
                  updateTest(id, { questionIds: ids });
                  setTick((t) => t + 1);
                };
              })()}
              onMoveDown={(() => {
                const pos = test.questionIds.indexOf(q.id);
                if (pos < 0 || pos >= test.questionIds.length - 1) return undefined;
                return () => {
                  const ids = [...test.questionIds];
                  [ids[pos], ids[pos + 1]] = [ids[pos + 1], ids[pos]];
                  updateTest(id, { questionIds: ids });
                  setTick((t) => t + 1);
                };
              })()}
              onDelete={() => {
                if (window.confirm("Delete this question?")) {
                  updateTest(id, { questionIds: test.questionIds.filter((qid) => qid !== q.id) });
                  deleteQuestion(q.id);
                  setTick((t) => t + 1);
                }
              }}
              onApprove={() => {
                approveQuestion(q.id);
                setTick((t) => t + 1);
              }}
            />
          ))}
        </div>
      )}

      {bankOthers.length > 0 ? (
        <div className="mt-6 rounded-card border border-silver-200 bg-white p-4 shadow-card">
          <p className="text-sm font-extrabold text-navy-700">Add from Question Bank (approved)</p>
          <div className="mt-2 space-y-2">
            {bankOthers.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-3 rounded-xl bg-silver-50 px-3.5 py-2.5 text-[13px]">
                <span className="font-semibold text-ink">{q.question.slice(0, 80)}{q.question.length > 80 ? "…" : ""}</span>
                <button
                  onClick={() => {
                    updateTest(id, { questionIds: [...test.questionIds, q.id] });
                    setTick((t) => t + 1);
                  }}
                  className="shrink-0 rounded-lg bg-navy-700 px-3 py-1.5 text-[12px] font-bold text-white"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
          <Link href="/admin/question-bank" className="mt-2 inline-block text-[13px] font-bold text-teal-600 hover:underline">Open full Question Bank →</Link>
        </div>
      ) : null}

      <div className="sticky bottom-4 mt-6 flex flex-wrap gap-2 rounded-card border border-silver-200 bg-white/95 p-3 shadow-card backdrop-blur">
        <Button
          variant="outline"
          onClick={() => {
            // Toggle review flag demo: mark all unapproved as review
            all.filter((q) => q.status !== "approved").forEach((q) => markReview(q.id));
            setTick((t) => t + 1);
          }}
        >
          Mark All For Review
        </Button>
        <Link href={`/admin/tests/${id}/configure`} className="btn-metallic-sheen flex-1 rounded-xl bg-navy-700 px-5 py-2.5 text-center text-sm font-bold text-white hover:bg-navy-800">
          Continue → Configure Test
        </Link>
      </div>

      {editing ? (
        <QuestionEditor
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={(patch) => {
            updateQuestion(editing.id, patch);
            setEditing(null);
            setTick((t) => t + 1);
          }}
        />
      ) : null}
    </AdminLayout>
  );
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
