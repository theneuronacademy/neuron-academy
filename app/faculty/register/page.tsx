"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";

/** Phase 10 — faculty registration (approval-gated, no auto-login). */
export default function FacultyRegisterPage() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/faculty/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: mobile, email, password, subject: subject || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true) {
        setDone(true);
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
    <div className="bg-metallic-dark flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[22px] bg-white shadow-2xl">
        <div className="bg-navy-700 px-6 py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-navy-700"><GraduationCap className="h-6 w-6" /></span>
          <h1 className="mt-3 text-xl font-extrabold text-white">Faculty Registration</h1>
          <p className="mt-1 text-[13px] text-silver-200">Neuron Academy • Educator Onboarding</p>
        </div>
        {done ? (
          <div className="space-y-3 p-6 text-center">
            <p className="mx-auto flex max-w-sm items-start gap-2 rounded-xl bg-teal-50 px-4 py-3 text-left text-[13px] font-semibold text-teal-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              Registration received. Your account will be activated after admin approval — you will then be able to sign in.
            </p>
            <Link href="/faculty/login" className="block text-sm font-bold text-teal-600 hover:underline">Go to login</Link>
            <Link href="/" className="block text-[13px] font-bold text-muted hover:underline">← Back to Website</Link>
          </div>
        ) : (
          <form className="space-y-3 p-6" onSubmit={handleSubmit}>
            {error ? <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
            <div>
              <label htmlFor="fr-name" className={labelCls}>Full Name</label>
              <input id="fr-name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className={inputCls} />
            </div>
            <div>
              <label htmlFor="fr-mobile" className={labelCls}>Mobile Number</label>
              <input id="fr-mobile" required inputMode="tel" autoComplete="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="e.g. 97119 17317" className={inputCls} />
            </div>
            <div>
              <label htmlFor="fr-email" className={labelCls}>Email</label>
              <input id="fr-email" required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
            </div>
            <div>
              <label htmlFor="fr-subject" className={labelCls}>Subject / Expertise (optional)</label>
              <input id="fr-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Physics" className={inputCls} />
            </div>
            <div>
              <label htmlFor="fr-pw" className={labelCls}>Password (min 8 characters)</label>
              <input id="fr-pw" required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : "Request Account"}
            </Button>
            <p className="text-center text-[13px] font-semibold text-muted">
              Already approved? <Link href="/faculty/login" className="font-bold text-teal-600 hover:underline">Sign in</Link>
            </p>
            <Link href="/" className="block text-center text-[13px] font-bold text-teal-600 hover:underline">← Back to Website</Link>
          </form>
        )}
      </div>
    </div>
  );
}
