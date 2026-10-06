"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";

/**
 * Faculty Login — Phase 10: mobile + password → server session.
 * FACULTY → /faculty/dashboard. Visual design unchanged.
 */
export default function FacultyLoginPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/faculty/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: mobile, password }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true) {
        router.push("/faculty/dashboard");
        return;
      }
      setError(json?.error ?? "Invalid mobile number or password.");
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
          <h1 className="mt-3 text-xl font-extrabold text-white">Faculty Login</h1>
          <p className="mt-1 text-[13px] text-silver-200">Neuron Academy • Educator Portal</p>
        </div>
        <form
          className="space-y-3 p-6"
          onSubmit={handleSubmit}
        >
          {error ? <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
          <div>
            <label htmlFor="fac-id" className="mb-1.5 block text-[12px] font-bold text-navy-700">Mobile Number</label>
            <input id="fac-id" required inputMode="tel" autoComplete="tel" placeholder="e.g. 97119 17317" value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" />
          </div>
          <div>
            <label htmlFor="fac-pw" className="mb-1.5 block text-[12px] font-bold text-navy-700">Password</label>
            <input id="fac-pw" type="password" required autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : "Login"}
          </Button>
          <p className="text-center text-[13px] font-semibold text-muted">
            New faculty? <Link href="/faculty/register" className="font-bold text-teal-600 hover:underline">Request an account</Link>
          </p>
          <Link href="/" className="block text-center text-[13px] font-bold text-teal-600 hover:underline">← Back to Website</Link>
        </form>
      </div>
    </div>
  );
}
