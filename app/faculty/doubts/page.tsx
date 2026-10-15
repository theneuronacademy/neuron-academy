"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FacultyShell } from "@/components/faculty/FacultyShell";
import { cn } from "@/lib/utils";

interface Reply { id: string; authorRole: string; authorName: string; text: string; createdAt: string }
interface Doubt {
  id: string;
  subject: string | null;
  questionText: string;
  status: "ASKED" | "ANSWERED" | "CLOSED";
  createdAt: string;
  student: { name: string };
  replies: Reply[];
}

export default function FacultyDoubtsPage() {
  const router = useRouter();
  const [items, setItems] = React.useState<Doubt[] | null>(null);
  const [status, setStatus] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function load(nextStatus = status) {
    const q = nextStatus ? `?status=${encodeURIComponent(nextStatus)}` : "";
    try {
      const res = await fetch(`/api/doubts${q}`, { cache: "no-store" });
      if (res.status === 401) { router.replace("/faculty/login"); return; }
      const json = await res.json().catch(() => null);
      setItems(res.ok && json?.success === true && Array.isArray(json.data?.items) ? json.data.items : []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await fetch("/api/auth/session", { cache: "no-store" });
      if (!s.ok) { router.replace("/faculty/login"); return; }
      if (live) await load();
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function answer(id: string) {
    if (text.trim().length < 1) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/doubts/${id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Could not send answer.");
        return;
      }
      setText("");
      setOpenId(null);
      await load();
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const open = (items ?? []).filter((d) => d.status === "ASKED").length;

  return (
    <FacultyShell title="Doubts" subtitle={open > 0 ? `${open} unanswered in your batches` : "Doubts from your batches"}>
      <div className="flex flex-wrap gap-2">
        <select value={status} onChange={(e) => { setStatus(e.target.value); void load(e.target.value); }} className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-[13px] font-bold text-navy-700">
          <option value="">All statuses</option>
          <option value="ASKED">Unanswered</option>
          <option value="ANSWERED">Answered</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>
      {err ? <p className="mt-3 rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson-600" role="alert">{err}</p> : null}
      <div className="mt-3 space-y-3">
        {items === null ? (
          <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading doubts…</p>
        ) : items.length === 0 ? (
          <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">All clear — no doubts match.</p>
        ) : (
          items.map((d) => (
            <div key={d.id} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-bold tracking-widest text-muted">
                  {d.student.name} · {d.subject ?? "General"} · {new Date(d.createdAt).toLocaleDateString()}
                </p>
                <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-extrabold", d.status === "ANSWERED" ? "bg-teal-50 text-teal-700" : d.status === "CLOSED" ? "bg-silver-100 text-muted" : "bg-amber-50 text-amber-700")}>
                  {d.status}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-navy-700">{d.questionText}</p>
              {d.replies.length > 0 ? (
                <ul className="mt-2 space-y-2 border-l-2 border-teal-200 pl-3">
                  {d.replies.map((r) => (
                    <li key={r.id}>
                      <p className="text-[12px] text-navy-700"><span className="font-extrabold">{r.authorName}:</span> {r.text}</p>
                      <p className="text-[11px] text-muted">{new Date(r.createdAt).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {d.status !== "CLOSED" ? (
                openId === d.id ? (
                  <div className="mt-2 flex gap-2">
                    <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your answer…" className="flex-1 rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />
                    <button onClick={() => answer(d.id)} disabled={busy} className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-50">Send</button>
                    <button onClick={() => { setOpenId(null); setText(""); }} className="rounded-xl border border-silver-300 px-3 py-2 text-sm font-bold text-muted">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => { setOpenId(d.id); setText(""); }} className="mt-2 rounded-xl bg-teal-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-teal-700">
                    Answer
                  </button>
                )
              ) : null}
            </div>
          ))
        )}
      </div>
    </FacultyShell>
  );
}
