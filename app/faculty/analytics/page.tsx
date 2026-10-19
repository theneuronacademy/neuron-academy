// Faculty Analytics Page - Enhanced with charts and trends
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FacultyShell } from "@/components/faculty/FacultyShell";
import { useFacultyAnalytics } from "@/lib/faculty-hooks";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

interface Row { id: string; name: string; batch: string; batchId: string; attendancePct: number | null; testsTaken: number; avgScore: number | null }

export default function FacultyAnalyticsPage() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useFacultyAnalytics();

  const rows = data?.rows ?? [];
  const overall = data?.overall ?? { students: 0, attendancePct: null, avgScore: null, testsTaken: 0 };

  const weak = React.useMemo(() => rows.filter((r) => (r.attendancePct != null && r.attendancePct < 75) || (r.avgScore != null && r.avgScore < 40)).slice(0, 10), [rows]);

  // Chart data
  const attendanceDistribution = [
    { range: "0-50%", count: rows.filter((r) => r.attendancePct != null && r.attendancePct < 50).length, color: "#EF4444" },
    { range: "50-75%", count: rows.filter((r) => r.attendancePct != null && r.attendancePct >= 50 && r.attendancePct < 75).length, color: "#F59E0B" },
    { range: "75-90%", count: rows.filter((r) => r.attendancePct != null && r.attendancePct >= 75 && r.attendancePct < 90).length, color: "#10B981" },
    { range: "90-100%", count: rows.filter((r) => r.attendancePct != null && r.attendancePct >= 90).length, color: "#059669" },
    { range: "No Data", count: rows.filter((r) => r.attendancePct == null).length, color: "#9CA3AF" },
  ].filter((d) => d.count > 0);

  const scoreDistribution = [
    { range: "0-40%", count: rows.filter((r) => r.avgScore != null && r.avgScore < 40).length, color: "#EF4444" },
    { range: "40-60%", count: rows.filter((r) => r.avgScore != null && r.avgScore >= 40 && r.avgScore < 60).length, color: "#F59E0B" },
    { range: "60-80%", count: rows.filter((r) => r.avgScore != null && r.avgScore >= 60 && r.avgScore < 80).length, color: "#3B82F6" },
    { range: "80-100%", count: rows.filter((r) => r.avgScore != null && r.avgScore >= 80).length, color: "#10B981" },
    { range: "No Data", count: rows.filter((r) => r.avgScore == null).length, color: "#9CA3AF" },
  ].filter((d) => d.count > 0);

  const batchComparison = rows.reduce((acc, r) => {
    if (!acc[r.batch]) acc[r.batch] = { attendanceSum: 0, attendanceCount: 0, scoreSum: 0, scoreCount: 0, students: 0 };
    acc[r.batch].students++;
    if (r.attendancePct != null) { acc[r.batch].attendanceSum += r.attendancePct; acc[r.batch].attendanceCount++; }
    if (r.avgScore != null) { acc[r.batch].scoreSum += r.avgScore; acc[r.batch].scoreCount++; }
    return acc;
  }, {} as Record<string, { attendanceSum: number; attendanceCount: number; scoreSum: number; scoreCount: number; students: number }>);

  const batchData = Object.entries(batchComparison).map(([batch, data]) => ({
    batch,
    attendance: data.attendanceCount > 0 ? Math.round((data.attendanceSum / data.attendanceCount) * 10) / 10 : 0,
    avgScore: data.scoreCount > 0 ? Math.round((data.scoreSum / data.scoreCount) * 10) / 10 : 0,
    students: data.students,
  }));

  // Mock trend data (in production, fetch from API with date ranges)
  const trendData = [
    { month: "Jan", attendance: 78, avgScore: 65 },
    { month: "Feb", attendance: 82, avgScore: 68 },
    { month: "Mar", attendance: 79, avgScore: 70 },
    { month: "Apr", attendance: 85, avgScore: 72 },
    { month: "May", attendance: 83, avgScore: 74 },
    { month: "Jun", attendance: 87, avgScore: 76 },
  ];

  if (isLoading) {
    return (
      <FacultyShell title="Analytics" subtitle="Performance across your assigned batches">
        <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading analytics&hellip;</p>
      </FacultyShell>
    );
  }

  if (isError) {
    return (
      <FacultyShell title="Analytics" subtitle="Error loading data">
        <p className="rounded-card border border-crimson-200 bg-crimson-50 p-6 text-sm font-bold text-crimson-600">Failed to load analytics. <button onClick={() => refetch()} className="underline">Retry</button></p>
      </FacultyShell>
    );
  }

  return (
    <FacultyShell title="Analytics" subtitle="Performance across your assigned batches">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
        {[
          ["Students", overall.students],
          ["Attendance", overall.attendancePct == null ? "\u2014" : `${overall.attendancePct}%`],
          ["Avg Score", overall.avgScore == null ? "\u2014" : `${overall.avgScore}%`],
          ["Evaluations", overall.testsTaken],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
            <p className="text-[11px] font-bold tracking-widest text-muted">{l}</p>
            <p className="mt-1 text-2xl font-extrabold text-navy-700">{v}</p>
          </div>
        ))}
      </div>

      {/* Trend Chart */}
      <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card mb-4">
        <p className="text-[15px] font-extrabold text-navy-700 mb-4 flex items-center gap-2">\uD83D\uD8C8 6-Month Trends</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [
                  `${value ?? 0}${name === "attendance" ? "%" : "%"}`,
                  name === "attendance" ? "Attendance" : "Avg Score",
                ]}
              />
              <Line type="monotone" dataKey="attendance" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} name="Attendance" />
              <Line type="monotone" dataKey="avgScore" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} name="Avg Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribution Charts */}
      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        {/* Attendance Distribution */}
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <p className="text-[15px] font-extrabold text-navy-700 mb-4">\uD83D\uDCCA Attendance Distribution</p>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie
                  data={attendanceDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="range"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {attendanceDistribution.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={entry.color} />
                  ))}
                </Pie>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={(value: any) => [`${value ?? 0} students`, "Count"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Score Distribution */}
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <p className="text-[15px] font-extrabold text-navy-700 mb-4">\uD83D\uDCCA Score Distribution</p>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie
                  data={scoreDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="range"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {scoreDistribution.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={entry.color} />
                  ))}
                </Pie>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={(value: any) => [`${value ?? 0} students`, "Count"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Batch Comparison */}
      {batchData.length > 1 && (
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card mb-4">
          <p className="text-[15px] font-extrabold text-navy-700 mb-4">\uD83C\uDFEB Batch Comparison</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={batchData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="batch" tick={{ fontSize: 11 }} width={120} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [
                    `${value ?? 0}%`,
                    name === "attendance" ? "Attendance" : "Avg Score",
                  ]}
                />
                <Bar dataKey="attendance" fill="#10B981" radius={[0, 4, 4, 0]} name="Attendance" />
                <Bar dataKey="avgScore" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Avg Score" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* At-Risk Students */}
      <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card mb-4">
        <p className="text-[15px] font-extrabold text-navy-700 mb-4">\u26A0\uFE0F Needs Attention {'Att < 75% or Avg < 40%'}</p>
        {weak.length === 0 ? (
          <p className="text-sm text-muted">No at-risk students by current thresholds.</p>
        ) : (
          <ul className="space-y-2">
            {weak.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-silver-200 px-3.5 py-2.5">
                <div className="min-w-0"><p className="truncate text-sm font-extrabold text-navy-700">{r.name}</p><p className="text-[12px] text-muted">{r.batch}</p></div>
                <p className="shrink-0 text-[12px] font-bold text-muted">Att {r.attendancePct == null ? "\u2014" : `${r.attendancePct}%`} | Avg {r.avgScore == null ? "\u2014" : `${r.avgScore}%`}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Full Student Table */}
      <div className="overflow-x-auto rounded-card border border-silver-200 bg-white shadow-card">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-silver-100 text-[11px] text-muted">
              <th className="p-3">Student</th>
              <th className="p-3">Batch</th>
              <th className="p-3">Attendance</th>
              <th className="p-3">Tests</th>
              <th className="p-3">Avg Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm font-bold text-muted">No student data in your batches yet.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-silver-100 last:border-0">
                  <td className="p-3"><p className="font-extrabold text-navy-700">{r.name}</p><p className="text-[12px] text-muted">{r.batch}</p></td>
                  <td className="p-3">{r.batch}</td>
                  <td className="p-3">{r.attendancePct == null ? "\u2014" : `${r.attendancePct}%`}</td>
                  <td className="p-3">{r.testsTaken}</td>
                  <td className="p-3 font-bold">{r.avgScore == null ? "\u2014" : `${r.avgScore}%`}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </FacultyShell>
  );
}