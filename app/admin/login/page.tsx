"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export default function AdminLoginPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // Phase 10: mobile number + date of birth → server session.
      const res = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, dob }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true) {
        try {
          window.localStorage.setItem("neuron_admin_auth", "true");
        } catch {
          /* ignore */
        }
        router.push("/admin/dashboard");
        return;
      }
      setError(json?.error ?? "Invalid mobile number or date of birth.");
    } catch {
      setError("Cannot reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="metallic-dark flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[22px] bg-white shadow-2xl">
        <div className="bg-navy-700 px-6 py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-navy-700"><GraduationCap className="h-6 w-6" /></span>
          <h1 className="mt-3 text-xl font-extrabold text-white">Admin Login</h1>
          <p className="mt-1 text-[13px] text-silver-200">Neuron Academy • Advertisement Manager</p>
        </div>
        <form
          className="space-y-3 p-6"
          onSubmit={handleSubmit}
        >
          {error ? <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
          <div>
            <label htmlFor="admin-id" className="mb-1.5 block text-[12px] font-bold text-navy-700">Mobile Number</label>
            <input id="admin-id" inputMode="tel" autoComplete="tel" placeholder="e.g. 97119 17317" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </div>
          <div>
            <label htmlFor="admin-dob" className="mb-1.5 block text-[12px] font-bold text-navy-700">Date of Birth</label>
            <input id="admin-dob" type="date" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-[13px] font-bold text-muted"><input type="checkbox" defaultChecked className="h-4 w-4 accent-[#008C9E]" /> Remember Me</label>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Login"}</Button>
          <Link href="/" className="block text-center text-[13px] font-bold text-teal-600 hover:underline">← Back to Website</Link>
        </form>
      </div>
    </div>
  );
}
