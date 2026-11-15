"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, CheckCircle2, AlertTriangle, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { SearchBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { CloudinaryUpload } from "@/components/admin/CloudinaryUpload";
import { StatCard } from "@/components/admin/StatCard";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { formatScore, initials, portraitPhoto, scoreValue, titleCaseName } from "@/lib/displayText";
import { RESULT_PRESETS, resultCategory } from "@/lib/resultLabels";
import { cn } from "@/lib/utils";

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

const EXAMS = ["JEE Main", "JEE Advanced", "NEET", "AMU", "JMI", "CM SHRI", "Others"];
const OTHER = "__other__";

type Status = "LIVE" | "HIDDEN" | "NO_CONSENT";
const STATUS_VIEW: Record<Status, { label: string; tone: string }> = {
  LIVE: { label: "Live on website", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  HIDDEN: { label: "Hidden", tone: "border-silver-300 bg-silver-50 text-neutral-600" },
  NO_CONSENT: { label: "Consent needed", tone: "border-amber-200 bg-amber-50 text-amber-800" },
};

/** What the public card will look like. */
function PreviewCard({ name, score, heading, year, imageUrl, selected }: { name: string; score: string; heading: string; year: string; imageUrl: string; selected: boolean }) {
  return (
    <div className="w-40 overflow-hidden rounded-2xl border border-navy-700 bg-navy-800">
      <div className="relative aspect-[4/5] bg-gradient-to-br from-navy-800 to-brand-primary">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portraitPhoto(imageUrl)} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-white">{initials(name || "Student Name")}</span>
        )}
        {score ? (
          <span className="absolute bottom-2 left-2 rounded-lg bg-brand-secondary px-2 py-0.5 text-sm font-extrabold text-navy-950">{score}</span>
        ) : selected ? (
          <span className="absolute bottom-2 left-2 rounded-lg bg-emerald-500 px-2 py-0.5 text-[12px] font-extrabold text-white">Selected</span>
        ) : null}
      </div>
      <div className="p-2.5">
        <p className="text-[13px] font-extrabold leading-snug text-white">{name || "Student Name"}</p>
        <p className="mt-0.5 text-[10px] font-bold leading-snug text-silver-300">{heading}{year ? ` · ${year}` : ""}</p>
      </div>
    </div>
  );
}

export default function WebResultsPage() {
  const router = useRouter();
  const { ready: authReady, isAdmin } = useAdminAuth();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("ALL");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<Status | "ALL" | "ISSUES">("ALL");
  const [preset, setPreset] = useState<string>(RESULT_PRESETS[0].label);
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

  // Each row with the heading the public sees, its status, and anything that needs fixing.
  const view = useMemo(() => {
    const nameCount = new Map<string, number>();
    const base = rows.map((r) => {
      const cat = resultCategory(r.achievement, r.exam);
      const k = `${cat.key}|${titleCaseName(r.name).toLowerCase()}|${r.year}`;
      nameCount.set(k, (nameCount.get(k) ?? 0) + 1);
      return { r, cat, k };
    });
    return base.map(({ r, cat, k }) => {
      const status: Status = !r.consent ? "NO_CONSENT" : r.active ? "LIVE" : "HIDDEN";
      const issues: string[] = [];
      if (!r.imageUrl.trim()) issues.push("No photo");
      if (cat.kind === "board" && !r.score.trim()) issues.push("No score");
      if (r.score.trim() && cat.kind === "board" && scoreValue(r.score) === null) issues.push("Score is not a number");
      if (!r.year.trim()) issues.push("No year");
      if ((nameCount.get(k) ?? 0) > 1) issues.push("Entered twice");
      return { ...r, id: r.id, cat, status, issues };
    });
  }, [rows]);
  type ViewRow = (typeof view)[number];

  const categories = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const v of view) m.set(v.cat.key, { label: v.cat.label, n: (m.get(v.cat.key)?.n ?? 0) + 1 });
    return [...m.entries()].map(([key, x]) => ({ key, ...x })).sort((a, b) => b.n - a.n);
  }, [view]);
  const years = useMemo(() => [...new Set(view.map((v) => v.year).filter(Boolean))].sort((a, b) => Number(b) - Number(a)), [view]);
  const counts = useMemo(() => ({
    live: view.filter((v) => v.status === "LIVE").length,
    hidden: view.filter((v) => v.status === "HIDDEN").length,
    noConsent: view.filter((v) => v.status === "NO_CONSENT").length,
    issues: view.filter((v) => v.issues.length > 0).length,
  }), [view]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return view
      .filter((v) => catFilter === "ALL" || v.cat.key === catFilter)
      .filter((v) => yearFilter === "ALL" || v.year === yearFilter)
      .filter((v) => statusFilter === "ALL" || (statusFilter === "ISSUES" ? v.issues.length > 0 : v.status === statusFilter))
      .filter((v) => !q || `${v.name} ${v.cat.label} ${v.achievement} ${v.year} ${v.score}`.toLowerCase().includes(q))
      // Same order as the website: by heading, then highest score, then newest year.
      .sort((a, b) => a.cat.label.localeCompare(b.cat.label) || (scoreValue(b.score) ?? -1) - (scoreValue(a.score) ?? -1) || Number(b.year || 0) - Number(a.year || 0));
  }, [view, search, catFilter, yearFilter, statusFilter]);

  const formCat = resultCategory(achievement, exam);

  const openComposer = () => {
    setEditing(null);
    setName("");
    setPreset(RESULT_PRESETS[0].label);
    setAchievement(RESULT_PRESETS[0].achievement);
    setScore("");
    setExam(RESULT_PRESETS[0].exam);
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
    // Keep the entry's own wording unless it is exactly one of the ready-made types.
    setPreset(RESULT_PRESETS.find((p) => p.achievement === r.achievement.trim())?.label ?? OTHER);
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
      setFormError("Student name and result type are required.");
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
      <AdminPageHeader title="Website Results" description="Board scores and entrance selections shown in the results section of the homepage. A result appears on the website only when consent is confirmed and it is set to show." actionLabel="Add Result" actionIcon={Plus} onAction={openComposer} />
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
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Live on website" value={counts.live} sub="Visible on the homepage" icon={Eye} />
        <StatCard label="Hidden" value={counts.hidden} sub="Saved but not shown" icon={EyeOff} accent="navy" />
        <StatCard label="Consent needed" value={counts.noConsent} sub="Cannot be published yet" icon={ShieldAlert} accent={counts.noConsent > 0 ? "crimson" : "navy"} />
        <StatCard label="Need attention" value={counts.issues} sub="Missing photo, score or year" icon={AlertTriangle} accent={counts.issues > 0 ? "crimson" : "navy"} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter by result type">
        {[{ key: "ALL", label: "All results", n: view.length }, ...categories].map((c) => (
          <button key={c.key} onClick={() => setCatFilter(c.key)} aria-pressed={catFilter === c.key} className={cn("rounded-full px-4 py-2 text-[13px] font-bold transition", catFilter === c.key ? "bg-navy-700 text-white" : "border border-silver-300 bg-white text-navy-700 hover:border-teal-500")}>
            {c.label} <span className="opacity-70">({c.n})</span>
          </button>
        ))}
      </div>
      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search name, result type, year…" />
        <label className="flex items-center gap-2 text-[12px] font-bold text-navy-700">
          Year
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="rounded-xl border border-silver-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500">
            <option value="ALL">All</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[12px] font-bold text-navy-700">
          Show
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-xl border border-silver-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500">
            <option value="ALL">Everything</option>
            <option value="LIVE">Live on website</option>
            <option value="HIDDEN">Hidden</option>
            <option value="NO_CONSENT">Consent needed</option>
            <option value="ISSUES">Need attention</option>
          </select>
        </label>
      </AdminToolbar>
      <p className="text-[12px] font-semibold text-muted">Showing {filtered.length} of {view.length}. Rows are listed in the order the website shows them: by result type, highest score first.</p>
      {filtered.length === 0 ? (
        <EmptyState title={view.length === 0 ? "No results yet" : "No results match"} desc={view.length === 0 ? "Add the first verified result." : "Try another filter or search."} />
      ) : (
        <AdminTable<ViewRow>
          columns={[
            {
              key: "n",
              header: "Student",
              render: (r) => (
                <div className="flex items-center gap-3">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={portraitPhoto(r.imageUrl)} alt="" loading="lazy" className="h-12 w-10 shrink-0 rounded-lg border border-silver-200 object-cover object-top" />
                  ) : (
                    <span className="flex h-12 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-[12px] font-extrabold text-navy-700">{initials(r.name)}</span>
                  )}
                  <span className="font-extrabold text-navy-700">{titleCaseName(r.name)}</span>
                </div>
              ),
            },
            {
              key: "a",
              header: "Shown under",
              render: (r) => (
                <span>
                  <span className="block text-[13px] font-bold text-teal-700">{r.cat.label}</span>
                  {r.achievement.replace(/\s+/g, " ").trim().toLowerCase() !== r.cat.label.toLowerCase() ? <span className="block text-[11px] text-muted">Typed as: {r.achievement}</span> : null}
                </span>
              ),
            },
            { key: "s", header: "Score", render: (r) => (r.score.trim() ? <span className="rounded-lg bg-amber-50 px-2 py-1 text-[13px] font-extrabold text-amber-900">{formatScore(r.score)}</span> : r.cat.kind === "entrance" ? <span className="text-[12px] font-bold text-emerald-700">Selected</span> : "—") },
            { key: "y", header: "Year", render: (r) => r.year || "—" },
            {
              key: "st",
              header: "Status",
              render: (r) => (
                <span>
                  <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold", STATUS_VIEW[r.status].tone)}>{STATUS_VIEW[r.status].label}</span>
                  {r.issues.length > 0 ? <span className="mt-1 flex items-center gap-1 text-[11px] font-bold text-crimson"><AlertTriangle className="h-3.5 w-3.5" /> {r.issues.join(", ")}</span> : null}
                </span>
              ),
            },
            {
              key: "x",
              header: "Actions",
              className: "text-right",
              render: (r) => (
                <div className="flex justify-end gap-1.5">
                  <button onClick={() => openEdit(r)} aria-label={`Edit ${r.name}`} title="Edit" className="flex h-10 w-10 items-center justify-center rounded-lg border border-silver-300 text-navy-700 hover:border-teal-500 sm:h-8 sm:w-8">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => void toggleActive(r)} aria-label={r.active ? `Hide ${r.name} from the website` : `Show ${r.name} on the website`} aria-pressed={r.active} title={r.active ? "Hide from website" : "Show on website"} className="flex h-10 items-center gap-1.5 rounded-lg border border-silver-300 px-2.5 text-[12px] font-bold text-navy-700 hover:border-teal-500 sm:h-8">
                    {r.active ? <><EyeOff className="h-4 w-4" /> Hide</> : <><Eye className="h-4 w-4" /> Show</>}
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
            Result type *
            <select
              value={preset}
              onChange={(e) => {
                const v = e.target.value;
                setPreset(v);
                const p = RESULT_PRESETS.find((x) => x.label === v);
                if (p) { setAchievement(p.achievement); setExam(p.exam); } else { setAchievement(""); }
              }}
              className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm"
            >
              {RESULT_PRESETS.map((x) => <option key={x.label} value={x.label}>{x.label}</option>)}
              <option value={OTHER}>Other (type your own)</option>
            </select>
            <span className="mt-1 block text-[11px] font-medium text-muted">Choosing from the list keeps every result under one clean heading on the website.</span>
          </label>
          {preset === OTHER ? (
            <label className="block text-[12px] font-bold text-navy-700">
              Result heading *
              <input value={achievement} onChange={(e) => setAchievement(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm" placeholder="e.g. Scholarship Test Topper" maxLength={80} />
            </label>
          ) : null}
          <label className="block text-[12px] font-bold text-navy-700">
            Score (leave empty for a selection)
            <input value={score} onChange={(e) => setScore(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm" placeholder="e.g. 95.6%" maxLength={40} />
          </label>
          {preset === OTHER ? (
          <label className="block text-[12px] font-bold text-navy-700">
            Exam
            <select value={exam} onChange={(e) => setExam(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm">
              {EXAMS.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </label>
          ) : null}
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
              placeholder="A short note about this result (kept for your records and search engines)."
              className="mt-1.5 w-full resize-y rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm"
            />
          </label>
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-silver-200 bg-silver-50 p-3 sm:col-span-2">
            <PreviewCard name={titleCaseName(name)} score={score.trim() ? formatScore(score) : ""} heading={formCat.label} year={year} imageUrl={imageUrl.trim()} selected={formCat.kind === "entrance"} />
            <div className="min-w-0 flex-1 text-[12px] leading-relaxed text-navy-700">
              <p className="font-bold">How it will look on the website</p>
              <p className="mt-1 text-muted">Shown under the heading <span className="font-bold text-teal-700">{formCat.label}</span>. Names are shown in title case. A portrait photo with the face near the top works best.</p>
              {formCat.kind === "board" && !score.trim() ? <p className="mt-1 font-bold text-crimson">Add the percentage for a board result.</p> : null}
            </div>
          </div>
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