"use client";

import { cn } from "@/lib/utils";

/** Phase 14 — zero-dependency SVG chart primitives (hand-rolled, no chart lib). */

/** Progress ring. value 0–100 (null = empty state). */
export function Ring({ value, size = 120, label, sub }: { value: number | null; size?: number; label: string; sub?: string }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center" role="img" aria-label={`${label}: ${value === null ? "no data" : `${value}%`}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={10} className="stroke-silver-200" />
        {value !== null ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (pct / 100) * c}
            className="chart-draw stroke-teal-500"
          />
        ) : null}
      </svg>
      <p className="-mt-[52%] mb-[30%] text-center text-2xl font-extrabold text-navy-700" style={{ marginTop: -size * 0.62 }}>
        {value === null ? "—" : `${value}%`}
      </p>
      <p className="mt-1 text-[11px] font-bold tracking-widest text-muted">{label.toUpperCase()}</p>
      {sub ? <p className="text-[12px] font-semibold text-muted">{sub}</p> : null}
    </div>
  );
}

/** Performance trend line (percentage over time). */
export function TrendChart({ points, height = 140 }: { points: { label: string; value: number }[]; height?: number }) {
  if (points.length === 0) {
    return <p className="rounded-xl bg-silver-50 px-4 py-6 text-center text-[13px] font-bold text-muted">No test data yet.</p>;
  }
  const w = 560;
  const h = height;
  const pad = 24;
  const max = 100;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const xy = points.map((p, i) => ({
    x: pad + i * step,
    y: h - pad - (Math.max(0, Math.min(100, p.value)) / max) * (h - pad * 2),
    ...p,
  }));
  const d = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Performance trend">
      {[0, 25, 50, 75, 100].map((g) => (
        <line key={g} x1={pad} x2={w - pad} y1={h - pad - (g / 100) * (h - pad * 2)} y2={h - pad - (g / 100) * (h - pad * 2)} className="stroke-silver-200" strokeDasharray="3 3" />
      ))}
      <path d={`${d} L${(w - pad).toFixed(1)},${(h - pad).toFixed(1)} L${pad},${(h - pad).toFixed(1)} Z`} className="fill-teal-500/10" />
      <path d={d} fill="none" strokeWidth={2.5} strokeLinecap="round" className="chart-draw stroke-teal-600" />
      {xy.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} className="fill-teal-600 stroke-white" strokeWidth={2}>
            <title>{`${p.label}: ${p.value}%`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}

/** Horizontal bars (e.g. subject performance, attendance split). */
export function Bars({ rows }: { rows: { label: string; value: number | null; hint?: string }[] }) {
  if (rows.length === 0) {
    return <p className="rounded-xl bg-silver-50 px-4 py-6 text-center text-[13px] font-bold text-muted">No data yet.</p>;
  }
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="font-bold text-navy-700">{r.label}</span>
            <span className="font-extrabold text-muted">{r.value === null ? "—" : `${r.value}%`}{r.hint ? ` • ${r.hint}` : ""}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-silver-100">
            <div
              className="chart-grow h-full rounded-full bg-gradient-to-r from-teal-500 to-navy-700"
              style={{ width: `${r.value === null ? 0 : Math.max(0, Math.min(100, r.value))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton loader block. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-silver-100", className ?? "h-24")} />;
}

/** Greeting by hour (server clock never trusted for exams — display only). */
export function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${part}, ${name.split(" ")[0]}`;
}
