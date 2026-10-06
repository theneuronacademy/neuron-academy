"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";

/**
 * Phase 13 — student registration with production mobile OTP.
 * Flow: mobile → Send OTP (MSG91) → Verify OTP → details → Create Account.
 * When the OTP service is not configured, the legacy single-form flow stays
 * (dev/demo parity). The server enforces OTP whenever MSG91 is configured.
 */
type Step = "mobile" | "otp" | "details";

export default function StudentRegisterPage() {
  const router = useRouter();
  const [otpRequired, setOtpRequired] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>("mobile");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/otp/status", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        setOtpRequired(json?.success === true ? !!json.data?.otpRequired : false);
      } catch {
        setOtpRequired(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendOtp() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: mobile }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true) {
        setStep("otp");
        setCooldown(60);
        setInfo("OTP sent to your mobile. It expires in a few minutes.");
        return;
      }
      if (res.status === 503) {
        setError("OTP service is not configured. Please contact the academy office to register.");
        return;
      }
      setError(json?.error ?? "Could not send OTP. Check the mobile number.");
    } catch {
      setError("Cannot reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: mobile, otp }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true && json.data?.verified === true) {
        setStep("details");
        setInfo("Mobile verified. Complete your details to create the account.");
        return;
      }
      setError(json?.error ?? "Invalid or expired OTP.");
    } catch {
      setError("Cannot reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/student/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: mobile, email, password }),
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
      if (res.status === 428) {
        setStep("mobile");
        setError("Mobile verification expired. Please verify your number again.");
        return;
      }
      setError(json?.error ?? "Registration failed. Check your details and try again.");
    } catch {
      setError("Cannot reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none";
  const labelCls = "mb-1.5 block text-[12px] font-bold text-navy-700";

  return (
    <div className="metallic-dark flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[22px] bg-white shadow-2xl">
        <div className="bg-navy-700 px-6 py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-navy-700"><GraduationCap className="h-6 w-6" /></span>
          <h1 className="mt-3 text-xl font-extrabold text-white">Student Registration</h1>
          <p className="mt-1 text-[13px] text-silver-200">Neuron Academy • Join as a Student</p>
        </div>
        <div className="space-y-3 p-6">
          {error ? <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
          {info ? <p className="rounded-xl bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-700" role="status">{info}</p> : null}

          {otpRequired === null ? (
            <p className="flex items-center justify-center gap-2 py-6 text-sm font-bold text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
          ) : otpRequired === false ? (
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="rg-name" className={labelCls}>Full Name</label>
                <input id="rg-name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className={inputCls} />
              </div>
              <div>
                <label htmlFor="rg-mobile" className={labelCls}>Mobile Number</label>
                <input id="rg-mobile" required inputMode="tel" autoComplete="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="e.g. 97119 17317" className={inputCls} />
              </div>
              <div>
                <label htmlFor="rg-email" className={labelCls}>Email</label>
                <input id="rg-email" required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
              </div>
              <div>
                <label htmlFor="rg-pw" className={labelCls}>Password (min 8 characters)</label>
                <input id="rg-pw" required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</> : "Create Account"}
              </Button>
            </form>
          ) : step === "mobile" ? (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void sendOtp(); }}>
              <p className="text-[13px] font-semibold text-muted">Step 1 of 3 — enter your 10-digit Indian mobile number to receive an OTP.</p>
              <div>
                <label htmlFor="otp-mobile" className={labelCls}>Mobile Number</label>
                <input id="otp-mobile" required inputMode="tel" autoComplete="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="e.g. 98765 43210" className={inputCls} />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending OTP…</> : "Send OTP"}
              </Button>
            </form>
          ) : step === "otp" ? (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void verifyOtp(); }}>
              <p className="text-[13px] font-semibold text-muted">Step 2 of 3 — enter the OTP sent to {mobile}.</p>
              <div>
                <label htmlFor="otp-code" className={labelCls}>One-Time Password</label>
                <input id="otp-code" required inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="6-digit OTP" className={`${inputCls} text-center text-lg font-extrabold tracking-[0.4em]`} />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</> : "Verify OTP"}
              </Button>
              <div className="flex items-center justify-between text-[13px] font-bold">
                <button type="button" onClick={() => setStep("mobile")} className="text-muted hover:underline">← Change number</button>
                <button type="button" onClick={() => void sendOtp()} disabled={busy || cooldown > 0} className="text-teal-600 hover:underline disabled:opacity-50">
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={handleSubmit}>
              <p className="text-[13px] font-semibold text-muted">Step 3 of 3 — mobile verified ✓. Complete your details.</p>
              <div>
                <label htmlFor="rg-name" className={labelCls}>Full Name</label>
                <input id="rg-name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className={inputCls} />
              </div>
              <div>
                <label htmlFor="rg-email" className={labelCls}>Email</label>
                <input id="rg-email" required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
              </div>
              <div>
                <label htmlFor="rg-pw" className={labelCls}>Password (min 8 characters)</label>
                <input id="rg-pw" required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</> : "Create Account"}
              </Button>
            </form>
          )}

          <p className="text-center text-[13px] font-semibold text-muted">
            Already registered? <Link href="/student/login" className="font-bold text-teal-600 hover:underline">Sign in</Link>
          </p>
          <Link href="/" className="block text-center text-[13px] font-bold text-teal-600 hover:underline">← Back to Website</Link>
        </div>
      </div>
    </div>
  );
}
