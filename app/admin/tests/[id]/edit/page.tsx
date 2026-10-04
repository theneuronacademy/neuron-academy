"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { Button } from "@/components/ui/primitives";
import { updateTest } from "@/lib/storage";
import { getTestById } from "@/services/testService";
import type { TestStatus } from "@/lib/testTypes";

const inputCls = "w-full rounded-xl border border-silver-300 bg-white px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none";
const labelCls = "mb-1.5 block text-[12px] font-bold tracking-wide text-navy-700";

export default function EditTestPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const ready = useAdminGuard();
  const router = useRouter();
  const test = getTestById(id);
  const [name, setName] = useState(test?.name ?? "");
  const [desc, setDesc] = useState(test?.description ?? "");
  const [status, setStatus] = useState<TestStatus>(test?.status ?? "draft");
  const [startAt, setStartAt] = useState(test?.startAt ?? "");
  const [endAt, setEndAt] = useState(test?.endAt ?? "");
  const [saved, setSaved] = useState(false);

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;
  if (!test) {
    return (
      <AdminLayout title="Edit Test">
        <p className="rounded-card bg-white p-6 text-sm font-bold text-muted">Test not found. <Link href="/admin/tests" className="text-teal-600 underline">Back</Link></p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`Edit — ${test.name}`} subtitle="Meta + scheduling (questions live under Question Review)">
      {saved ? <p className="mb-4 rounded-xl bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-700" role="status">Saved.</p> : null}
      <div className="max-w-xl space-y-3 rounded-card border border-silver-200 bg-white p-5 shadow-card">
        <div><label className={labelCls} htmlFor="et-name">Test Name</label><input id="et-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className={labelCls} htmlFor="et-desc">Description</label><textarea id="et-desc" rows={3} className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <div>
          <label className={labelCls} htmlFor="et-status">Status</label>
          <select id="et-status" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as TestStatus)}>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="live">Live</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls} htmlFor="et-start">Start</label><input id="et-start" type="datetime-local" className={inputCls} value={startAt} onChange={(e) => setStartAt(e.target.value)} /></div>
          <div><label className={labelCls} htmlFor="et-end">End</label><input id="et-end" type="datetime-local" className={inputCls} value={endAt} onChange={(e) => setEndAt(e.target.value)} /></div>
        </div>
        <Button
          onClick={() => {
            updateTest(id, { name: name.trim() || test.name, description: desc, status, startAt, endAt });
            setSaved(true);
            setTimeout(() => router.push("/admin/tests"), 900);
          }}
        >
          Save Changes
        </Button>
        <Link href={`/admin/tests/${id}/questions`} className="block text-center text-[13px] font-bold text-teal-600 hover:underline">Manage questions →</Link>
      </div>
    </AdminLayout>
  );
}
