"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { studentLogin, DEMO_STUDENT_LOGIN } from "@/lib/studentAuth";
import { Button } from "@/components/ui/primitives";

export default function StudentLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(DEMO_STUDENT_LOGIN.email);
  const [password, setPassword] = useState(DEMO_STUDENT_LOGIN.password);
  const [name, setName] = useState(DEMO_STUDENT_LOGIN.name);
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
          if (json.data?.user?.role && json.data.user.role !== "STUDENT" && json.data.user.role !== "ADMIN") {
            setError("This account does not have student access.");
            setBusy(false);
            return;
          }
          setBusy(false);
          router.push("/student/dashboard");
          return;
        }
      } else if (res.status === 401 || res.status === 403) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Incorrect email or password.");
        setBusy(false);
        return;
      }
    } catch {
      /* demo fallback below */
    }
    setBusy(false);
    const s = studentLogin(identifier, password, name);
    if (s) router.push("/student/dashboard");
    else setError("Invalid credentials. Use the demo credentials below.");
  }

  return (
    <div className="metallic-dark flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[22px] bg-white shadow-2xl">
        <div className="bg-navy-700 px-6 py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-navy-700"><GraduationCap className="h-6 w-6" /></span>
          <h1 className="mt-3 text-xl font-extrabold text-white">Student Login</h1>
          <p className="mt-1 text-[13px] text-silver-200">Neuron Academy • Test Platform (demo)</p>
        </div>
        <form
          className="space-y-3 p-6"
          onSubmit={handleSubmit}
        >
          {error ? <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson-DEFAULT" role="alert">{error}</p> : null}
          <div>
            <label htmlFor="st-id" className="mb-1.5 block text-[12px] font-bold text-navy-700">Email / Student ID</label>
            <input id="st-id" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          </div>
          <div>
            <label htmlFor="st-name" className="mb-1.5 block text-[12px] font-bold text-navy-700">Display Name (demo)</label>
            <input id="st-name" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="st-pw" className="mb-1.5 block text-[12px] font-bold text-navy-700">Password</label>
            <input id="st-pw" type="password" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Login"}</Button>
          <p className="rounded-xl bg-silver-50 px-4 py-3 text-[12px] leading-relaxed text-muted">
            Demo (anonymous — no real student data): <br />
            <span className="font-bold text-navy-700">{DEMO_STUDENT_LOGIN.email}</span> • password <span className="font-bold text-navy-700">{DEMO_STUDENT_LOGIN.password}</span>
          </p>
          <Link href="/" className="block text-center text-[13px] font-bold text-teal-600 hover:underline">← Back to Website</Link>
        </form>
      </div>
    </div>
  );
}
