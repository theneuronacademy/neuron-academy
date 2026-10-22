"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Lock, Loader2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingState } from "@/components/admin/AdminStates";
import { Button } from "@/components/ui/primitives";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const { ready: authReady, isAdmin } = useAdminAuth();
  const [ready, setReady] = useState(false);
  const [academy, setAcademy] = useState("Neuron Academy");
  const [phone, setPhone] = useState("+91 97119 17317");
  const [email, setEmail] = useState("neuronacademy23@gmail.com");
  const [saved, setSaved] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!authReady || !isAdmin) return;
    setReady(true);
  }, [router, authReady, isAdmin]);

  if (!ready) {
    return (
      <AdminLayout title="Settings" subtitle="Academy preferences">
        <LoadingState message="Loading settings…" />
      </AdminLayout>
    );
  }

  async function changePassword() {
    setPwErr(null);
    setPwSaved(false);
    if (!currentPassword) {
      setPwErr("Current password is required.");
      return;
    }
    if (!newPassword) {
      setPwErr("New password is required.");
      return;
    }
    if (newPassword.length < 6) {
      setPwErr("New password must be at least 6 characters.");
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch("/api/auth/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true) {
        setPwSaved(true);
        setCurrentPassword("");
        setNewPassword("");
        window.setTimeout(() => setPwSaved(false), 3000);
      } else {
        setPwErr(json?.error ?? "Password change failed.");
      }
    } catch {
      setPwErr("Cannot reach the server.");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <AdminLayout title="Settings" subtitle="Academy profile and preferences">
      {/* No settings API exists; this page is display-only. Academy profile
          is configured via the deployment environment. */}
      <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] font-bold text-amber-800" role="note">
        Display only — academy profile is configured via the deployment environment. Changes here are not saved anywhere.
      </p>
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] font-bold text-amber-700">
          <CheckCircle2 className="h-4 w-4" /> Not saved — contact the developer to change the academy profile.
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <h3 className="text-[15px] font-extrabold text-navy-700">Academy Profile</h3>
          <div className="mt-3 grid gap-3">
            <label className="block text-[12px] font-bold text-navy-700">
              Academy name
              <input value={academy} onChange={(e) => setAcademy(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
            </label>
            <label className="block text-[12px] font-bold text-navy-700">
              Contact phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
            </label>
            <label className="block text-[12px] font-bold text-navy-700">
              Contact email
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
            </label>
          </div>
          <Button variant="primary" size="sm" className="mt-4" onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 2500); }}>
            Save Settings
          </Button>
        </div>
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <h3 className="text-[15px] font-extrabold text-navy-700">Backend Readiness</h3>
          <ul className="mt-3 space-y-2 text-[13px] text-muted">
            <li>• Demo data isolated in <code>data/admin.ts</code></li>
            <li>• API-ready calls in <code>services/adminApi.ts</code></li>
            <li>• Auth hook point: <code>lib/adminAuth.ts</code> + middleware (later)</li>
            <li>• No database / payment in this phase</li>
          </ul>
          <p className="mt-3 rounded-xl bg-silver-50 p-3 text-[12px] text-muted">Swap each adminApi function body with fetch() — UI stays untouched.</p>
        </div>
      </div>

      {/* Password Change */}
      <div className="mt-8 rounded-card border border-silver-200 bg-white p-5 shadow-card">
        <h3 className="text-[15px] font-extrabold text-navy-700 flex items-center gap-2">
          <Lock className="h-4 w-4" /> Change Password
        </h3>
        <p className="mt-1 text-[12px] text-muted">Change your admin account password. Requires current password verification.</p>
        {pwErr ? (
          <p className="mt-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{pwErr}</p>
        ) : null}
        {pwSaved ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Password changed successfully.
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-[12px] font-bold text-navy-700">
            Current password
            <div className="relative mt-1.5">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm outline-none focus:border-teal-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2.5 top-1/2 -mt-2 text-navy-500 hover:text-teal-600"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <label className="block text-[12px] font-bold text-navy-700">
            New password
            <div className="relative mt-1.5">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm outline-none focus:border-teal-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 top-1/2 -mt-2 text-navy-500 hover:text-teal-600"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={pwBusy || !currentPassword || !newPassword}
          onClick={() => void changePassword()}
          className="mt-4 w-auto"
        >
          {pwBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Change Password
        </Button>
        <p className="mt-2 text-[11px] text-muted">Password is hashed with bcrypt before storage. Never stored in plain text.</p>
      </div>
    </AdminLayout>
  );
}
