"use client";

import Link from "next/link";
import { FileUp, PencilLine, Sparkles } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminGuard } from "@/components/admin/useAdminGuard";

export default function NewTestPage() {
  useAdminGuard();
  return (
    <AdminLayout title="Create Test" subtitle="Choose how to build this test">
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/tests/from-pdf"
          className="card-lift premium-ring group rounded-card bg-white p-6 sm:p-8"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-card">
            <FileUp className="h-6 w-6" />
          </span>
          <p className="mt-4 inline-block rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">RECOMMENDED • PRIMARY</p>
          <h2 className="mt-2 text-xl font-extrabold tracking-tight text-navy-700">Create Test From PDF</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Upload a question paper → real text extraction → review & correct → generate → publish. Demo mode included if no PDF is handy.
          </p>
          <span className="btn-metallic-sheen mt-5 inline-block rounded-xl bg-crimson-DEFAULT px-5 py-2.5 text-sm font-bold text-white">
            <Sparkles className="mr-1 inline h-4 w-4" />Start From PDF →
          </span>
        </Link>
        <Link href="/admin/question-bank" className="card-lift rounded-card border border-silver-200 bg-white p-6 shadow-card sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-700 text-white">
            <PencilLine className="h-6 w-6" />
          </span>
          <p className="mt-4 inline-block rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-bold text-navy-700">MANUAL</p>
          <h2 className="mt-2 text-xl font-extrabold tracking-tight text-navy-700">Create Manually</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Pick questions from the Question Bank, set duration & marks, generate and publish. Works with the 20 seeded Percentage questions today.
          </p>
          <span className="mt-5 inline-block rounded-xl border border-silver-300 px-5 py-2.5 text-sm font-bold text-navy-700">Open Question Bank →</span>
        </Link>
      </div>
      <p className="mt-4 rounded-card border border-silver-200 bg-white p-4 text-[13px] text-muted">
        Questions are automatically extracted and should be reviewed before publishing. Answers are never invented — missing answers are flagged “Answer Required”.
      </p>
    </AdminLayout>
  );
}
