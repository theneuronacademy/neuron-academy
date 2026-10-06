"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { QuestionCard } from "@/components/admin/QuestionCard";
import { QuestionEditor } from "@/components/admin/QuestionEditor";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { LETTERS, blankQuestion, dbQuestionToBank } from "@/services/dbQuestionMap";
import type { BankQuestion } from "@/lib/testTypes";

interface DbTest {
  id: string;
  title: string;
}

export default function QuestionBankPage() {
  const ready = useAdminGuard();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<BankQuestion | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [targetTest, setTargetTest] = useState("");
  // C4 canonicalization — the bank is API-backed ONLY. The legacy local
  // branch is removed; an unreachable API is reported honestly.
  const [dbRows, setDbRows] = useState<BankQuestion[]>([]);
  const [dbTests, setDbTests] = useState<DbTest[]>([]);
  const [dbTestFilter, setDbTestFilter] = useState("all");
  const [newTestId, setNewTestId] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const [qRes, tRes] = await Promise.all([fetch("/api/questions", { cache: "no-store" }), fetch("/api/tests", { cache: "no-store" })]);
        const qJson = await qRes.json().catch(() => null);
        const tJson = await tRes.json().catch(() => null);
        if (qJson?.success !== true || qJson?.data?.source !== "database") {
          setFailed(true);
          return;
        }
        const tests: DbTest[] = Array.isArray(tJson?.data?.items) ? tJson.data.items.map((t: { id: string; title: string }) => ({ id: String(t.id), title: String(t.title) })) : [];
        const titleOf = (testId: string) => tests.find((t) => t.id === testId)?.title ?? "Database";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setDbRows(qJson.data.items.map((r: any) => dbQuestionToBank(r, titleOf(String(r.testId)))));
        setDbTests(tests);
      } catch {
        setFailed(true);
      }
    })();
  }, [ready]);

  async function refreshDb() {
    try {
      const res = await fetch("/api/questions", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (json?.success === true && Array.isArray(json.data?.items)) {
        const titleOf = (testId: string) => dbTests.find((t) => t.id === testId)?.title ?? "Database";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setDbRows(json.data.items.map((r: any) => dbQuestionToBank(r, titleOf(String(r.testId)))));
      }
    } catch {
      /* ignore */
    }
  }

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  if (failed) {
    return (
      <AdminLayout title="Question Bank">
        <p className="rounded-card bg-white p-6 text-sm font-bold text-muted">
          Question bank unavailable — check the database connection.
        </p>
      </AdminLayout>
    );
  }

  const visible = dbRows.filter(
    (q) =>
      (dbTestFilter === "all" || q.chapter === dbTests.find((t) => t.id === dbTestFilter)?.title) &&
      (!search.trim() || `${q.question}`.toLowerCase().includes(search.toLowerCase()))
  );
  return (
      <AdminLayout title="Question Bank" subtitle={`${dbRows.length} database questions • API-primary (live)`}>
        <p className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-2.5 text-[13px] font-bold text-teal-700">
          Database live — edits save to PostgreSQL. Local demo bank is bypassed while connected.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question text…" aria-label="Search questions" className="min-w-[180px] flex-1 rounded-xl border border-silver-300 bg-white px-4 py-2 text-sm focus:border-teal-500 focus:outline-none sm:max-w-xs" />
          <select value={dbTestFilter} onChange={(e) => setDbTestFilter(e.target.value)} aria-label="Filter by test" className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm">
            <option value="all">All Tests</option>
            {dbTests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <select value={newTestId} onChange={(e) => setNewTestId(e.target.value)} aria-label="Target test for new question" className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm">
            <option value="">New in test…</option>
            {dbTests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <button
            onClick={() => {
              if (!newTestId) {
                window.alert("Pick the test for the new question first.");
                return;
              }
              const b = { ...blankQuestion(), chapter: dbTests.find((t) => t.id === newTestId)?.title ?? "Database", subject: "Database", sourceFile: "database" };
              setEditing(b);
            }}
            className="rounded-xl bg-crimson px-4 py-2 text-sm font-bold text-white hover:bg-crimson-bright"
          >
            + New Question
          </button>
        </div>
        {checked.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-card border border-teal-100 bg-teal-50 p-3">
            <span className="text-sm font-bold text-teal-700">{checked.length} selected</span>
            <input value={targetTest} onChange={(e) => setTargetTest(e.target.value)} placeholder="Target test ID…" aria-label="Target test ID" className="rounded-lg border border-silver-300 px-3 py-1.5 text-[12px]" />
            <button
              onClick={async () => {
                if (!targetTest.trim()) return;
                try {
                  const existingRes = await fetch(`/api/questions?testId=${encodeURIComponent(targetTest.trim())}`, { cache: "no-store" });
                  const existingJson = await existingRes.json().catch(() => null);
                  const existingTexts = new Set(
                    Array.isArray(existingJson?.data?.items) ? existingJson.data.items.map((q: { questionText?: string }) => String(q.questionText ?? "").trim()) : []
                  );
                  let copied = 0;
                  let skipped = 0;
                  for (const id of checked) {
                    const q = dbRows.find((x) => x.id === id);
                    if (!q) continue;
                    if (existingTexts.has(q.question.trim())) {
                      skipped += 1;
                      continue; // no duplicate records for the same question
                    }
                    const res = await fetch("/api/questions", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        testId: targetTest.trim(),
                        questionText: q.question,
                        optionA: q.options[0],
                        optionB: q.options[1],
                        optionC: q.options[2],
                        optionD: q.options[3],
                        ...(q.options[4] !== undefined ? { optionE: q.options[4] } : {}),
                        correctAnswer: q.correctAnswer === null ? null : LETTERS[q.correctAnswer],
                        marks: q.marks,
                        negativeMarks: q.negativeMarks,
                        explanation: q.explanation,
                      }),
                    });
                    if (res.ok) {
                      copied += 1;
                      existingTexts.add(q.question.trim());
                    }
                  }
                  setChecked([]);
                  setTargetTest("");
                  await refreshDb();
                  window.alert(`Copied ${copied} question(s)${skipped ? `, skipped ${skipped} duplicate(s)` : ""}.`);
                } catch {
                  window.alert("Copy failed — check the database connection.");
                }
              }}
              className="rounded-lg bg-navy-700 px-3 py-1.5 text-[12px] font-bold text-white"
            >
              Copy Selected To Test
            </button>
            <button
              onClick={async () => {
                if (!window.confirm(`Delete ${checked.length} questions from the database?`)) return;
                for (const id of checked) {
                  try {
                    await fetch(`/api/questions/${id}`, { method: "DELETE" });
                  } catch {
                    /* continue */
                  }
                }
                setChecked([]);
                await refreshDb();
              }}
              className="rounded-lg bg-crimson px-3 py-1.5 text-[12px] font-bold text-white"
            >
              Delete Selected
            </button>
          </div>
        ) : null}
        {visible.length === 0 ? (
          <div className="mt-4 rounded-card border border-dashed border-silver-300 bg-white p-10 text-center">
            <p className="text-lg font-extrabold text-navy-700">No database questions yet.</p>
            <p className="mt-1 text-sm text-muted">Pick a test above and add the first question.</p>
          </div>
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
                onDelete={async () => {
                  if (!window.confirm("Delete this question from the database?")) return;
                  try {
                    await fetch(`/api/questions/${q.id}`, { method: "DELETE" });
                    await refreshDb();
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
            onCancel={() => setEditing(null)}
            onSave={async (patch) => {
              try {
                const body = {
                  questionText: patch.question,
                  optionA: patch.options?.[0],
                  optionB: patch.options?.[1],
                  optionC: patch.options?.[2],
                  optionD: patch.options?.[3],
                  ...(patch.options?.[4] !== undefined ? { optionE: patch.options[4] } : {}),
                  correctAnswer: patch.correctAnswer === null || patch.correctAnswer === undefined ? null : LETTERS[patch.correctAnswer],
                  explanation: patch.explanation,
                  marks: patch.marks,
                  negativeMarks: patch.negativeMarks,
                };
                const isNew = !dbRows.some((x) => x.id === editing.id);
                const res = isNew
                  ? await fetch("/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, testId: newTestId }) })
                  : await fetch(`/api/questions/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                if (!res.ok) {
                  window.alert("Save failed — check required fields.");
                  return;
                }
                setEditing(null);
                await refreshDb();
              } catch {
                window.alert("Save failed — check the database connection.");
              }
            }}
          />
        ) : null}
      </AdminLayout>
    );
}
