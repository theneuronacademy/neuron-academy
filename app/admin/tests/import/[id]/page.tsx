"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Pencil, X, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { cn } from "@/lib/utils";

type Filter = "all" | "high" | "review" | "missing-answer" | "approved" | "rejected";

interface Candidate {
  id: string;
  questionText: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  optionE: string | null;
  correctAnswer: string | null;
  marks: number;
  negativeMarks: number;
  explanation: string | null;
  subject: string | null;
  sourcePage: number | null;
  confidence: string | null;
  reviewStatus: string;
  order: number;
}

const FILTERS: { v: Filter; label: string }[] = [
  { v: "all", label: "All" },
  { v: "high", label: "High Confidence" },
  { v: "review", label: "Needs Review" },
  { v: "missing-answer", label: "Missing Answer" },
  { v: "approved", label: "Approved" },
  { v: "rejected", label: "Rejected" },
];

function needsReview(c: Candidate): boolean {
  return c.confidence !== "HIGH" || !c.correctAnswer;
}

export default function ImportReviewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const ready = useAdminGuard();
  const [rows, setRows] = useState<Candidate[]>([]);
  const [filename, setFilename] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [checked, setChecked] = useState<string[]>([]);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dRes, qRes] = await Promise.all([
        fetch(`/api/tests/import/${id}`, { cache: "no-store" }),
        fetch(`/api/tests/import/${id}/questions`, { cache: "no-store" }),
      ]);
      const dJson = await dRes.json().catch(() => null);
      const qJson = await qRes.json().catch(() => null);
      if (!dRes.ok || !dJson?.success) {
        setLoadError(dJson?.error ?? "Import not found.");
        setLoaded(true);
        return;
      }
      setFilename(String(dJson.data?.item?.filename ?? ""));
      if (qRes.ok && qJson?.success === true && Array.isArray(qJson.data?.items)) {
        setRows(qJson.data.items);
      }
    } catch {
      setLoadError("Cannot reach the server.");
    } finally {
      setLoaded(true);
    }
  }, [id]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const visible = useMemo(() => {
    switch (filter) {
      case "high":
        return rows.filter((q) => q.confidence === "HIGH" && q.reviewStatus === "PENDING");
      case "review":
        return rows.filter((q) => q.reviewStatus === "PENDING" && needsReview(q));
      case "missing-answer":
        return rows.filter((q) => q.reviewStatus === "PENDING" && !q.correctAnswer);
      case "approved":
        return rows.filter((q) => q.reviewStatus === "APPROVED");
      case "rejected":
        return rows.filter((q) => q.reviewStatus === "REJECTED");
      default:
        return rows;
    }
  }, [rows, filter]);

  const counts = useMemo(() => ({
    total: rows.length,
    high: rows.filter((q) => q.confidence === "HIGH").length,
    review: rows.filter((q) => q.reviewStatus === "PENDING" && needsReview(q)).length,
    missing: rows.filter((q) => !q.correctAnswer).length,
    approved: rows.filter((q) => q.reviewStatus === "APPROVED").length,
    rejected: rows.filter((q) => q.reviewStatus === "REJECTED").length,
  }), [rows]);

  const mutate = async (path: string, body: unknown, confirmMsg?: string) => {
    // Phase 17 — bulk approve/reject changes the question pool; confirm first.
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        window.alert(json?.error ?? "Action failed.");
        return;
      }
      setChecked([]);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!ready || !loaded) {
    return (
      <AdminLayout title="Import Review" subtitle={filename || "Loading…"}>
        <p className="rounded-card bg-white p-8 text-center text-sm font-bold text-muted">Loading candidates…</p>
      </AdminLayout>
    );
  }
  if (loadError) {
    return (
      <AdminLayout title="Import Review" subtitle="Error">
        <p className="rounded-card bg-white p-8 text-center text-sm font-bold text-crimson">{loadError}</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Import Review" subtitle={`${filename} • ${counts.approved} approved • ${counts.rejected} rejected`}>
      <div className="grid gap-3 rounded-card border border-silver-200 bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-6">
        {(
          [
            ["Detected", counts.total],
            ["High", counts.high],
            ["Needs review", counts.review],
            ["Missing answer", counts.missing],
            ["Approved", counts.approved],
            ["Rejected", counts.rejected],
          ] as [string, number][]
        ).map(([l, v]) => (
          <div key={l} className="rounded-xl bg-silver-50/60 px-3 py-2 text-center">
            <p className="text-xl font-extrabold text-navy-700">{v}</p>
            <p className="text-[11px] font-bold tracking-widest text-muted">{l.toUpperCase()}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.v} onClick={() => setFilter(f.v)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${filter === f.v ? "bg-navy-700 text-white" : "border border-silver-300 bg-white text-navy-700"}`}>
            {f.label}
          </button>
        ))}
        <span className="ml-auto flex gap-2">
          <button disabled={busy} onClick={() => mutate(`/api/tests/import/${id}/approve`, { approveHigh: true }, "Approve ALL high-confidence questions into the pool?")} className="rounded-lg bg-teal-600 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">Approve all high-confidence</button>
          <button disabled={busy} onClick={() => mutate(`/api/tests/import/${id}/reject`, { rejectLow: true }, "Reject ALL low-confidence questions? This cannot be undone.")} className="rounded-lg bg-crimson px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">Reject all low-confidence</button>
        </span>
      </div>

      {checked.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-card border border-teal-100 bg-teal-50 p-3">
          <span className="text-sm font-bold text-teal-700">{checked.length} selected</span>
          <button disabled={busy} onClick={() => mutate(`/api/tests/import/${id}/approve`, { ids: checked })} className="rounded-lg bg-teal-600 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">Approve Selected</button>
          <button disabled={busy} onClick={() => mutate(`/api/tests/import/${id}/reject`, { ids: checked })} className="rounded-lg bg-crimson px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">Reject Selected</button>
          <button onClick={() => setChecked([])} className="rounded-lg border border-silver-300 bg-white px-3 py-1.5 text-[12px] font-bold">Clear</button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4">
        {visible.map((q, i) => {
          const opts = [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE];
          return (
            <article key={q.id} className={cn("rounded-card border bg-white p-4 shadow-card sm:p-5", checked.includes(q.id) ? "border-teal-500 ring-2 ring-teal-500/20" : "border-silver-200")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={checked.includes(q.id)} onChange={() => setChecked((c) => (c.includes(q.id) ? c.filter((x) => x !== q.id) : [...c, q.id]))} aria-label={`Select question ${i + 1}`} className="mt-1 h-4 w-4 accent-[#008C9E]" />
                  <div>
                    <p className="text-[11px] font-bold tracking-widest text-muted">
                      Q{i + 1} • PAGE {q.sourcePage ?? "?"} • {q.confidence ?? "?"} CONFIDENCE • {q.reviewStatus}
                    </p>
                    <h4 className="mt-1 text-[15px] font-extrabold leading-snug text-navy-700">{q.questionText}</h4>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => setEditing(q)} aria-label="Edit question" className="flex h-10 w-10 items-center justify-center rounded-lg border border-silver-300 text-navy-700 hover:border-teal-500 sm:h-8 sm:w-8"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => mutate(`/api/tests/import/${id}/approve`, { ids: [q.id] })} aria-label="Approve question" title="Approve" className="rounded-lg border border-teal-100 bg-teal-50 p-2 text-teal-700 hover:bg-teal-100"><CheckCircle2 className="h-4 w-4" /></button>
                  <button onClick={() => mutate(`/api/tests/import/${id}/reject`, { ids: [q.id] })} aria-label="Reject question" title="Reject" className="flex h-10 w-10 items-center justify-center rounded-lg border border-crimson-100 text-crimson hover:bg-crimson-50 sm:h-8 sm:w-8"><XCircle className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-3 grid gap-1.5">
                {opts.map((o, oi) => (
                  o == null || o === "" ? null : (
                    <p key={oi} className={cn("rounded-lg border px-3 py-2 text-[13px] font-semibold", q.correctAnswer === "ABCDE"[oi] ? "border-teal-500 bg-teal-50 text-navy-700" : "border-silver-200 bg-silver-50/60 text-ink")}>
                      <span className="mr-2 font-extrabold">{"ABCDE"[oi]}.</span> {o}
                      {q.correctAnswer === "ABCDE"[oi] ? <span className="ml-2 text-[11px] font-bold text-teal-700">✓ Detected answer</span> : null}
                    </p>
                  )
                ))}
              </div>
              {!q.correctAnswer ? (
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                  <AlertTriangle className="h-3 w-3" /> Answer not detected — select it manually before approval
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
      {visible.length === 0 ? (
        <p className="mt-4 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">Nothing matches this filter.</p>
      ) : null}

      <div className="sticky bottom-4 mt-6 flex flex-wrap gap-2 rounded-card border border-silver-200 bg-white/95 p-3 shadow-card backdrop-blur">
        <Link href={`/admin/tests/generate?source=${id}`} className="btn-metallic-sheen flex-1 rounded-xl bg-navy-700 px-5 py-2.5 text-center text-sm font-bold text-white hover:bg-navy-800">
          Continue → Generate Test From Pool
        </Link>
      </div>

      {editing ? <CandidateEditor initial={editing} onCancel={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} importId={id} /> : null}
    </AdminLayout>
  );
}

function CandidateEditor({ initial, importId, onCancel, onSaved }: { initial: Candidate; importId: string; onCancel: () => void; onSaved: () => void }) {
  const [text, setText] = useState(initial.questionText);
  const [opts, setOpts] = useState<string[]>([initial.optionA ?? "", initial.optionB ?? "", initial.optionC ?? "", initial.optionD ?? "", initial.optionE ?? ""]);
  const [ans, setAns] = useState(initial.correctAnswer ?? "");
  const [marks, setMarks] = useState(initial.marks);
  const [neg, setNeg] = useState(initial.negativeMarks);
  const [expl, setExpl] = useState(initial.explanation ?? "");
  const [subject, setSubject] = useState(initial.subject ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputCls = "w-full rounded-xl border border-silver-300 bg-white px-3.5 py-2 text-sm focus:border-teal-500 focus:outline-none";
  const labelCls = "mb-1 block text-[11px] font-bold tracking-wide text-navy-700";

  const save = async () => {
    setError(null);
    if (!text.trim()) {
      setError("Question text is required.");
      return;
    }
    const filled = opts.map((o) => o.trim());
    if (filled.filter(Boolean).length < 2) {
      setError("At least 2 non-empty options are required.");
      return;
    }
    if (ans && !["A", "B", "C", "D", "E"].includes(ans)) {
      setError("Answer must be A–E.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/tests/import/${importId}/questions/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: text.trim(),
          optionA: filled[0],
          optionB: filled[1],
          optionC: filled[2],
          optionD: filled[3],
          optionE: filled[4] || null,
          correctAnswer: ans || null,
          marks: Number.isFinite(marks) && marks > 0 ? marks : 1,
          negativeMarks: Number.isFinite(neg) && neg >= 0 ? neg : 0,
          explanation: expl.trim(),
          subject: subject.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error ?? "Save failed.");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-navy-800/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Edit imported question">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-card bg-white p-5 shadow-card-hover">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-extrabold text-navy-700">Edit Candidate (stays pending until approved)</h3>
          <button onClick={onCancel} aria-label="Close editor" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-silver-100 sm:h-8 sm:w-8"><X className="h-4 w-4" /></button>
        </div>
        {error ? <p className="mt-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
        <div className="mt-3 grid gap-3">
          <label className="block text-[12px] font-bold text-navy-700">Question text
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={`${inputCls} mt-1.5`} />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {opts.map((o, i) => (
              <label key={i} className="block text-[12px] font-bold text-navy-700">Option {"ABCDE"[i]}
                <input value={o} onChange={(e) => setOpts((s) => s.map((x, j) => (j === i ? e.target.value : x)))} className={`${inputCls} mt-1.5`} />
              </label>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block text-[12px] font-bold text-navy-700">Correct answer
              <select value={ans} onChange={(e) => setAns(e.target.value)} className={`${inputCls} mt-1.5`}>
                <option value="">Not detected — pick manually</option>
                {["A", "B", "C", "D", "E"].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label className="block text-[12px] font-bold text-navy-700">Marks
              <input type="number" min={0.5} step={0.5} value={marks} onChange={(e) => setMarks(Number(e.target.value))} className={`${inputCls} mt-1.5`} />
            </label>
            <label className="block text-[12px] font-bold text-navy-700">Negative marks
              <input type="number" min={0} step={0.25} value={neg} onChange={(e) => setNeg(Number(e.target.value))} className={`${inputCls} mt-1.5`} />
            </label>
          </div>
          <label className="block text-[12px] font-bold text-navy-700">Explanation (optional)
            <textarea value={expl} onChange={(e) => setExpl(e.target.value)} rows={2} className={`${inputCls} mt-1.5`} />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">Subject (optional)
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Physics" className={`${inputCls} mt-1.5`} />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-bold text-navy-700 hover:bg-silver-100">Cancel</button>
          <button onClick={save} disabled={busy} className="rounded-xl bg-crimson px-5 py-2 text-sm font-bold text-white hover:bg-crimson-bright disabled:opacity-50">
            {busy ? "Saving…" : "Save (stays pending)"}
          </button>
        </div>
        <p className={labelCls}>Source page reference is preserved automatically.</p>
      </div>
    </div>
  );
}
