"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") || "";
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!otp || otp.length < 4) {
      setError("Enter the OTP.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/student/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp, password }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true && json.data?.reset === true) {
        router.push("/student/login");
        return;
      }
      if (res.status === 400) {
        setError(json?.error ?? "Invalid or expired OTP.");
        return;
      }
      if (res.status === 409) {
        setError(json?.error ?? "This OTP has already been used. Request a new one.");
        return;
      }
      if (res.status === 429) {
        setError(json?.error ?? "Too many wrong attempts. Request a new OTP.");
        return;
      }
      setError(json?.error ?? "Password reset failed. Please try again.");
    } catch {
      setError("Cannot reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!phone) {
    return (
      <div className="metallic-dark flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md overflow-hidden rounded-[22px] bg-white shadow-2xl">
          <div className="bg-navy-700 px-6 py-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-navy-700"><GraduationCap className="h-6 w-6" /></span>
            <h1 className="mt-3 text-xl font-extrabold text-white">Reset Password</h1>
            <p className="mt-1 text-[13px] text-silver-200">Neuron Academy • Test Platform</p>
          </div>
          <div className="p-6 text-center">
            <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson">Missing phone parameter. Please start from the forgot password page.</p>
            <Link href="/student/forgot-password" className="mt-4 block text-teal-600 hover:underline font-bold">Go to Forgot Password</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="metallic-dark flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[22px] bg-white shadow-2xl">
        <div className="bg-navy-700 px-6 py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-navy-700"><GraduationCap className="h-6 w-6" /></span>
          <h1 className="mt-3 text-xl font-extrabold text-white">Reset Password</h1>
          <p className="mt-1 text-[13px] text-silver-200">Neuron Academy • Test Platform</p>
        </div>
        <form className="space-y-3 p-6" onSubmit={handleSubmit}>
          {error ? <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
          <p className="text-[13px] font-semibold text-muted">Enter the OTP sent to <span className="font-bold text-navy-700">{phone}</span> and your new password.</p>
          <div>
            <label htmlFor="rp-otp" className="mb-1.5 block text-[12px] font-bold text-navy-700">One-Time Password</label>
            <input id="rp-otp" required inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="6-digit OTP" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm text-center text-lg font-extrabold tracking-[0.4em] focus:border-teal-500 focus:outline-none" />
          </div>
          <div>
            <label htmlFor="rp-pw" className="mb-1.5 block text-[12px] font-bold text-navy-700">New Password (min 8 characters)</label>
            <input id="rp-pw" required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" />
          </div>
          <div>
            <label htmlFor="rp-cpw" className="mb-1.5 block text-[12px] font-bold text-navy-700">Confirm New Password</label>
            <input id="rp-cpw" required type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Resetting…</> : "Reset Password"}
          </Button>

          <p className="text-center text-[13px] font-semibold text-muted">
            <Link href="/student/forgot-password" className="font-bold text-teal-600 hover:underline">← Resend OTP</Link>
          </p>
          <p className="text-center text-[13px] font-semibold text-muted">
            <Link href="/student/login" className="font-bold text-teal-600 hover:underline">Back to Login</Link>
          </p>
          <Link href="/" className="block text-center text-[13px] font-bold text-teal-600 hover:underline">← Back to Website</Link>
        </form>
      </div>
    </div>
  );
}

export default function StudentResetPasswordPage() {
  return (
    <Suspense fallback={<div className="metallic-dark flex min-h-screen items-center justify-center p-4"><div className="w-full max-w-md overflow-hidden rounded-[22px] bg-white shadow-2xl"><div className="bg-navy-700 px-6 py-6 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-navy-700"><GraduationCap className="h-6 w-6" /></span><h1 className="mt-3 text-xl font-extrabold text-white">Reset Password</h1><p className="mt-1 text-[13px] text-silver-200">Neuron Academy • Test Platform</p></div><div className="p-6 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-teal-600" /></div></div></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}