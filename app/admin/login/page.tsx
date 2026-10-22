"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export default function AdminLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success === true) {
        router.push("/admin/dashboard");
        return;
      }
      setError(json?.error ?? "Invalid mobile or password.");
    } catch {
      setError("Cannot reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-metallic-dark flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[22px] bg-white shadow-2xl">
        <div className="bg-navy-700 px-6 py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-navy-700"><GraduationCap className="h-6 w-6" /></span>
          <h1 className="mt-3 text-xl font-extrabold text-white">Admin Login</h1>
          <p className="mt-1 text-[13px] text-silver-200">Neuron Academy • Administration</p>
        </div>
        <form
          className="space-y-3 p-6"
          onSubmit={handleSubmit}
        >
          {error ? <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
          <div>
            <label htmlFor="admin-phone" className="mb-1.5 block text-[12px] font-bold text-navy-700">Mobile Number</label>
            <input id="admin-phone" type="tel" autoComplete="tel" placeholder="+91XXXXXXXXXX" className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label htmlFor="admin-password" className="mb-1.5 block text-[12px] font-bold text-navy-700">Password</label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-silver-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -mt-2 text-navy-500 hover:text-teal-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Login"}</Button>
          <Link href="/" className="block text-center text-[13px] font-bold text-teal-600 hover:underline">← Back to Website</Link>
        </form>
      </div>
    </div>
  );
}
