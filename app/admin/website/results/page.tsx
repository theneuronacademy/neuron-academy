"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { SearchBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { CloudinaryUpload } from "@/components/admin/CloudinaryUpload";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface Row {
  id: string;
  name: string;
  achievement: string;
  score: string;
  exam: string;
  year: string;
  description: string;
  imageUrl: string;
  consent: boolean;
  active: boolean;
}

const EXAMS = ["JEE Main", "JEE Advanced", "NEET", "AMU", "JMI"];

export default function WebResultsPage() {
  const router = useRouter();
  const { ready: authReady, isAdmin } = useAdminAuth();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [name, setName] = useState("");
  const [achievement, setAchievement] = useState("");
  const [score, setScore] = useState("");
  const [exam, setExam] = useState(EXAMS[0]);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [publish, setPublish] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady || !isAdmin) return;
    (async () => {
      try {
        const res = await fetch("/api/showcase", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json.data?.items)) {
          setRows(
            (json.data.items as Array<Record<string, unknown>>).map((r) => ({
              id: String(r.id),
              name: String(r.studentName ?? ""),
              achievement: String(r.achievement ?? ""),
              score: String(r.score ?? ""),
              exam: String(r.exam ?? ""),
              year: String(r.year ?? ""),
              description: String(r.description ?? ""),
              imageUrl: String(r.imageUrl ?? ""),
              consent: r.consent === true,
              active: r.isActive === true,
            }))
          );
        } else {
          setPageError(json?.error ?? "Could not load results.");
        }
      } catch {
        setPageError("Cannot reach the server.");
      }
      setReady(true);
    })();
  }, [router, authReady, isAdmin]);

  const filtered = useMemo(() => rows.filter((r) => !search.trim() || `${r.name} ${r.exam}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  const openComposer = () => {
    setEditing(null);
    setName("");
    setAchievement("");
    setScore("");
    setExam(EXAMS[0]);
    setYear(new Date().getFullYear().toString());
    setDescription("");
    setImageUrl("");
    setConsent(false);
    setPublish(false);
    setFormError(null);
    setModal(true);
  };

  // Audit finding: results had no edit flow — admins could not fix a typo,
  // replace a photo or add a description after saving. Edit reuses the same
  // composer modal; consent/publish stay as-saved (separate toggle in table).
  const openEdit = (r: Row) => {
    setEditing(r);
    setName(r.name);
    setAchievement(r.achievement);
    setScore(r.score);
    setExam(r.exam);
    setYear(r.year);
    setDescription(r.description ?? "");
    setImageUrl(r.imageUrl ?? "");
    setConsent(r.consent);
    setPublish(r.active);
    setFormError(null);
    setModal(true);
  };

  const save = async () => {
    if (!name.trim() || !achievement.trim()) {
      setFormError("Student name and achievement are required.");
      return;
    }
    setFormError(null);
    try {
      const payload = {
        studentName: name.trim(),
        achievement: achievement.trim(),
        score: score.trim(),
        exam,
        year: year.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        consent,
        isActive: publish,
      };
      const res = editing
        ? await fetch(`/api/showcase/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            cache: "no-store",
          })
        : await fetch("/api/showcase", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            cache: "no-store",
          });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success !== false && json?.data?.item) {
        const item = json.data.item as Record<string, unknown>;
        const updated: Row = {
          id: String(item.id),
          name: String(item.studentName ?? ""),
          achievement: String(item.achievement ?? ""),
          score: String(item.score ?? ""),
          exam: String(item.exam ?? ""),
          year: String(item.year ?? ""),
          description: String(item.description ?? ""),
          imageUrl: String(item.imageUrl ?? ""),
          consent: item.consent === true,
          active: item.isActive === true,
        };
        setRows((p) => (editing ? p.map((x) => (x.id === updated.id ? updated : x)) : [updated, ...p]));
        setSaved(editing ? "Result updated." : publish ? "Result published to the homepage." : "Draft saved (not public until consent + publish).");
        setModal(false);
      } else {
        setFormError(json?.error ?? `Could not ${editing ? "update" : "add"} result. Nothing was saved.`);
      }
    } catch {
      setFormError("Cannot reach the server. Nothing was saved.");
    }
    window.setTimeout(() => setSaved(null), 2500);
  };

  const toggleActive = async (r: Row) => {
    setPageError(null);
    const next = !r.active;
    try {
      const res = await fetch(`/api/showcase/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success !== false) {
        setRows((p) => p.map((x) => (x.id === r.id ? { ...x, active: next } : x)));
      } else {
        setPageError(json?.error ?? "Could not change visibility.");
      }
    } catch {
      setPageError("Cannot reach the server. Visibility unchanged.");
    }
  };

  const remove = async (r: Row) => {
    if (!window.confirm(`Delete result "${r.name}"?`)) return;
    setPageError(null);
    try {
      const res = await fetch(`/api/showcase/${r.id}`, { method: "DELETE", cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setRows((p) => p.filter((x) => x.id !== r.id));
        setSaved("Result deleted.");
      } else {
        setPageError(json?.error ?? "Could not delete result. Nothing was deleted.");
      }
    } catch {
      setPageError("Cannot reach the server. Nothing was deleted.");
    }
    window.setTimeout(() => setSaved(null), 2500);
  };

  if (!ready) {
    return (
      <AdminLayout title="Web Results" subtitle="Website → Results">
        <LoadingState message="Loading results…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Web Results" subtitle="Selections showcased on the homepage">
      <AdminPageHeader title="Website Results" description="Verified selections for the homepage toppers wall." actionLabel="Add Result" actionIcon={Plus} onAction={openComposer} />
      {pageError ? (
        <p className="rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">
          {pageError}
        </p>
      ) : null}
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search results…" />
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="No results" desc="Publish the first verified selection." />
      ) : (
        <AdminTable<Row>
          columns={[
            { key: "n", header: "Name", render: (r) => <span className="font-extrabold text-navy-700">{r.name}</span> },
            { key: "a", header: "Achievement", render: (r) => <span className="text-[13px] font-bold text-teal-600">{r.achievement}</span> },
            { key: "s", header: "Score", render: (r) => r.score || "—" },
            { key: "e", header: "Exam", render: (r) => r.exam },
            { key: "y", header: "Year", render: (r) => r.year || "—" },
            { key: "c", header: "Consent", render: (r) => <span className="text-[12px] font-bold text-muted">{r.consent ? "Yes" : "No"}</span> },
            {
              key: "x",
              header: "Actions",
              className: "text-right",
              render: (r) => (
                <div className="flex justify-end gap-1.5">
                  <button onClick={() => openEdit(r)} aria-label={`Edit ${r.name}`} title="Edit" className="flex h-10 w-10 items-center justify-center rounded-lg border border-silver-300 text-navy-700 hover:border-teal-500 sm:h-8 sm:w-8">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => void toggleActive(r)}
                    aria-label={`Toggle visibility of ${r.name}`}
                    aria-pressed={r.active}
                  >
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${r.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-silver-200 bg-silver-50 text-muted"}`}>
                      {r.active ? "Active" : "Hidden"}
                    </span>
                  </button>
                  <button onClick={() => void remove(r)} aria-label={`Delete ${r.name}`} title="Delete" className="flex h-10 w-10 items-center justify-center rounded-lg border border-crimson-100 text-crimson hover:bg-crimson-50 sm:h-8 sm:w-8">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ),
            },
          ]}
          rows={filtered}
        />
      )}
      <AdminModal open={modal} title={editing ? "Edit Result" : "Add Result"} onClose={() => setModal(false)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[12px] font-bold text-navy-700">
            Student display name *
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm" placeholder="e.g. Ayan Khan" maxLength={80} />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Achievement *
            <input value={achievement} onChange={(e) => setAchievement(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm" placeholder="e.g. AIR 42" maxLength={80} />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Score / Percentile
            <input value={score} onChange={(e) => setScore(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm" placeholder="99.2 %ile" maxLength={40} />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Exam
            <select value={exam} onChange={(e) => setExam(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm">
              {EXAMS.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Year
            <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm" placeholder="2026" />
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            Photo URL (optional)
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm" placeholder="https://…" />
          </label>
          <CloudinaryUpload
            category="gallery"
            accept="image/jpeg,image/png,image/webp,image/avif"
            resourceType="image"
            label="Result photo"
            buttonLabel={imageUrl ? "Replace photo" : "Upload photo"}
            onUploadComplete={(url) => setImageUrl(url)}
          />
          <label className="block text-[12px] font-bold text-navy-700 sm:col-span-2">
            Description (optional)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={400}
              placeholder="Shown on the toppers wall under the achievement, e.g. “Secured AIR in JEE Advanced on first attempt”…"
              className="mt-1.5 w-full resize-y rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm"
            />
          </label>
          <label className="flex items-start gap-2 rounded-xl border border-silver-200 bg-silver-50 px-3.5 py-2.5 text-[12px] font-bold text-navy-700 sm:col-span-2">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            Consent confirmed — the student/guardian agreed to publish this name{imageUrl.trim() ? " and photo" : ""} on the public website.
          </label>
          <label className="flex items-start gap-2 rounded-xl border border-silver-200 bg-silver-50 px-3.5 py-2.5 text-[12px] font-bold text-navy-700 sm:col-span-2">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="mt-0.5" />
            Publish immediately (requires consent above — enforced by the server).
          </label>
          {formError ? (
            <p className="rounded-xl bg-crimson-50 px-3.5 py-2.5 text-[13px] font-bold text-crimson sm:col-span-2" role="alert">{formError}</p>
          ) : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => void save()}>
            Save
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}