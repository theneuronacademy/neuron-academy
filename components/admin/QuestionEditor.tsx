"use client";

import { useState } from "react";
import type { BankQuestion, Difficulty, QuestionStatus } from "@/lib/testTypes";
import { Button } from "@/components/ui/primitives";

const inputCls =
  "w-full rounded-xl border border-silver-300 bg-white px-3.5 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";
const labelCls = "mb-1 block text-[11px] font-bold tracking-wide text-navy-700";

export function QuestionEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: BankQuestion;
  onSave: (patch: Partial<BankQuestion>) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState(initial.question);
  const [opts, setOpts] = useState<string[]>([...initial.options]);
  const [ans, setAns] = useState<string>(initial.correctAnswer === null ? "" : String(initial.correctAnswer));
  const [expl, setExpl] = useState(initial.explanation);
  const [subject, setSubject] = useState(initial.subject);
  const [chapter, setChapter] = useState(initial.chapter);
  const [diff, setDiff] = useState<Difficulty>(initial.difficulty);
  const [marks, setMarks] = useState(initial.marks);
  const [neg, setNeg] = useState(initial.negativeMarks);
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [status, setStatus] = useState<QuestionStatus>(initial.status);
  const [img, setImg] = useState(initial.imageUrl);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!q.trim()) {
      setError("Question text is required.");
      return;
    }
    if (opts.some((o) => !o.trim())) {
      setError("All 4 options are required before a question can be approved.");
      return;
    }
    onSave({
      question: q.trim(),
      options: opts.map((o) => o.trim()),
      correctAnswer: ans === "" ? null : Number(ans),
      explanation: expl.trim(),
      subject: subject.trim() || "General",
      chapter: chapter.trim() || "Unassigned",
      difficulty: diff,
      marks: Number.isFinite(marks) ? marks : 1,
      negativeMarks: Number.isFinite(neg) ? neg : 0,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      status,
      needsReview: ans === "" || status !== "approved",
      imageUrl: img,
      containsImage: img.trim().length > 0,
    });
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-navy-800/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Edit question">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-card bg-white p-5 shadow-2xl sm:p-6">
        <h3 className="text-lg font-extrabold text-navy-700">Edit Question</h3>
        <p className="text-[12px] font-semibold text-muted">Equations and symbols are preserved — edit carefully.</p>
        {error ? (
          <p className="mt-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 space-y-3">
          <div>
            <label className={labelCls} htmlFor="qe-text">Question *</label>
            <textarea id="qe-text" rows={3} className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {opts.map((o, i) => (
              <div key={i}>
                <label className={labelCls} htmlFor={`qe-opt-${i}`}>Option {"ABCD"[i]} *</label>
                <input id={`qe-opt-${i}`} className={inputCls} value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} />
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="qe-ans">Correct Answer</label>
              <select id="qe-ans" className={inputCls} value={ans} onChange={(e) => setAns(e.target.value)}>
                <option value="">Answer Required (null)</option>
                <option value="0">A</option>
                <option value="1">B</option>
                <option value="2">C</option>
                <option value="3">D</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="qe-status">Status</label>
              <select id="qe-status" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as QuestionStatus)}>
                <option value="draft">Draft</option>
                <option value="review">Needs Review</option>
                <option value="approved">Approved</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="qe-expl">Explanation</label>
            <textarea id="qe-expl" rows={2} className={inputCls} value={expl} onChange={(e) => setExpl(e.target.value)} placeholder="Solution steps shown to students after the test" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="qe-sub">Subject</label>
              <input id="qe-sub" className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="qe-ch">Chapter</label>
              <input id="qe-ch" className={inputCls} value={chapter} onChange={(e) => setChapter(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="qe-diff">Difficulty</label>
              <select id="qe-diff" className={inputCls} value={diff} onChange={(e) => setDiff(e.target.value as Difficulty)}>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="qe-marks">Marks</label>
              <input id="qe-marks" type="number" step="0.5" min="0" className={inputCls} value={marks} onChange={(e) => setMarks(Number(e.target.value))} />
            </div>
            <div>
              <label className={labelCls} htmlFor="qe-neg">Negative Marks</label>
              <input id="qe-neg" type="number" step="0.25" min="0" className={inputCls} value={neg} onChange={(e) => setNeg(Number(e.target.value))} />
            </div>
            <div>
              <label className={labelCls} htmlFor="qe-tags">Tags (comma separated)</label>
              <input id="qe-tags" className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="qe-img">Question image URL (optional — file upload lands here in production)</label>
            <input id="qe-img" className={inputCls} value={img} onChange={(e) => setImg(e.target.value)} placeholder="https://… or /images/…" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={save} className="flex-1">Save Question</Button>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
