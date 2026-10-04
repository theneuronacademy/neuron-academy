"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";

/**
 * Faculty Login — Phase 4: tries real session auth (POST /api/auth/login),
 * falls back to the integration notice when the backend is not configured.
 * FACULTY → /faculty/dashboard. Visual design unchanged.
 */
export default function FacultyLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<"idle" | "submitting" | "notice">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("submitting");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success === true) {
          const role = json.data?.user?.role;
          if (role === "FACULTY" || role === "ADMIN") {
            router.push(role === "ADMIN" ? "/admin/dashboard" : "/faculty/dashboard");
            return;
          }
          setError("This account does not have faculty access.");
          setPhase("idle");
          return;
        }
      } else if (res.status === 401 || res.status === 403) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Incorrect email or password.");
        setPhase("idle");
        return;
      }
    } catch {
      /* fall through to demo notice */
    }
    setTimeout(() => setPhase("notice"), 600);
  }

  return (
    <div className="metallic-dark flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[22px] bg-white shadow-2xl">
        <div className="bg-navy-700 px-6 py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-navy-700"><GraduationCap className="h-6 w-6" /></span>
          <h1 className="mt-3 text-xl font-extrabold text-white">Faculty Login</h1>
          <p className="mt-1 text-[13px] text-silver-200">Neuron Academy • Educator Portal</p>
        </div>
        {phase === "notice" ? (
          <div className="space-y-3 p-6 text-center">
            <p className="mx-auto flex max-w-sm items-start gap-2 rounded-xl bg-navy-50 px-4 py-3 text-left text-[13px] font-semibold text-navy-700">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Faculty authentication connects when the backend is built. Your account will work across the website, faculty app and test platform.
            </p>
            <button onClick={() => setPhase("idle")} className="text-sm font-bold text-teal-600 hover:underline">Back to login</button>
            <Link href="/" className="block text-[13px] font-bold text-muted hover:underline">← Back to Website</Link>
          </div>
        ) : (
          <form
            className="space-y-3 p-6"
            onSubmit={handleSubmit}
          >
            {error ? <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson-DEFAULT" role="alert">{error}</p> : null}
            <div>
              <label htmlFor="fac-id" className="mb-1.5 block text-[12px] font-bold text-navy-700">Email / Faculty ID</label>
              <input id="fac-id" required placeholder="you@neuronacademy.in" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="fac-pw" className="mb-1.5 block text-[12px] font-bold text-navy-700">Password</label>
              <input id="fac-pw" type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={phase === "submitting"}>
              {phase === "submitting" ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : "Login"}
            </Button>
            <Link href="/" className="block text-center text-[13px] font-bold text-teal-600 hover:underline">← Back to Website</Link>
          </form>
        )}
      </div>
    </div>
  );
}
