"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FacultyShell } from "@/components/faculty/FacultyShell";

interface ProfileItem {
  id: string;
  facultyId: string;
  name: string;
  email: string;
  phone: string;
  subject: string | null;
  qualification: string | null;
  status: string;
  batches: Array<{ id: string; name: string }>;
}

export default function FacultyProfilePage() {
  const router = useRouter();
  const [item, setItem] = React.useState<ProfileItem | null>(null);
  const [ready, setReady] = React.useState(false);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [qualification, setQualification] = React.useState("");
  const [experience, setExperience] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await fetch("/api/auth/session", { cache: "no-store" });
      if (!s.ok) { router.replace("/faculty/login"); return; }
      const r = await fetch("/api/faculty/me", { cache: "no-store" });
      if (r.status === 401) { router.replace("/faculty/login"); return; }
      const j = await r.json().catch(() => null);
      if (live && r.ok && j?.success && j.data?.item) {
        const it = j.data.item as ProfileItem;
        setItem(it);
        setName(it.name ?? "");
        setPhone(it.phone ?? "");
        setQualification((it as unknown as { qualification?: string }).qualification ?? "");
      }
      if (live) setReady(true);
    })();
    return () => { live = false; };
  }, [router]);

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(null);
    try {
      const res = await fetch("/api/faculty/me", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, qualification, experience, bio }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || j?.success !== true) { setErr(j?.error ?? "Update failed."); setBusy(false); return; }
      setItem((p) => (p ? { ...p, name, phone, qualification } : p));
      setSaved("Profile updated.");
      window.setTimeout(() => setSaved(null), 2500);
    } catch {
      setErr("Cannot reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !item) {
    return (
      <FacultyShell title="Profile" subtitle="Your faculty profile">
        <p className="rounded-card border border-silver-200 bg-white p-8 text-center text-sm font-bold text-muted">Loading profile</p>
      </FacultyShell>
    );
  }

  const inputCls = "mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500";

  return (
    <FacultyShell title="Profile" subtitle="Manage your public teaching profile">
      {err ? <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{err}</p> : null}
      {saved ? <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">{saved}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <p className="text-[15px] font-extrabold text-navy-700">Account (read-only)</p>
          <div className="mt-3 space-y-2 text-[13px]">
            <p><span className="font-bold text-navy-700">Faculty ID:</span> {item.facultyId}</p>
            <p><span className="font-bold text-navy-700">Email:</span> {item.email}</p>
            <p><span className="font-bold text-navy-700">Subject:</span> {item.subject ?? "—"}</p>
            <p><span className="font-bold text-navy-700">Status:</span> {item.status}</p>
            <p><span className="font-bold text-navy-700">Batches:</span> {item.batches.length ? item.batches.map((b) => b.name).join(", ") : "Unassigned"}</p>
          </div>
          <p className="mt-3 text-[12px] text-muted">Role, email, status and batch assignment are admin-managed.</p>
        </div>
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <p className="text-[15px] font-extrabold text-navy-700">Editable profile</p>
          <div className="mt-3 grid gap-3">
            <label className="block text-[12px] font-bold text-navy-700">Name<input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></label>
            <label className="block text-[12px] font-bold text-navy-700">Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></label>
            <label className="block text-[12px] font-bold text-navy-700">Qualification<input value={qualification} onChange={(e) => setQualification(e.target.value)} className={inputCls} /></label>
            <label className="block text-[12px] font-bold text-navy-700">Experience<input value={experience} onChange={(e) => setExperience(e.target.value)} className={inputCls} /></label>
            <label className="block text-[12px] font-bold text-navy-700">Bio<textarea value={bio} onChange={(e) => setBio(e.target.value)} className={inputCls} rows={3} /></label>
          </div>
          <button onClick={() => void save()} disabled={busy} className="mt-4 w-full rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-60">{busy ? "Saving" : "Save Profile"}</button>
        </div>
      </div>
    </FacultyShell>
  );
}
