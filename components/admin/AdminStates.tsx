"use client";

import { Inbox, Loader2, AlertTriangle } from "lucide-react";

export function EmptyState({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-silver-300 bg-white p-10 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-silver-100 text-muted">
        <Inbox className="h-5 w-5" />
      </span>
      <p className="mt-3 text-[15px] font-extrabold text-navy-700">{title}</p>
      {desc ? <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">{desc}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-card border border-silver-200 bg-white p-10 text-sm font-bold text-muted">
      <Loader2 className="h-4 w-4 animate-spin" /> {message}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-card border border-crimson-100 bg-crimson-50 p-6 text-center">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-crimson-DEFAULT">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="mt-2 text-sm font-extrabold text-crimson-DEFAULT">{message}</p>
      {onRetry ? (
        <button onClick={onRetry} className="mt-3 rounded-xl bg-white px-4 py-2 text-[13px] font-bold text-navy-700 ring-1 ring-silver-300">
          Retry
        </button>
      ) : null}
    </div>
  );
}
