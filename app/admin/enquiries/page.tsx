"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminStatusBadge, statusToneFor } from "@/components/admin/AdminStatusBadge";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { SearchBar, FilterBar, AdminToolbar } from "@/components/admin/SearchBar";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getEnquiries } from "@/services/adminApi";
import type { AdminEnquiry, EnquiryStatus } from "@/data/admin";

const STATUSES: EnquiryStatus[] = ["New", "Contacted", "Converted", "Closed"];

export default function EnquiriesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<AdminEnquiry[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      // TODO backend: GET /api/admin/enquiries
      setRows(await getEnquiries());
      setReady(true);
    })();
  }, [router]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => (status === "all" || r.status === status) && (!search.trim() || `${r.name} ${r.phone} ${r.course}`.toLowerCase().includes(search.toLowerCase()))
      ),
    [rows, search, status]
  );

  const changeStatus = (id: string, s: EnquiryStatus) => {
    // TODO backend: PATCH /api/admin/enquiries/:id
    setRows((p) => p.map((x) => (x.id === id ? { ...x, status: s } : x)));
    setSaved(`Enquiry marked as ${s} (demo).`);
    window.setTimeout(() => setSaved(null), 2500);
  };

  if (!ready) {
    return (
      <AdminLayout title="Enquiries" subtitle="Communication → Enquiries">
        <LoadingState message="Loading enquiries…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Enquiries" subtitle="Admission leads from the website contact form">
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-navy-700 ring-1 ring-silver-200">
            {s}: {rows.filter((r) => r.status === s).length}
          </span>
        ))}
      </div>
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search name, phone, course…" />
        <FilterBar value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, ...STATUSES.map((s) => ({ value: s, label: s }))]} />
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="No enquiries" desc="New website enquiries will appear here." />
      ) : (
        <AdminTable<AdminEnquiry>
          columns={[
            {
              key: "n",
              header: "Lead",
              render: (r) => (
                <span>
                  <span className="block font-extrabold text-navy-700">{r.name}</span>
                  <span className="block text-[12px] text-muted">{r.phone} • {r.email}</span>
                </span>
              ),
            },
            { key: "c", header: "Course", render: (r) => r.course },
            { key: "m", header: "Message", render: (r) => <span className="block max-w-xs truncate text-muted" title={r.message}>{r.message}</span> },
            { key: "d", header: "Date", render: (r) => <span className="text-muted">{r.date}</span> },
            {
              key: "s",
              header: "Status",
              render: (r) => (
                <select value={r.status} onChange={(e) => changeStatus(r.id, e.target.value as EnquiryStatus)} aria-label={`Status for ${r.name}`} className="rounded-lg border border-silver-300 bg-white px-2 py-1.5 text-[12px] font-bold text-navy-700 outline-none">
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ),
            },
            { key: "b", header: "Badge", render: (r) => <AdminStatusBadge tone={statusToneFor(r.status)}>{r.status}</AdminStatusBadge> },
          ]}
          rows={filtered}
        />
      )}
    </AdminLayout>
  );
}
