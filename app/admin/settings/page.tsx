"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingState } from "@/components/admin/AdminStates";
import { Button } from "@/components/ui/primitives";
import { isAdminAuthenticated } from "@/lib/adminAuth";

export default function SettingsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [academy, setAcademy] = useState("Neuron Academy");
  const [phone, setPhone] = useState("+91 97119 17317");
  const [email, setEmail] = useState("hello@neuronacademy.in");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <AdminLayout title="Settings" subtitle="Academy preferences">
        <LoadingState message="Loading settings…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Settings" subtitle="Academy profile and preferences (demo)">
      {/* Phase 17 — no settings API exists; edits here are local-only. */}
      <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] font-bold text-amber-800" role="note">
        Demo only — settings are not saved to the database in this phase.
      </p>
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Settings saved (demo — backend sync later).
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
            Save Settings (demo)
          </Button>
        </div>
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card">
          <h3 className="text-[15px] font-extrabold text-navy-700">Backend Readiness</h3>
          <ul className="mt-3 space-y-2 text-[13px] text-muted">
            <li>• Demo data isolated in <code>data/admin.ts</code></li>
            <li>• API-ready calls in <code>services/adminApi.ts</code></li>
            <li>• Auth hook point: <code>lib/adminAuth.ts</code> + middleware (later)</li>
            <li>• No database / payment / biometric in this phase</li>
          </ul>
          <p className="mt-3 rounded-xl bg-silver-50 p-3 text-[12px] text-muted">Swap each adminApi function body with fetch() — UI stays untouched.</p>
        </div>
      </div>
    </AdminLayout>
  );
}
