// Faculty Gradebook Page - Weighted grade calculations with charts
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Settings, BarChart3, TrendingUp, Award } from "lucide-react";
import { FacultyShell } from "@/components/faculty/FacultyShell";
import { useGradebook, useGradebookConfig, useSaveGradebookConfig, useExportGradebook, useFacultyBatches } from "@/lib/faculty-hooks";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  weight: number;
  color: string;
}

interface GradebookEntry {
  studentId: string;
  studentName: string;
  categoryScores: Record<string, number>;
  finalGrade: number;
  letterGrade: string;
}

export default function FacultyGradebookPage() {
  const router = useRouter();
  const { data: batches } = useFacultyBatches();
  const [batchId, setBatchId] = useState("");
  const [configModal, setConfigModal] = useState(false);
  const [categories, setCategories] = useState<Category[]>([
    { id: "attendance", name: "Attendance", weight: 15, color: "#10B981" },
    { id: "assignments", name: "Assignments", weight: 25, color: "#3B82F6" },
    { id: "tests", name: "Tests", weight: 40, color: "#8B5CF6" },
    { id: "participation", name: "Participation", weight: 20, color: "#F59E0B" },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");

  const { data: gradebookData, isLoading, refetch } = useGradebook(batchId);
  const { data: config } = useGradebookConfig(batchId);
  const saveConfigMut = useSaveGradebookConfig({ onSuccess: () => { setConfigModal(false); refetch(); } });
  const exportMut = useExportGradebook();

  useEffect(() => {
    if (batches?.length && !batchId) setBatchId(batches[0].id);
  }, [batches, batchId]);

  useEffect(() => {
    if (config?.categories) {
      setCategories(config.categories as Category[]);
    }
  }, [config]);

  const entries = gradebookData?.entries ?? [];
  const activeCategories = gradebookData?.categories ?? categories;

  function handleSaveConfig() {
    const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      setErr("Category weights must sum to 100%");
      return;
    }
    setErr(null);
    saveConfigMut.mutate({ batchId, categories });
  }

  function handleExport() {
    exportMut.mutate({ batchId, format: exportFormat });
  }

  function getLetterGradeColor(grade: string) {
    if (grade.startsWith("A")) return "text-emerald-700 bg-emerald-50";
    if (grade.startsWith("B")) return "text-blue-700 bg-blue-50";
    if (grade.startsWith("C")) return "text-amber-700 bg-amber-50";
    return "text-crimson bg-crimson-50";
  }

  // Chart data for category averages
  const categoryAverages = activeCategories.map((cat) => {
    const scores = entries.map((e) => e.categoryScores[cat.id] ?? 0).filter((s) => s > 0);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { name: cat.name, average: Math.round(avg * 10) / 10, color: cat.color };
  });

  // Grade distribution
  const gradeDistribution = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "F"].map((grade) => ({
    grade,
    count: entries.filter((e) => e.letterGrade === grade).length,
  }));

  if (isLoading) {
    return (
      <FacultyShell title="Gradebook" subtitle="Weighted grades & analytics">
        <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading gradebook…</p>
      </FacultyShell>
    );
  }

  if (!batchId) {
    return (
      <FacultyShell title="Gradebook" subtitle="Select a batch to view grades">
        <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No batches assigned yet.</p>
      </FacultyShell>
    );
  }

  return (
    <FacultyShell title="Gradebook" subtitle={`Weighted grades for ${batches?.find((b) => b.id === batchId)?.name ?? "batch"}`}>
      {err && <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{err}</p>}

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-[13px] font-bold text-navy-700">
          {batches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as "csv" | "pdf")} className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-[13px] font-bold text-navy-700">
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
          <button onClick={handleExport} disabled={exportMut.isPending} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60 flex items-center gap-2">
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
        <button onClick={() => setConfigModal(true)} className="rounded-xl border border-silver-300 px-4 py-2 text-sm font-bold text-navy-700 hover:border-teal-500 flex items-center gap-2">
          <Settings className="h-4 w-4" /> Categories
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <div className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold tracking-widest text-muted">STUDENTS</p>
          <p className="mt-1 text-3xl font-extrabold text-navy-700">{entries.length}</p>
        </div>
        <div className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold tracking-widest text-muted">CLASS AVERAGE</p>
          <p className="mt-1 text-3xl font-extrabold text-navy-700">
            {entries.length > 0 ? Math.round((entries.reduce((a, b) => a + b.finalGrade, 0) / entries.length) * 10) / 10 : 0}%
          </p>
        </div>
        <div className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold tracking-widest text-muted">HIGHEST</p>
          <p className="mt-1 text-3xl font-extrabold text-emerald-700">
            {entries.length > 0 ? Math.max(...entries.map((e) => e.finalGrade)) : 0}%
          </p>
        </div>
        <div className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold tracking-widest text-muted">LOWEST</p>
          <p className="mt-1 text-3xl font-extrabold text-crimson">
            {entries.length > 0 ? Math.min(...entries.map((e) => e.finalGrade)) : 0}%
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        {/* Category Averages Bar Chart */}
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[15px] font-extrabold text-navy-700 flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Category Averages</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryAverages} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(value: any) => [`${value ?? 0}%`, "Average"]} />
                <Bar dataKey="average" radius={[0, 4, 4, 0]}>
                  {categoryAverages.map((_, i) => <Cell key={`cell-${i}`} fill={categoryAverages[i].color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grade Distribution */}
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <p className="text-[15px] font-extrabold text-navy-700 mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Grade Distribution</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="grade" tick={{ fontSize: 11 }} width={50} />
                <Tooltip formatter={(value: any) => [`${value ?? 0} students`, "Count"]} />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 0, 0, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Student Table */}
      <div className="rounded-card border border-silver-200 bg-white shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-silver-100 bg-silver-50 text-[11px] text-muted">
                <th className="p-3 sticky left-0 bg-silver-50 z-10">Student</th>
                {activeCategories.map((cat) => (
                  <th key={cat.id} className="p-3 text-right" style={{ color: cat.color }}>
                    {cat.name} ({cat.weight}%)
                  </th>
                ))}
                <th className="p-3 text-right font-bold">Final</th>
                <th className="p-3 text-center font-bold">Grade</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={activeCategories.length + 3} className="p-8 text-center text-muted">No students in this batch yet.</td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.studentId} className="border-b border-silver-100 last:border-0 hover:bg-silver-50">
                    <td className="p-3 sticky left-0 bg-white z-10">
                      <p className="font-extrabold text-navy-700">{entry.studentName}</p>
                      <p className="text-[11px] text-muted">{entry.studentId}</p>
                    </td>
                    {activeCategories.map((cat) => (
                      <td key={cat.id} className="p-3 text-right font-bold" style={{ color: cat.color }}>
                        {entry.categoryScores[cat.id] ?? 0}%
                      </td>
                    ))}
                    <td className="p-3 text-right font-extrabold text-navy-700">{entry.finalGrade}%</td>
                    <td className="p-3 text-center">
                      <span className={cn("inline-block rounded-full px-2.5 py-1 text-[11px] font-extrabold", getLetterGradeColor(entry.letterGrade))}>
                        {entry.letterGrade}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Config Modal */}
      {configModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setConfigModal(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold text-navy-700">Gradebook Categories</h2>
            <p className="mt-1 text-sm text-muted">Weights must sum to 100%</p>
            {err && <p className="mt-3 rounded-xl bg-crimson-50 px-3 py-2 text-[13px] font-bold text-crimson">{err}</p>}
            <div className="mt-4 space-y-3" id="category-list">
              {categories.map((cat, idx) => (
                <div key={cat.id} className="flex items-center gap-2">
                  <input type="color" value={cat.color} onChange={(e) => setCategories((c) => c.map((x, i) => i === idx ? { ...x, color: e.target.value } : x))} className="w-8 h-8 rounded border" />
                  <input value={cat.name} onChange={(e) => setCategories((c) => c.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} className="flex-1 rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" placeholder="Category name" />
                  <input type="number" value={cat.weight} onChange={(e) => setCategories((c) => c.map((x, i) => i === idx ? { ...x, weight: Number(e.target.value) } : x))} min="0" max="100" className="w-20 rounded-xl border border-silver-300 px-3 py-2 text-sm text-right outline-none focus:border-teal-500" />
                  <span className="text-muted">%</span>
                  {categories.length > 1 && (
                    <button onClick={() => setCategories((c) => c.filter((_, i) => i !== idx))} className="text-crimson hover:underline text-sm">Remove</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setCategories((c) => [...c, { id: crypto.randomUUID(), name: "", weight: 0, color: "#6366F1" }])} className="mt-3 w-full rounded-xl border border-silver-300 px-4 py-2 text-sm font-bold text-navy-700 hover:border-teal-500">+ Add Category</button>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfigModal(false)} className="rounded-xl border border-silver-300 px-4 py-2 text-sm font-bold text-navy-700 hover:border-teal-500">Cancel</button>
              <button onClick={handleSaveConfig} disabled={saveConfigMut.isPending} className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-60">
                {saveConfigMut.isPending ? "Saving…" : "Save Categories"}
              </button>
            </div>
          </div>
        </div>
      )}
    </FacultyShell>
  );
}