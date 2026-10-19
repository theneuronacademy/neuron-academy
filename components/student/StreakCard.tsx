// Phase 21 — Student Streak & Daily Goal Card

"use client";

import { useEffect, useState } from "react";
import { Flame, Target, Trophy, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface StreakData {
  streakDays: number;
  longestStreak: number;
  dailyGoalMinutes: number;
  lastTestAt: string | null;
  testedToday: boolean;
}

export function StreakCard() {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goal, setGoal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/student/streak", { cache: "no-store" });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        if (!goal) setGoal(json.data.dailyGoalMinutes);
      }
    } catch {
      setError("Failed to load streak data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveGoal = async () => {
    if (!goal || goal < 5 || goal > 480) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/student/streak", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyGoalMinutes: goal }),
      });
      const json = await res.json();
      if (json.success) {
        fetchData();
      } else {
        setError(json.error ?? "Failed to save goal");
      }
    } catch {
      setError("Failed to save goal");
    } finally {
      setSaving(false);
    }
  };

  const getStreakStatus = () => {
    if (!data) return { label: "Start your streak!", color: "text-muted", bg: "bg-silver-100" };
    if (data.testedToday) return { label: "On fire today! 🔥", color: "text-teal-600", bg: "bg-teal-50" };
    if (data.streakDays === 0) return { label: "Start your streak!", color: "text-muted", bg: "bg-silver-100" };
    return { label: `Keep it going — test today!`, color: "text-amber-600", bg: "bg-amber-50" };
  };

  if (loading) {
    return (
      <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card animate-pulse">
        <div className="h-6 w-1/3 bg-silver-200 rounded" />
        <div className="mt-4 h-4 w-1/4 bg-silver-200 rounded" />
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="h-16 bg-silver-200 rounded" />
          <div className="h-16 bg-silver-200 rounded" />
          <div className="h-16 bg-silver-200 rounded" />
        </div>
      </div>
    );
  }

  const status = getStreakStatus();

  return (
    <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-amber-100 text-amber-600"><Flame className="h-5 w-5" /></span>
          <div>
            <p className="text-[15px] font-extrabold text-navy-700">Daily Streak</p>
            <p className="text-[12px] text-muted">Consistency builds mastery</p>
          </div>
        </div>
        <span className={cn("px-3 py-1 rounded-full text-[11px] font-bold", status.bg, status.color)}>
          {status.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-amber-50 p-4 text-center">
          <p className="text-3xl font-extrabold text-amber-600">{data?.streakDays ?? 0}</p>
          <p className="text-[11px] font-bold text-muted">Current Streak</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-4 text-center">
          <p className="text-3xl font-extrabold text-emerald-600">{data?.longestStreak ?? 0}</p>
          <p className="text-[11px] font-bold text-muted">Best Streak</p>
        </div>
        <div className="rounded-xl bg-teal-50 p-4 text-center">
          <p className="text-3xl font-extrabold text-teal-600">{data?.dailyGoalMinutes ?? 30}</p>
          <p className="text-[11px] font-bold text-muted">Daily Goal (min)</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-silver-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-teal-600" />
            <p className="text-[13px] font-extrabold text-navy-700">Daily Goal</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={5}
              max={480}
              step={5}
              value={goal ?? data?.dailyGoalMinutes ?? 30}
              onChange={(e) => setGoal(parseInt(e.target.value) || 0)}
              className="w-20 rounded-xl border border-silver-300 px-3 py-1.5 text-sm font-bold text-center focus:border-teal-500 focus:outline-none"
              disabled={saving}
            />
            <span className="text-[12px] text-muted">min</span>
            <Button size="sm" onClick={handleSaveGoal} disabled={saving || !goal || goal < 5 || goal > 480}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm font-bold text-crimson">{error}</p>}
        {data?.testedToday && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-teal-600" />
            <p className="text-sm font-bold text-teal-700">You&apos;ve tested today &mdash; streak maintained! 🎉</p>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="outline" size="sm" className="w-full">
          <Trophy className="h-4 w-4 mr-2" /> Longest: {data?.longestStreak ?? 0} days
        </Button>
        <Button variant="outline" size="sm" className="w-full">
          <Clock className="h-4 w-4 mr-2" /> Goal: {data?.dailyGoalMinutes ?? 30} min/day
        </Button>
      </div>
    </div>
  );
}