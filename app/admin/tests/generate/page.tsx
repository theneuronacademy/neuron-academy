"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Shuffle } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface PoolRow {
  id: string;
  testId: string;
  questionText: string;
  correctAnswer: string | null;
  marks: number;
}

interface SourceTest {
  id: string;
  title: string;
  approved: number;
}

interface Generated {
  id: string;
  title: string;
  questionOrder: string;
  optionOrder: string;
  batchId: string | null;
  duration: number;
  totalMarks: number;
  accessType?: string;
  price?: number;
}

const inputCls = "w-full rounded-xl border border-silver-300 bg-white px-3.5 py-2 text-sm focus:border-teal-500 focus:outline-none";

export default function GenerateTestPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>}>
      <GenerateTestInner />
    </Suspense>
  );
}

function GenerateTestInner() {
  const ready = useAdminGuard();
  const search = useSearchParams();
  const preselect = search.get("source") ?? "";
  const [sources, setSources] = useState<SourceTest[]>([]);
  const [pickedSources, setPickedSources] = useState<string[]>(preselect ? [preselect] : []);
  const [pool, setPool] = useState<PoolRow[]>([]);
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [batchId, setBatchId] = useState("");
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [type, setType] = useState("PRACTICE");
  const [duration, setDuration] = useState(60);
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<"MANUAL" | "RANDOM" | "SERIAL">("RANDOM");
  const [qOrder, setQOrder] = useState<"SERIAL" | "RANDOM">("RANDOM");
  const [oOrder, setOOrder] = useState<"SERIAL" | "RANDOM">("SERIAL");
  // Phase 13 — access model (admin-only; validated server-side too).
  const [accessType, setAccessType] = useState<"FREE" | "PAID" | "PRIVATE">("FREE");
  const [price, setPrice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [previewQs, setPreviewQs] = useState<PoolRow[]>([]);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const [iRes, bRes] = await Promise.all([
          fetch("/api/tests/import", { cache: "no-store" }),
          fetch("/api/batches", { cache: "no-store" }),
        ]);
        const iJson = await iRes.json().catch(() => null);
        const bJson = await bRes.json().catch(() => null);
        if (iJson?.success === true && Array.isArray(iJson.data?.items)) {
          const list: SourceTest[] = [];
          for (const imp of iJson.data.items) {
            if (!imp.stagingTestId) continue;
            try {
              const qRes = await fetch(`/api/tests/import/${imp.id}/questions?reviewStatus=APPROVED`, { cache: "no-store" });
              const qJson = await qRes.json().catch(() => null);
              const n = Array.isArray(qJson?.data?.items) ? qJson.data.items.length : 0;
              if (n > 0) list.push({ id: imp.stagingTestId, title: String(imp.filename ?? imp.id), approved: n });
            } catch {
              /* skip */
            }
          }
          setSources(list);
          if (preselect && !list.some((s) => s.id === preselect)) setPickedSources([]);
        }
        if (bJson?.success === true && Array.isArray(bJson.data?.items)) {
          setBatches(bJson.data.items.map((b: { id: string; name?: string }) => ({ id: String(b.id), name: String(b.name ?? b.id) })));
        }
      } catch {
        /* offline — form still renders */
      }
    })();
  }, [ready, preselect]);

  useEffect(() => {
    if (!ready || pickedSources.length === 0) {
      setPool([]);
      return;
    }
    (async () => {
      const all: PoolRow[] = [];
      for (const tid of pickedSources) {
        try {
          const res = await fetch(`/api/questions?testId=${encodeURIComponent(tid)}`, { cache: "no-store" });
          const json = await res.json().catch(() => null);
          if (res.ok && json?.success === true && Array.isArray(json.data?.items)) {
            for (const q of json.data.items) {
              if (q.reviewStatus === "APPROVED") {
                all.push({ id: String(q.id), testId: String(q.testId), questionText: String(q.questionText), correctAnswer: q.correctAnswer ?? null, marks: Number(q.marks ?? 1) });
              }
            }
          }
        } catch {
          /* skip */
        }
      }
      setPool(all);
      setManualIds((prev) => prev.filter((id) => all.some((q) => q.id === id)));
    })();
  }, [ready, pickedSources]);

  const effectiveCount = useMemo(() => (mode === "MANUAL" ? manualIds.length : count), [mode, manualIds.length, count]);

  const generate = async () => {
    setError(null);
    setGenerated(null);
    setPreviewQs([]);
    setPublishMsg(null);
    if (!title.trim()) {
      setError("Give the test a title.");
      return;
    }
    if (mode === "MANUAL" && manualIds.length === 0) {
      setError("Select at least one question for MANUAL mode.");
      return;
    }
    if (mode !== "MANUAL" && (!Number.isFinite(count) || count <= 0)) {
      setError("Set how many questions to select.");
      return;
    }
    if (accessType === "PAID" && (!Number.isFinite(price) || price <= 0)) {
      setError("PAID tests require a price above ₹0.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/tests/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          batchId: batchId || undefined,
          type,
          duration,
          count: mode === "MANUAL" ? manualIds.length : count,
          sourceTestIds: pickedSources,
          selectionMode: mode,
          questionIds: mode === "MANUAL" ? manualIds : undefined,
          questionOrder: qOrder,
          optionOrder: oOrder,
          accessType,
          price: accessType === "FREE" ? 0 : accessType === "PAID" ? Math.floor(price) : 0,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error ?? "Generation failed.");
        return;
      }
      setGenerated(json.data.item);
      setPreviewQs(
        (json.data.questions ?? []).map((q: { id: string; testId: string; questionText: string; correctAnswer: string | null; marks: number }) => ({
          id: String(q.id),
          testId: String(q.testId),
          questionText: String(q.questionText),
          correctAnswer: q.correctAnswer ?? null,
          marks: Number(q.marks ?? 1),
        }))
      );
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!generated) return;
    setPublishMsg(null);
    try {
      const res = await fetch(`/api/tests/${generated.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setPublishMsg(`Cannot publish: ${json?.error ?? "validation failed"}`);
        return;
      }
      setPublishMsg("Published — students in the batch can now attempt it.");
    } catch {
      setPublishMsg("Publish failed — check your connection.");
    }
  };

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  return (
    <AdminLayout title="Generate Test" subtitle="Pool → configure → preview → publish">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-[15px] font-extrabold text-navy-700">1. Question Pool (approved only)</h2>
          {sources.length === 0 ? (
            <p className="mt-3 rounded-xl bg-silver-50 px-4 py-3 text-[13px] font-semibold text-muted">
              No approved pools yet. Import a PDF and approve questions first. <Link href="/admin/tests/from-pdf" className="font-bold text-teal-600 underline">Go to PDF import →</Link>
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {sources.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-silver-200 px-3.5 py-2.5 text-sm font-bold text-navy-700 hover:border-teal-400">
                  <input
                    type="checkbox"
                    checked={pickedSources.includes(s.id)}
                    onChange={() => setPickedSources((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                    className="h-4 w-4 accent-[#008C9E]"
                  />
                  <span className="flex-1 truncate">{s.title}</span>
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-700">{s.approved} approved</span>
                </label>
              ))}
            </div>
          )}
          <p className="mt-2 text-[12px] font-bold text-muted">{pool.length} approved question(s) in scope • approve more in review to grow the pool.</p>

          <h2 className="mt-5 text-[15px] font-extrabold text-navy-700">2. Configure Test</h2>
          {error ? <p className="mt-2 rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
          <div className="mt-3 grid gap-3">
            <label className="block text-[12px] font-bold text-navy-700">Test title
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Physics Mock 03" className={`${inputCls} mt-1.5`} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px] font-bold text-navy-700">Batch (required to publish)
                <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className={`${inputCls} mt-1.5`}>
                  <option value="">Select batch…</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label className="block text-[12px] font-bold text-navy-700">Type
                <select value={type} onChange={(e) => setType(e.target.value)} className={`${inputCls} mt-1.5`}>
                  <option>PRACTICE</option>
                  <option>LIVE</option>
                  <option>OFFLINE</option>
                </select>
              </label>
              <label className="block text-[12px] font-bold text-navy-700">Duration (minutes)
                <input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={`${inputCls} mt-1.5`} />
              </label>
              <label className="block text-[12px] font-bold text-navy-700">Question count
                <input type="number" min={1} max={200} value={count} onChange={(e) => setCount(Number(e.target.value))} disabled={mode === "MANUAL"} className={`${inputCls} mt-1.5 disabled:opacity-50`} />
              </label>
              <label className="block text-[12px] font-bold text-navy-700">Selection mode
                <select value={mode} onChange={(e) => setMode(e.target.value as "MANUAL" | "RANDOM" | "SERIAL")} className={`${inputCls} mt-1.5`}>
                  <option value="MANUAL">MANUAL — pick questions below</option>
                  <option value="RANDOM">RANDOM — server shuffles, takes N</option>
                  <option value="SERIAL">SERIAL — pool order, first N</option>
                </select>
              </label>
              <label className="block text-[12px] font-bold text-navy-700">Question order
                <select value={qOrder} onChange={(e) => setQOrder(e.target.value as "SERIAL" | "RANDOM")} className={`${inputCls} mt-1.5`}>
                  <option value="SERIAL">SERIAL 1-2-3…</option>
                  <option value="RANDOM">RANDOM per attempt</option>
                </select>
              </label>
            </div>
            <label className="block text-[12px] font-bold text-navy-700">Option order
              <select value={oOrder} onChange={(e) => setOOrder(e.target.value as "SERIAL" | "RANDOM")} className={`${inputCls} mt-1.5`}>
                <option value="SERIAL">SERIAL A-B-C…</option>
                <option value="RANDOM">RANDOM per attempt (server-mapped)</option>
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px] font-bold text-navy-700">Access type
                <select value={accessType} onChange={(e) => { const v = e.target.value as "FREE" | "PAID" | "PRIVATE"; setAccessType(v); if (v === "FREE") setPrice(0); }} className={`${inputCls} mt-1.5`}>
                  <option value="FREE">FREE — open to eligible students</option>
                  <option value="PAID">PAID — grant after UPI payment</option>
                  <option value="PRIVATE">PRIVATE — invite-only</option>
                </select>
              </label>
              {accessType === "PAID" ? (
                <label className="block text-[12px] font-bold text-navy-700">Price (₹)
                  <input type="number" min={1} max={100000} value={price} onChange={(e) => setPrice(Number(e.target.value))} className={`${inputCls} mt-1.5`} />
                </label>
              ) : null}
            </div>
            {accessType === "PAID" ? (
              <p className="text-[12px] text-muted">No online payment is collected here. Payment is handled externally — grant access from Test Access after confirming payment.</p>
            ) : null}
            <p className="text-[12px] text-muted">
              Will generate {effectiveCount} question(s) from {pool.length} approved. Randomization is
              server-side and stored per attempt.
            </p>
            <Button onClick={generate} disabled={busy || pool.length === 0} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
              {busy ? "Generating…" : "Generate Test (Draft)"}
            </Button>
          </div>

          {mode === "MANUAL" && pool.length > 0 ? (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-extrabold text-navy-700">Pick questions</p>
                <div className="flex gap-2 text-[12px] font-bold">
                  <button onClick={() => setManualIds(pool.map((q) => q.id))} className="text-teal-600 hover:underline">Select all</button>
                  <button onClick={() => setManualIds([])} className="text-muted hover:underline">Clear all</button>
                </div>
              </div>
              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {pool.map((q) => (
                  <label key={q.id} className={cn("flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-[13px]", manualIds.includes(q.id) ? "border-teal-500 bg-teal-50/60" : "border-silver-200")}>
                    <input type="checkbox" checked={manualIds.includes(q.id)} onChange={() => setManualIds((p) => (p.includes(q.id) ? p.filter((x) => x !== q.id) : [...p, q.id]))} className="mt-0.5 h-4 w-4 accent-[#008C9E]" />
                    <span className="flex-1 font-semibold text-ink">{q.questionText.slice(0, 110)}{q.questionText.length > 110 ? "…" : ""}</span>
                    <span className="shrink-0 rounded-full bg-silver-100 px-2 py-0.5 text-[11px] font-bold text-muted">{q.correctAnswer ? `Ans ${q.correctAnswer}` : "No ans"}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-[15px] font-extrabold text-navy-700">3. Preview & Publish</h2>
          {!generated ? (
            <p className="mt-3 text-sm text-muted">Generate a test to preview exactly what is stored — order, marks and schedule — before publishing.</p>
          ) : (
            <div className="mt-3">
              <div className="rounded-2xl bg-navy-800 p-5 text-white">
                <p className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-teal-300"><CheckCircle2 className="h-4 w-4" /> DRAFT READY</p>
                <p className="mt-1 text-xl font-extrabold">{generated.title}</p>
                <p className="mt-1 text-[13px] text-silver-200">
                  {previewQs.length} questions • {generated.duration} min • {generated.totalMarks} marks •
                  Q:{generated.questionOrder} O:{generated.optionOrder} • {generated.batchId ? "Batch assigned" : "No batch — assign before publishing"}
                </p>
                <p className="mt-1 text-[13px] font-bold text-teal-300">
                  {generated.accessType === "PAID" ? `PAID • ₹${generated.price ?? 0}` : generated.accessType === "PRIVATE" ? "PRIVATE • invite-only" : "FREE • open"}
                </p>
              </div>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                {previewQs.map((q, i) => (
                  <p key={q.id} className="rounded-xl border border-silver-200 bg-silver-50/60 px-3.5 py-2 text-[13px]">
                    <span className="font-extrabold text-navy-700">Q{i + 1}.</span> {q.questionText.slice(0, 100)}{q.questionText.length > 100 ? "…" : ""}
                    <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-700">Ans {q.correctAnswer ?? "—"}</span>
                  </p>
                ))}
              </div>
              {publishMsg ? <p className="mt-3 rounded-xl bg-silver-50 px-4 py-2.5 text-[13px] font-bold text-navy-700" role="status">{publishMsg}</p> : null}
              <div className="mt-3 grid gap-2">
                <Button onClick={publish}>Publish Test</Button>
                <Link href="/admin/tests" className="rounded-xl border border-silver-300 px-4 py-2.5 text-center text-sm font-bold text-navy-700 hover:border-teal-500">Open Test Management →</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
