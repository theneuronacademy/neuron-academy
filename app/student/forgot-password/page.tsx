"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export default function StudentForgotPasswordPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/student/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: mobile }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true) {
        setSent(true);
        setInfo("If this mobile is registered, an OTP has been sent. It expires in 5 minutes.");
        setCooldown(60);
        return;
      }
      setError(json?.error ?? "Could not send OTP. Please try again.");
    } catch {
      setError("Cannot reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function goToReset() {
    router.push(`/student/reset-password?phone=${encodeURIComponent(mobile)}`);
  }

  return (
    <div className="bg-metallic-dark flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[22px] bg-white shadow-2xl">
        <div className="bg-navy-700 px-6 py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-navy-700"><GraduationCap className="h-6 w-6" /></span>
          <h1 className="mt-3 text-xl font-extrabold text-white">Reset Password</h1>
          <p className="mt-1 text-[13px] text-silver-200">Neuron Academy • Test Platform</p>
        </div>
        <div className="space-y-3 p-6">
          {error ? <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
          {info ? <p className="rounded-xl bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-700" role="status">{info}</p> : null}

          {!sent ? (
            <form className="space-y-3" onSubmit={handleSubmit}>
              <p className="text-[13px] font-semibold text-muted">Enter your registered mobile number to receive a password reset OTP.</p>
              <div>
                <label htmlFor="fp-mobile" className="mb-1.5 block text-[12px] font-bold text-navy-700">Mobile Number</label>
                <input id="fp-mobile" required inputMode="tel" autoComplete="tel" placeholder="e.g. 97119 17317" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" value={mobile} onChange={(e) => setMobile(e.target.value)} />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending OTP…</> : "Send OTP"}
              </Button>
            </form>
          ) : (
            <div className="space-y-3 text-center">
              <p className="text-[13px] font-semibold text-muted">OTP sent to <span className="font-bold text-navy-700">{mobile}</span>.</p>
              <p className="text-[12px] text-muted">Enter the OTP on the next screen to set a new password.</p>
              <Button type="button" size="lg" className="w-full" onClick={goToReset} disabled={busy}>
                Verify OTP & Reset Password
              </Button>
              <button type="button" onClick={() => { setSent(false); setMobile(""); }} className="text-teal-600 hover:underline text-sm font-bold" disabled={busy || cooldown > 0}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
              </button>
            </div>
          )}

          <p className="text-center text-[13px] font-semibold text-muted">
            <Link href="/student/login" className="font-bold text-teal-600 hover:underline">← Back to Login</Link>
          </p>
          <Link href="/" className="block text-center text-[13px] font-bold text-teal-600 hover:underline">← Back to Website</Link>
        </div>
      </div>
    </div>
  );
}