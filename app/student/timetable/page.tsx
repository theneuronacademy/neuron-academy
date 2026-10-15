"use client";

import { useEffect, useState } from "react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";

interface Entry {
  id: string;
  subject: string;
  title: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  faculty: { name: string } | null;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function StudentTimetablePage() {
  const session = useStudentGuard();
  const [items, setItems] = useState<Entry[] | null>(null);
  const today = new Date().getDay();

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const res = await fetch("/api/timetable", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        setItems(res.ok && json?.success === true && Array.isArray(json.data?.items) ? json.data.items : []);
      } catch {
        setItems([]);
      }
    })();
  }, [session]);

  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  const byDay: Entry[][] = Array.from({ length: 7 }, () => []);
  for (const e of items ?? []) byDay[e.dayOfWeek]?.push(e);

  return (
    <StudentShell title="Timetable" subtitle="Your batch's weekly class schedule">
      {items === null ? (
        <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading timetable…</p>
      ) : items.length === 0 ? (
        <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">
          No timetable published for your batch yet. Check back soon.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {DAYS.map((d, i) => (
            <div
              key={d}
              className={`rounded-card border bg-white p-4 shadow-card ${i === today ? "border-teal-500 ring-1 ring-teal-500" : "border-silver-200"}`}
            >
              <p className="flex items-center justify-between text-[13px] font-extrabold text-navy-700">
                {d}
                {i === today ? <span className="rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-extrabold text-white">TODAY</span> : null}
              </p>
              {byDay[i].length === 0 ? (
                <p className="mt-2 text-[12px] text-muted">No classes</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {byDay[i].map((e) => (
                    <li key={e.id} className="rounded-xl bg-silver-50 px-3 py-2">
                      <p className="text-[13px] font-extrabold text-navy-700">
                        {e.startTime}–{e.endTime} · {e.subject}
                      </p>
                      {e.title ? <p className="text-[12px] font-semibold text-navy-700">{e.title}</p> : null}
                      <p className="text-[11px] text-muted">
                        {e.faculty?.name ?? "Faculty TBA"}{e.room ? ` · Room ${e.room}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </StudentShell>
  );
}
