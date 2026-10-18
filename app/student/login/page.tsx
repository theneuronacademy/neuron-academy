"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { studentLogin } from "@/lib/studentAuth";
import { Button } from "@/components/ui/primitives";
import { Msg91Widget } from "@/components/auth/Msg91Widget";

export default function StudentLoginPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // Phase 10: mobile + password → server session. Dev fallback (no DB)
      // keeps the local demo working; no credentials are shown in the UI.
      const res = await fetch("/api/auth/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: mobile, password }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true) {
        try {
          window.localStorage.setItem(
            "neuron_student_session",
            JSON.stringify({
              studentId: json.data.student.studentId,
              name: json.data.student.name,
              loggedInAt: new Date().toISOString(),
            })
          );
        } catch {
          /* ignore */
        }
        router.push("/student/dashboard");
        return;
      }
      if (res.status === 401 || res.status === 403) {
        setError(json?.error ?? "Invalid mobile number or password.");
        return;
      }
    } catch {
      /* demo fallback below (dev only) */
    } finally {
      setBusy(false);
    }
    const s = studentLogin(mobile, password, "");
    if (s) router.push("/student/dashboard");
    else setError("Invalid mobile number or password.");
  }

  async function handleWidgetSuccess(accessToken: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/widget/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true) {
        try {
          window.localStorage.setItem(
            "neuron_student_session",
            JSON.stringify({
              studentId: json.data.student.studentId,
              name: json.data.student.name,
              loggedInAt: new Date().toISOString(),
            })
          );
        } catch {
          /* ignore */
        }
        router.push("/student/dashboard");
        return;
      }
      if (res.status === 403) {
        setError(json?.error ?? "This account is deactivated. Contact the academy office.");
        return;
      }
      setError(json?.error ?? "Verification failed. Please try again.");
    } catch {
      setError("Cannot reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
      setWidgetOpen(false);
    }
  }

  function handleWidgetError(error: string) {
    setError(error);
    setWidgetOpen(false);
  }

  return (
    <div className="metallic-dark flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[22px] bg-white shadow-2xl">
        <div className="bg-navy-700 px-6 py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-navy-700"><GraduationCap className="h-6 w-6" /></span>
          <h1 className="mt-3 text-xl font-extrabold text-white">Student Login</h1>
          <p className="mt-1 text-[13px] text-silver-200">Neuron Academy • Test Platform</p>
        </div>
        <form
          className="space-y-3 p-6"
          onSubmit={handleSubmit}
        >
          {error ? <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
          <div>
            <label htmlFor="st-id" className="mb-1.5 block text-[12px] font-bold text-navy-700">Mobile Number</label>
            <input id="st-id" inputMode="tel" autoComplete="tel" placeholder="e.g. 97119 17317" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </div>
          <div>
            <label htmlFor="st-pw" className="mb-1.5 block text-[12px] font-bold text-navy-700">Password</label>
            <input id="st-pw" type="password" autoComplete="current-password" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Login"}</Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-silver-300" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted">Or login with</span>
            </div>
          </div>

          {widgetOpen ? (
            <Msg91Widget
              onSuccess={handleWidgetSuccess}
              onError={handleWidgetError}
              onCancel={() => setWidgetOpen(false)}
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => setWidgetOpen(true)}
              disabled={busy}
            >
              Verify with OTP Widget
            </Button>
          )}

          <p className="text-center text-[13px] font-semibold text-muted">
            New student? <Link href="/student/register" className="font-bold text-teal-600 hover:underline">Create an account</Link>
          </p>
          <Link href="/" className="block text-center text-[13px] font-bold text-teal-600 hover:underline">← Back to Website</Link>
        </form>
      </div>
    </div>
  );
}
