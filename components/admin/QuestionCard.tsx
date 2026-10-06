"use client";

import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BankQuestion } from "@/lib/testTypes";

export function QuestionCard({
  q,
  index,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  onApprove,
  selectable = false,
  onMoveUp,
  onMoveDown,
}: {
  q: BankQuestion;
  index: number;
  selected?: boolean;
  onToggleSelect?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onApprove: () => void;
  selectable?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <article className={cn("rounded-card border bg-white p-4 shadow-card sm:p-5", selected ? "border-teal-500 ring-2 ring-teal-500/20" : "border-silver-200")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {selectable ? (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={onToggleSelect}
              aria-label={`Select question ${index + 1}`}
              className="mt-1 h-4 w-4 accent-[#008C9E]"
            />
          ) : null}
          <div>
            <p className="text-[11px] font-bold tracking-widest text-muted">
              Q{index + 1} • {q.subject} • {q.chapter} • {q.difficulty} • {q.confidence}% confidence
            </p>
            <h4 className="mt-1 text-[15px] font-extrabold leading-snug text-navy-700">{q.question}</h4>
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {onMoveUp ? (
            <button onClick={onMoveUp} aria-label="Move question up" title="Move up" className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500">
              <ArrowUp className="h-4 w-4" />
            </button>
          ) : null}
          {onMoveDown ? (
            <button onClick={onMoveDown} aria-label="Move question down" title="Move down" className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500">
              <ArrowDown className="h-4 w-4" />
            </button>
          ) : null}
          {q.status !== "approved" ? (
            <button onClick={onApprove} aria-label="Approve question" title="Approve" className="rounded-lg border border-teal-100 bg-teal-50 p-2 text-teal-700 hover:bg-teal-100">
              <CheckCircle2 className="h-4 w-4" />
            </button>
          ) : null}
          <button onClick={onEdit} aria-label="Edit question" className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDelete} aria-label="Delete question" className="rounded-lg border border-crimson-100 p-2 text-crimson hover:bg-crimson-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-1.5">
        {q.options.map((o, i) => (
          <p
            key={i}
            className={cn(
              "rounded-lg border px-3 py-2 text-[13px] font-semibold",
              q.correctAnswer === i ? "border-teal-500 bg-teal-50 text-navy-700" : "border-silver-200 bg-silver-50/60 text-ink"
            )}
          >
            <span className="mr-2 font-extrabold">{"ABCD"[i]}.</span> {o || <span className="text-muted">(empty — edit required)</span>}
            {q.correctAnswer === i ? <span className="ml-2 text-[11px] font-bold text-teal-700">✓ Correct</span> : null}
          </p>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {q.correctAnswer === null ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-crimson-50 px-2.5 py-1 text-[11px] font-bold text-crimson">
            <AlertTriangle className="h-3 w-3" /> Answer Required
          </span>
        ) : null}
        {q.needsReview || q.status !== "approved" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-bold text-navy-700">
            <AlertTriangle className="h-3 w-3" /> Review Required
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </span>
        )}
        {q.containsImage ? <span className="rounded-full bg-silver-50 px-2.5 py-1 text-[11px] font-bold text-muted">🖼 Question image detected</span> : null}
        <span className="rounded-full bg-silver-50 px-2.5 py-1 text-[11px] font-bold text-muted">📄 {q.sourceFile}</span>
      </div>
      {q.explanation ? <p className="mt-2 rounded-lg bg-silver-50 px-3 py-2 text-[12px] text-muted">💡 {q.explanation}</p> : null}
    </article>
  );
}
