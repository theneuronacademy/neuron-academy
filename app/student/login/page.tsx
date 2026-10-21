"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { Msg91Widget } from "@/components/auth/Msg91Widget";

type LoginMode = "password" | "otp";

export default function StudentLoginPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<LoginMode>("password");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const widgetConfigured = Boolean(
    process.env.NEXT_PUBLIC_MSG91_WIDGET_ID && process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN,
  );

  function finishLogin(student: { studentId: string; name: string }) {
    try {
      window.localStorage.setItem(
        "neuron_student_session",
        JSON.stringify({ studentId: student.studentId, name: student.name, loggedInAt: new Date().toISOString() }),
      );
    } catch {
      /* The server session cookie remains authoritative. */
    }
    router.push("/student/dashboard");
  }

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: mobile, password }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true && json.data?.student) {
        finishLogin(json.data.student);
        return;
      }
      setError(json?.error ?? "Sign-in could not be completed. Please try again.");
    } catch {
      setError("Cannot reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleWidgetSuccess(accessToken: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/widget/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, purpose: "LOGIN" }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true && json.data?.student) {
        finishLogin(json.data.student);
        return;
      }
      if (res.status === 404) {
        setError("No student account is linked to this number yet. Create an account to continue.");
        return;
      }
      setError(json?.error ?? "OTP sign-in could not be completed. Please try again.");
    } catch {
      setError("Cannot reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function changeMode(next: LoginMode) {
    setMode(next);
    setError(null);
  }

  return (
    <div className="bg-metallic-dark flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[22px] bg-white shadow-2xl">
        <div className="bg-navy-700 px-6 py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-navy-700"><GraduationCap className="h-6 w-6" /></span>
          <h1 className="mt-3 text-xl font-extrabold text-white">Student Login</h1>
          <p className="mt-1 text-[13px] text-silver-200">Neuron Academy • Student Portal</p>
        </div>
        <div className="space-y-4 p-6">
          {widgetConfigured ? (
            <div className="grid grid-cols-2 rounded-xl bg-silver-100 p-1" role="tablist" aria-label="Sign-in method">
              <button type="button" role="tab" aria-selected={mode === "password"} onClick={() => changeMode("password")} className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${mode === "password" ? "bg-white text-navy-700 shadow-sm" : "text-slate-500 hover:text-navy-700"}`}>
                Password
              </button>
              <button type="button" role="tab" aria-selected={mode === "otp"} onClick={() => changeMode("otp")} className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${mode === "otp" ? "bg-white text-navy-700 shadow-sm" : "text-slate-500 hover:text-navy-700"}`}>
                OTP
              </button>
            </div>
          ) : null}

          {error ? <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}

          {mode === "password" ? (
            <form className="space-y-3" onSubmit={handlePasswordSubmit}>
              <div>
                <label htmlFor="st-id" className="mb-1.5 block text-[12px] font-bold text-navy-700">Mobile Number</label>
                <input id="st-id" required inputMode="tel" autoComplete="tel" placeholder="e.g. 98765 43210" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-navy-500 focus:outline-none" value={mobile} onChange={(event) => setMobile(event.target.value)} />
              </div>
              <div>
                <label htmlFor="st-pw" className="mb-1.5 block text-[12px] font-bold text-navy-700">Password</label>
                <input id="st-pw" required type="password" autoComplete="current-password" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-navy-500 focus:outline-none" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
            </form>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="st-otp-mobile" className="mb-1.5 block text-[12px] font-bold text-navy-700">Mobile Number</label>
                <input id="st-otp-mobile" inputMode="tel" autoComplete="tel" placeholder="e.g. 98765 43210" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-navy-500 focus:outline-none" value={mobile} onChange={(event) => setMobile(event.target.value)} />
              </div>
              <Msg91Widget identifier={mobile} onSuccess={handleWidgetSuccess} onError={setError} />
            </div>
          )}

          {mode === "password" ? (
            <p className="text-center text-[13px] font-semibold text-muted">
              <Link href="/student/forgot-password" className="font-bold text-navy-700 hover:underline">Forgot Password?</Link>
            </p>
          ) : null}
          <p className="text-center text-[13px] font-semibold text-muted">
            New student? <Link href="/student/register" className="font-bold text-navy-700 hover:underline">Create an account</Link>
          </p>
          <Link href="/" className="block text-center text-[13px] font-bold text-navy-700 hover:underline">← Back to Website</Link>
        </div>
      </div>
    </div>
  );
}
