"use client";

import { useEffect, useState } from "react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { cn } from "@/lib/utils";

interface Reply { id: string; authorRole: string; authorName: string; text: string; createdAt: string }
interface Doubt {
  id: string;
  subject: string | null;
  questionText: string;
  status: "ASKED" | "ANSWERED" | "CLOSED";
  createdAt: string;
  replies: Reply[];
}

export default function StudentDoubtsPage() {
  const session = useStudentGuard();
  const [items, setItems] = useState<Doubt[] | null>(null);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/doubts", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      setItems(res.ok && json?.success === true && Array.isArray(json.data?.items) ? json.data.items : []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    if (session) void load();
  }, [session]);

  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  async function ask() {
    if (text.trim().length < 10) {
      setErr("Write your doubt in at least 10 characters.");
      return;
    }
    setBusy(true);
    setErr(null);
    setSaved(null);
    try {
      const res = await fetch("/api/doubts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim() || undefined, questionText: text.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Could not submit your doubt.");
        return;
      }
      setText("");
      setSubject("");
      setSaved("Doubt sent to your faculty.");
      await load();
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function reply(id: string) {
    if (replyText.trim().length < 1) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/doubts/${id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Could not send reply.");
        return;
      }
      setReplyText("");
      setReplyFor(null);
      await load();
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function closeDoubt(id: string, status: "CLOSED" | "ASKED") {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/doubts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Could not update doubt.");
        return;
      }
      await load();
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <StudentShell title="Doubts" subtitle="Ask your faculty — replies appear here">
      <div className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
        <p className="text-[14px] font-extrabold text-navy-700">Ask a doubt</p>
        {err ? <p className="mt-2 rounded-xl border border-crimson-200 bg-crimson-50 px-3 py-2 text-[13px] font-bold text-crimson-600" role="alert">{err}</p> : null}
        {saved ? <p className="mt-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-[13px] font-bold text-teal-700" role="status">{saved}</p> : null}
        <div className="mt-2 grid gap-2 sm:grid-cols-[180px_1fr]">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" className="rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your question in detail (min 10 characters)…" rows={3} className="rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
        </div>
        <button onClick={ask} disabled={busy} className="mt-2 rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-50">
          {busy ? "Sending…" : "Ask Faculty"}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {items === null ? (
          <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading doubts…</p>
        ) : items.length === 0 ? (
          <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No doubts yet — ask your first one above.</p>
        ) : (
          items.map((d) => (
            <div key={d.id} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-bold tracking-widest text-muted">
                  {d.subject ?? "General"} · {new Date(d.createdAt).toLocaleDateString()}
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
                      <p className="text-[12px] text-navy-700"><span className="font-extrabold">{r.authorName} ({r.authorRole}):</span> {r.text}</p>
                      <p className="text-[11px] text-muted">{new Date(r.createdAt).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {d.status !== "CLOSED" ? (
                  <>
                    <button onClick={() => { setReplyFor(replyFor === d.id ? null : d.id); setReplyText(""); }} className="rounded-lg border border-silver-300 px-3 py-1.5 text-[12px] font-bold text-navy-700 hover:border-teal-500">
                      {replyFor === d.id ? "Cancel" : "Follow up"}
                    </button>
                    <button onClick={() => closeDoubt(d.id, "CLOSED")} disabled={busy} className="rounded-lg border border-silver-300 px-3 py-1.5 text-[12px] font-bold text-muted hover:border-teal-500 disabled:opacity-50">
                      Mark resolved
                    </button>
                  </>
                ) : (
                  <button onClick={() => closeDoubt(d.id, "ASKED")} disabled={busy} className="rounded-lg border border-silver-300 px-3 py-1.5 text-[12px] font-bold text-navy-700 hover:border-teal-500 disabled:opacity-50">
                    Reopen
                  </button>
                )}
              </div>
              {replyFor === d.id ? (
                <div className="mt-2 flex gap-2">
                  <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a follow-up…" className="flex-1 rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />
                  <button onClick={() => reply(d.id)} disabled={busy} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50">Send</button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </StudentShell>
  );
}
