"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { adminLogin, DEMO_ADMIN } from "@/lib/adminAuth";
import { Button } from "@/components/ui/primitives";

export default function AdminLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(DEMO_ADMIN.email);
  const [password, setPassword] = useState(DEMO_ADMIN.password);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // Phase 4: try real session auth first; fall back to demo login when
      // the database is not configured (503 / network failure).
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier, password }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success === true) {
          if (json.data?.user?.role && json.data.user.role !== "ADMIN") {
            setError("This account is not an admin account.");
            return;
          }
          try {
            window.localStorage.setItem("neuron_admin_auth", "true");
          } catch {
            /* ignore */
          }
          router.push("/admin/dashboard");
          return;
        }
      } else if (res.status === 401 || res.status === 403) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Incorrect email or password.");
        return;
      }
      // 503 / network error → demo fallback (existing behaviour preserved).
    } catch {
      /* demo fallback below */
    } finally {
      setBusy(false);
    }
    if (adminLogin(identifier, password)) {
      router.push("/admin/dashboard");
    } else {
      setError("Invalid credentials. Use the demo credentials below.");
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
          {error ? <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson-DEFAULT" role="alert">{error}</p> : null}
          <div>
            <label htmlFor="admin-id" className="mb-1.5 block text-[12px] font-bold text-navy-700">Email / Admin ID</label>
            <input id="admin-id" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          </div>
          <div>
            <label htmlFor="admin-pw" className="mb-1.5 block text-[12px] font-bold text-navy-700">Password</label>
            <input id="admin-pw" type="password" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-[13px] font-bold text-muted"><input type="checkbox" defaultChecked className="h-4 w-4 accent-[#008C9E]" /> Remember Me</label>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Login"}</Button>
          <p className="rounded-xl bg-silver-50 px-4 py-3 text-[12px] leading-relaxed text-muted">
            Demo (dev only): <br /><span className="font-bold text-navy-700">{DEMO_ADMIN.email} / {DEMO_ADMIN.adminId}</span> • password <span className="font-bold text-navy-700">{DEMO_ADMIN.password}</span>
          </p>
          <Link href="/" className="block text-center text-[13px] font-bold text-teal-600 hover:underline">← Back to Website</Link>
        </form>
      </div>
    </div>
  );
}
