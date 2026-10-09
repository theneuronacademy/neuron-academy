"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Lock, Search, Unlock } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { TestAccessRecord } from "@/services/testApi";

interface DbTest {
  id: string;
  title: string;
  accessType: "FREE" | "PAID" | "PRIVATE";
  price: number;
  status: string;
}

interface DirectoryStudent {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone: string;
}

/** Phase 13 — admin test-access console (manual grants after external UPI payment). */
export default function TestAccessPage() {
  const ready = useAdminGuard();
  const [tests, setTests] = useState<DbTest[]>([]);
  const [testId, setTestId] = useState("");
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<DirectoryStudent[]>([]);
  const [records, setRecords] = useState<TestAccessRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [expiry, setExpiry] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const res = await fetch("/api/tests", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success === true && Array.isArray(json.data?.items)) {
          const list = json.data.items as DbTest[];
          setTests(list);
          if (!testId && list.length > 0) setTestId(list[0].id);
        }
      } catch {
        /* offline */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!ready || !testId) {
      setRecords([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/test-access?testId=${encodeURIComponent(testId)}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success === true) setRecords(json.data.items ?? []);
      } catch {
        /* offline */
      }
    })();
  }, [ready, testId]);

  async function searchStudents() {
    setErr(null);
    setStudents([]);
    if (!query.trim()) return;
    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Search failed.");
        return;
      }
      setStudents(json.data.items ?? []);
    } catch {
      setErr("Cannot reach the server.");
    }
  }

  async function refreshRecords() {
    try {
      const res = await fetch(`/api/test-access?testId=${encodeURIComponent(testId)}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true) setRecords(json.data.items ?? []);
    } catch {
      /* ignore */
    }
  }

  async function grant(studentId: string) {
    if (!testId) return;
    setBusy(studentId);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/test-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, studentId, expiresAt: expiry || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Grant failed.");
        return;
      }
      setMsg("Access granted — the student has been notified in-app.");
      await refreshRecords();
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function revoke(recordId: string, studentName: string) {
    // Phase 17 — revoking immediately locks the student out (even
    // mid-attempt on next submit); require explicit confirmation.
    if (!window.confirm(`Revoke access for "${studentName}"? They will lose this test immediately.`)) return;
    setBusy(recordId);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/test-access/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REVOKED" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setErr(json?.error ?? "Revoke failed.");
        return;
      }
      setMsg("Access revoked — the student has been notified in-app.");
      await refreshRecords();
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;
  const test = tests.find((t) => t.id === testId);
  const grantedIds = new Set(records.filter((r) => r.status === "ACTIVE").map((r) => r.student.id));

  return (
    <AdminLayout title="Test Access" subtitle="Grant or revoke PAID / PRIVATE test access after payment confirmation">
      <div className="rounded-card border border-amber-200 bg-amber-50 p-4 text-[13px] font-semibold text-amber-800">
        Payment is handled externally. Admin grants access after payment confirmation. No online payment is collected here.
      </div>
      {msg ? <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700" role="status"><CheckCircle2 className="h-4 w-4" /> {msg}</p> : null}
      {err ? <p className="mt-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{err}</p> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <label className="mb-1.5 block text-[12px] font-bold tracking-wide text-navy-700" htmlFor="ta-test">Select test</label>
          <select id="ta-test" value={testId} onChange={(e) => setTestId(e.target.value)} className="w-full rounded-xl border border-silver-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none">
            {tests.length === 0 ? <option value="">No tests yet</option> : null}
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} • {t.accessType}{t.accessType === "PAID" ? ` • ₹${t.price}` : ""}
              </option>
            ))}
          </select>
          {test ? (
            <p className="mt-2 text-[12px] font-bold text-muted">
              {test.accessType === "FREE" ? "FREE tests need no grants — every eligible student can start." : test.accessType === "PAID" ? `PAID • ₹${test.price} • grant only after UPI confirmation.` : "PRIVATE • invite-only via grants below."}
            </p>
          ) : null}
          <label className="mb-1.5 mt-4 block text-[12px] font-bold tracking-wide text-navy-700" htmlFor="ta-expiry">Optional expiry (leave empty for lifetime)</label>
          <input id="ta-expiry" type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="w-full rounded-xl border border-silver-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none" />

          <label className="mb-1.5 mt-4 block text-[12px] font-bold tracking-wide text-navy-700" htmlFor="ta-search">Search student (name or mobile)</label>
          <div className="flex gap-2">
            <input
              id="ta-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void searchStudents(); }}
              placeholder="e.g. Rahul Kumar or 9876543210"
              className="w-full rounded-xl border border-silver-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
            />
            <Button size="sm" onClick={() => void searchStudents()} aria-label="Search students"><Search className="h-4 w-4" /></Button>
          </div>
          <div className="mt-3 space-y-2">
            {students.length === 0 ? <p className="text-[13px] text-muted">Search above to find students.</p> : null}
            {students.map((s) => {
              const granted = grantedIds.has(s.id);
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-silver-200 px-3.5 py-2.5">
                  <div>
                    <p className="text-sm font-extrabold text-navy-700">{s.name}</p>
                    <p className="text-[12px] text-muted">{s.phone} • {s.email}</p>
                  </div>
                  {granted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-[12px] font-bold text-teal-700"><Unlock className="h-3.5 w-3.5" /> Granted</span>
                  ) : (
                    <Button size="sm" disabled={busy === s.id || !testId} onClick={() => void grant(s.id)}>
                      {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Grant Access
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <h2 className="text-[15px] font-extrabold text-navy-700">Current access {test ? `— ${test.title}` : ""}</h2>
          {records.length === 0 ? (
            <p className="mt-3 rounded-xl bg-silver-50 px-4 py-3 text-[13px] font-semibold text-muted">No access records for this test yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {records.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-silver-200 px-3.5 py-2.5">
                  <div>
                    <p className="text-sm font-extrabold text-navy-700">{r.student.name}</p>
                    <p className="text-[12px] text-muted">{r.student.phone} • granted {new Date(r.grantedAt).toLocaleDateString()}{r.expiresAt ? ` • expires ${new Date(r.expiresAt).toLocaleString()}` : " • no expiry"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", r.status === "ACTIVE" ? "bg-teal-50 text-teal-700" : r.status === "REVOKED" ? "bg-crimson-50 text-crimson" : "bg-silver-100 text-muted")}>
                      {r.status === "ACTIVE" ? "ACCESS GRANTED" : r.status}
                    </span>
                    {r.status === "ACTIVE" ? (
                      <button
                        onClick={() => void revoke(r.id, r.student.name)}
                        disabled={busy === r.id}
                        className="rounded-lg border border-crimson-200 px-3 py-1.5 text-[12px] font-bold text-crimson hover:bg-crimson-50 disabled:opacity-50"
                      >
                        {busy === r.id ? "…" : "Revoke"}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
