// Phase 21 — Parent Portal (Read-Only)
// Parents view their children's progress via registered mobile

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, Trophy, Calendar, Flame, Target } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface StudentData {
  student: {
    id: string;
    studentId: string;
    name: string;
    batch: { name: string } | null;
    course: { name: string } | null;
    streakDays: number;
    longestStreak: number;
    dailyGoalMinutes: number;
    lastTestAt: string | null;
  };
  recentResults: Array<{
    id: string;
    testTitle: string;
    testType: string;
    marks: number;
    totalMarks: number;
    percentage: number;
    date: string;
  }>;
  attendance: {
    percentage: number | null;
    attended: number;
    total: number;
    recent: Array<{ date: string; status: string }>;
  };
  streak: {
    current: number;
    longest: number;
    goal: number;
    lastTestAt: string | null;
  };
}

export default function ParentPortalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted">Loading...</div>}>
      <ParentPortalPageContent />
    </Suspense>
  );
}

function ParentPortalPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone");
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputPhone, setInputPhone] = useState(phone || "");

  const fetchData = async () => {
    if (!inputPhone) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/parent/students?phone=${encodeURIComponent(inputPhone)}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setStudents(json.data.students);
      } else {
        setError(json.error ?? "Failed to load data");
      }
    } catch {
      setError("Failed to load data. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (inputPhone) fetchData();
  }, [inputPhone, fetchData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPhone.trim()) return;
    router.push(`/parent/portal?phone=${encodeURIComponent(inputPhone.trim())}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PRESENT": return "text-emerald-600 bg-emerald-50";
      case "ABSENT": return "text-crimson bg-crimson-50";
      case "LATE": return "text-amber-600 bg-amber-50";
      case "LEAVE": return "text-blue-600 bg-blue-50";
      default: return "text-muted bg-silver-100";
    }
  };

  return (
    <div className="metallic-dark flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-[22px] bg-white shadow-2xl">
        <div className="bg-navy-700 px-6 py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-navy-700"><GraduationCap className="h-6 w-6" /></span>
          <h1 className="mt-3 text-xl font-extrabold text-white">Parent Portal</h1>
          <p className="mt-1 text-[13px] text-silver-200">View your children&apos;s academic progress</p>
        </div>

        <div className="space-y-4 p-6">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <label className="flex items-center gap-2 text-sm font-bold text-navy-700">
              <Calendar className="h-4 w-4" />
              <span>Registered Mobile</span>
            </label>
            <input
              type="tel"
              inputMode="tel"
              placeholder="e.g. 97119 17317"
              value={inputPhone}
              onChange={(e) => setInputPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="flex-1 rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
              disabled={loading}
            />
            <Button type="submit" size="lg" disabled={loading || !inputPhone}>
              {loading ? <><span className="h-4 w-4 animate-spin mr-2" />Loading...</> : "View Progress"}
            </Button>
          </form>

          {error && <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson">{error}</p>}

          {students.length > 0 && (
            <div className="space-y-6">
              {students.map((s) => (
                <div key={s.student.id} className="overflow-hidden rounded-card border border-silver-200 bg-white shadow-card">
                  <div className="bg-gradient-to-r from-navy-700 to-teal-600 px-5 py-4 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="p-2 rounded-xl bg-white/20"><GraduationCap className="h-5 w-5" /></span>
                        <div>
                          <p className="text-lg font-extrabold">{s.student.name}</p>
                          <p className="text-[13px] opacity-80">
                            {s.student.studentId} • {s.student.batch?.name ?? "No Batch"} • {s.student.course?.name ?? "No Course"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1"><Flame className="h-4 w-4" /> {s.streak.current} day streak</span>
                        <span className="flex items-center gap-1"><Trophy className="h-4 w-4" /> Best: {s.streak.longest}</span>
                        <span className="flex items-center gap-1"><Target className="h-4 w-4" /> Goal: {s.streak.goal} min/day</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Streak & Goal */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="rounded-xl bg-amber-50 p-4 text-center">
                        <p className="text-3xl font-extrabold text-amber-600">{s.streak.current}</p>
                        <p className="text-[11px] font-bold text-muted">Current Streak</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-4 text-center">
                        <p className="text-3xl font-extrabold text-emerald-600">{s.streak.longest}</p>
                        <p className="text-[11px] font-bold text-muted">Best Streak</p>
                      </div>
                      <div className="rounded-xl bg-teal-50 p-4 text-center">
                        <p className="text-3xl font-extrabold text-teal-600">{s.streak.goal}</p>
                        <p className="text-[11px] font-bold text-muted">Daily Goal (min)</p>
                      </div>
                    </div>

                    {/* Attendance */}
                    <div className="rounded-xl border border-silver-200 bg-white p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-extrabold text-navy-700 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-teal-600" /> Attendance
                        </p>
                        {s.attendance.percentage !== null && (
                          <span className="text-lg font-extrabold text-teal-600">{s.attendance.percentage}%</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">Attended: {s.attendance.attended} / {s.attendance.total}</span>
                        {s.attendance.percentage !== null && (
                          <div className="w-32 h-2 rounded-full bg-silver-200 overflow-hidden">
                            <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${s.attendance.percentage}%` }} />
                          </div>
                        )}
                      </div>
                      {s.attendance.recent.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {s.attendance.recent.map((a, i) => (
                            <div key={i} className="flex items-center justify-between text-[12px]">
                              <span>{a.date}</span>
                              <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", getStatusColor(a.status))}>
                                {a.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent Results */}
                    {s.recentResults.length > 0 && (
                      <div className="rounded-xl border border-silver-200 bg-white p-4">
                        <p className="mb-3 text-sm font-extrabold text-navy-700 flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-amber-600" /> Recent Test Results
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead>
                              <tr className="border-b border-silver-200 text-[11px] text-muted">
                                <th className="p-2">Test</th>
                                <th className="p-2 text-right">Score</th>
                                <th className="p-2 text-right">%</th>
                                <th className="p-2">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.recentResults.slice(0, 5).map((r) => (
                                <tr key={r.id} className="border-b border-silver-100 hover:bg-silver-50">
                                  <td className="p-2 font-bold text-navy-700 truncate max-w-[200px]">{r.testTitle}</td>
                                  <td className="p-2 text-right font-bold text-navy-700">{r.marks}/{r.totalMarks}</td>
                                  <td className="p-2 text-right font-bold text-teal-600">{r.percentage}%</td>
                                  <td className="p-2 text-muted">{r.date}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {s.recentResults.length > 5 && (
                          <p className="mt-2 text-center text-sm text-teal-600 hover:underline cursor-pointer">View all {s.recentResults.length} results</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!students.length && !loading && inputPhone && (
            <div className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-silver-100 text-muted"><GraduationCap className="h-6 w-6" /></span>
              <p className="mt-3 text-lg font-extrabold text-navy-700">No Students Found</p>
              <p className="mt-1 text-sm text-muted">No active students linked to this mobile number.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}