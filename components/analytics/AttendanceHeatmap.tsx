"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type HeatStatus = "PRESENT" | "ABSENT" | "LATE" | "LEAVE" | "NONE";

export interface HeatDay {
  date: string; // YYYY-MM-DD
  status: HeatStatus;
}

// Month-grid attendance heatmap (contribution-graph style).
// `days` may be sparse — missing dates render neutral.
export function AttendanceHeatmap({ days, month }: { days: HeatDay[]; month: string }) {
  const cells = useMemo(() => {
    const m = month.match(/^(\d{4})-(\d{2})$/);
    if (!m) return [];
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const first = new Date(Date.UTC(y, mo - 1, 1));
    const count = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const byDate = new Map(days.map((d) => [d.date, d.status]));
    const out: { date: string; status: HeatStatus; blank: boolean }[] = [];
    // Leading blanks so the 1st lands on the right weekday (Sun-first).
    for (let i = 0; i < first.getUTCDay(); i += 1) {
      out.push({ date: "", status: "NONE", blank: true });
    }
    for (let d = 1; d <= count; d += 1) {
      const key = `${m[1]}-${m[2]}-${String(d).padStart(2, "0")}`;
      out.push({ date: key, status: byDate.get(key) ?? "NONE", blank: false });
    }
    return out;
  }, [days, month]);

  const tone = (s: HeatStatus) =>
    s === "PRESENT"
      ? "bg-teal-500"
      : s === "LATE"
        ? "bg-amber-400"
        : s === "LEAVE"
          ? "bg-sky-400"
          : s === "ABSENT"
            ? "bg-crimson"
            : "bg-silver-100";

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5" role="img" aria-label={`Attendance heatmap for ${month}`}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <p key={`${d}-${i}`} className="pb-1 text-center text-[10px] font-bold text-muted">
            {d}
          </p>
        ))}
        {cells.map((c, i) =>
          c.blank ? (
            <span key={`b-${i}`} />
          ) : (
            <span
              key={c.date}
              title={`${c.date}: ${c.status === "NONE" ? "no record" : c.status}`}
              className={cn("aspect-square w-full rounded-md", tone(c.status))}
            />
          )
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold text-muted">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-teal-500" /> Present</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Late</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-sky-400" /> Leave</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-crimson" /> Absent</span>
      </div>
    </div>
  );
}
