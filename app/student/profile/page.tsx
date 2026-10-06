"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { useStudentGuard } from "@/components/student/useStudentGuard";
import { useStudentProfile, type StudentProfile } from "@/components/student/useStudentProfile";
import { Skeleton } from "@/components/student/charts";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const inputCls = "w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none disabled:bg-silver-50 disabled:text-muted";
const labelCls = "mb-1.5 block text-[12px] font-bold text-navy-700";

/** Phase 14 — own profile (view + allowlisted edit + photo upload). */
export default function StudentProfilePage() {
  const session = useStudentGuard();
  const { profile, loading } = useStudentProfile();
  const [form, setForm] = useState<Partial<StudentProfile> | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;
  if (loading) {
    return (
      <StudentShell title="My Profile" subtitle="Your identity with the academy">
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </StudentShell>
    );
  }
  if (!profile) {
    return (
      <StudentShell title="My Profile">
        <p className="rounded-card bg-white p-8 text-center text-sm font-bold text-muted">Profile not found. Contact the academy office.</p>
      </StudentShell>
    );
  }
  const cur = { ...profile, ...(form ?? {}) };
  const set = (k: keyof StudentProfile, v: string) => setForm((f) => ({ ...(f ?? {}), [k]: v }));

  async function save() {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const body: Record<string, unknown> = {};
      for (const k of ["name", "gender", "address", "city", "school", "className", "parentName", "parentMobile"] as const) {
        if (form?.[k] !== undefined && form?.[k] !== profile?.[k]) body[k] = form?.[k];
      }
      if (Object.keys(body).length === 0) {
        setError("No changes to save.");
        return;
      }
      const res = await fetch("/api/students/me/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setError(json?.error ?? "Could not save.");
        return;
      }
      setForm(null);
      setSaved(true);
      window.setTimeout(() => window.location.reload(), 800);
    } catch {
      setError("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(file: File) {
    setError(null);
    setPhotoBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/students/me/photo", { method: "POST", body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        setError(json?.error ?? "Upload failed.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Cannot reach the server.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setError(null);
    setPhotoBusy(true);
    try {
      const res = await fetch("/api/students/me/photo", { method: "DELETE" });
      if (!res.ok) {
        setError("Could not remove the photo.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Cannot reach the server.");
    } finally {
      setPhotoBusy(false);
    }
  }

  const lockedNote = <span className="ml-2 text-[11px] font-bold text-muted">(Contact admin to update)</span>;

  return (
    <StudentShell title="My Profile" subtitle={`${profile.studentType === "SCHOLARSHIP" ? "Scholarship" : "Regular"} student • ${profile.studentId}`}>
      {error ? <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
      {saved ? <p className="mb-3 rounded-xl bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-700" role="status">Saved.</p> : null}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* PHOTO CARD */}
        <div className="h-fit rounded-card border border-silver-200 bg-white p-6 text-center shadow-card">
          <div className="relative mx-auto h-32 w-32">
            {cur.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cur.photoUrl} alt={`${cur.name} profile photo`} className="h-32 w-32 rounded-full border-4 border-teal-100 object-cover" />
            ) : (
              <span className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-navy-700 to-teal-600 text-4xl font-extrabold text-white">
                {cur.name.charAt(0).toUpperCase()}
              </span>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
              aria-label="Upload profile photo"
              className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-navy-700 text-white shadow-card transition hover:bg-teal-600 disabled:opacity-60"
            >
              {photoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Choose photo" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); e.target.value = ""; }} />
          <p className="mt-3 text-lg font-extrabold text-navy-700">{cur.name}</p>
          <p className={cn("mt-1 inline-block rounded-full px-3 py-1 text-[11px] font-extrabold tracking-widest", profile.studentType === "SCHOLARSHIP" ? "bg-amber-50 text-amber-700" : "bg-teal-50 text-teal-700")}>
            {profile.studentType === "SCHOLARSHIP" ? "SCHOLARSHIP STUDENT" : "REGULAR STUDENT"}
          </p>
          <div className="mt-4 grid gap-2">
            <Button size="sm" variant="outline" className="w-full" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
              {cur.photoUrl ? "Replace photo" : "Upload photo"}
            </Button>
            {cur.photoUrl ? (
              <button onClick={() => void removePhoto()} disabled={photoBusy} className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold text-crimson hover:bg-crimson-50 disabled:opacity-60">
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] text-muted">JPG / PNG / WebP • under 2 MB</p>
        </div>

        {/* DETAILS */}
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-[15px] font-extrabold text-navy-700">Personal Information</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className={labelCls} htmlFor="pf-name">Full Name</label><input id="pf-name" className={inputCls} value={cur.name ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
            <div>
              <label className={labelCls} htmlFor="pf-gender">Gender</label>
              <select id="pf-gender" className={inputCls} value={cur.gender ?? ""} onChange={(e) => set("gender", e.target.value)}>
                <option value="">Select…</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select>
            </div>
            <div className="sm:col-span-2"><label className={labelCls} htmlFor="pf-address">Address</label><input id="pf-address" className={inputCls} value={cur.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="House, street, area" /></div>
            <div><label className={labelCls} htmlFor="pf-city">City</label><input id="pf-city" className={inputCls} value={cur.city ?? ""} onChange={(e) => set("city", e.target.value)} /></div>
            <div><label className={labelCls} htmlFor="pf-school">School</label><input id="pf-school" className={inputCls} value={cur.school ?? ""} onChange={(e) => set("school", e.target.value)} /></div>
            <div><label className={labelCls} htmlFor="pf-class">Class</label><input id="pf-class" className={inputCls} value={cur.className ?? ""} onChange={(e) => set("className", e.target.value)} placeholder="e.g. XI, XII, Dropper" /></div>
            <div><label className={labelCls} htmlFor="pf-pname">Parent Name</label><input id="pf-pname" className={inputCls} value={cur.parentName ?? ""} onChange={(e) => set("parentName", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={labelCls} htmlFor="pf-pmobile">Parent Mobile</label><input id="pf-pmobile" className={inputCls} value={cur.parentMobile ?? ""} onChange={(e) => set("parentMobile", e.target.value)} inputMode="tel" /></div>
          </div>

          <h2 className="mt-6 text-[15px] font-extrabold text-navy-700">Academy Records (read-only)</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><span className={labelCls}>Mobile{lockedNote}</span><input disabled className={inputCls} value={cur.phone} /></div>
            <div><span className={labelCls}>Email{lockedNote}</span><input disabled className={inputCls} value={cur.email} /></div>
            <div><span className={labelCls}>Date of Birth</span><input disabled className={inputCls} value={cur.dob ? new Date(cur.dob).toLocaleDateString() : "—"} /></div>
            <div><span className={labelCls}>Enrollment Date</span><input disabled className={inputCls} value={cur.enrollmentDate ? new Date(cur.enrollmentDate).toLocaleDateString() : "—"} /></div>
            <div><span className={labelCls}>Batch</span><input disabled className={inputCls} value={cur.batch?.name ?? "Not assigned"} /></div>
            <div><span className={labelCls}>Course</span><input disabled className={inputCls} value={cur.course?.name ?? "—"} /></div>
          </div>

          <Button onClick={() => void save()} disabled={busy} size="lg" className="mt-5 w-full sm:w-auto">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save Changes"}
          </Button>
        </div>
      </div>
    </StudentShell>
  );
}
