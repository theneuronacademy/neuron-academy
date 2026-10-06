"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { COURSES } from "@/data/courses";
import { submitEnquiry } from "@/services/siteApi";

const inputCls = "w-full rounded-xl border border-silver-300 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";

type Phase = "idle" | "submitting" | "success" | "error";

export function ContactForm({ admission = false }: { admission?: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [reference, setReference] = useState("");

  if (phase === "success") {
    return (
      <div className="rounded-card border border-teal-100 bg-teal-50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-teal-600" />
        <h3 className="mt-3 text-lg font-extrabold text-navy-700">Enquiry received.</h3>
        <p className="mt-1 text-sm text-muted">Our counsellor will call you shortly.{reference ? ` Ref: ${reference}` : ""}</p>
        <button onClick={() => setPhase("idle")} className="mt-4 text-sm font-bold text-teal-600 hover:underline">Send another enquiry</button>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setPhase("submitting");
        try {
          const res = await submitEnquiry({
            name: String(data.get("name") || ""),
            mobile: String(data.get("mobile") || ""),
            email: String(data.get("email") || ""),
            course: String(data.get("course") || ""),
            message: String(data.get("message") || ""),
          });
          if (res.ok) {
            setReference(res.reference);
            setPhase("success");
          } else {
            setPhase("error");
          }
        } catch {
          setPhase("error");
        }
      }}
      className="grid gap-3 rounded-card border border-silver-200 bg-white p-5 shadow-card sm:p-6"
    >
      {phase === "error" ? (
        <p className="flex items-center gap-2 rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">
          <AlertTriangle className="h-4 w-4" /> Something went wrong. Please try again or call us directly.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required placeholder={admission ? "Student Name *" : "Name *"} className={inputCls} aria-label="Name" />
        <input name="mobile" required placeholder="Mobile *" pattern="[0-9+ ]{10,15}" className={inputCls} aria-label="Mobile" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="email" type="email" placeholder="Email" className={inputCls} aria-label="Email" />
        <select name="course" className={inputCls} aria-label="Course interested in" defaultValue="">
          <option value="" disabled>Course Interested In</option>
          {COURSES.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      {admission ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <select className={inputCls} aria-label="Class or exam" defaultValue="">
            <option value="" disabled>Class / Exam</option>
            <option>Class 9</option>
            <option>Class 10</option>
            <option>Class 11</option>
            <option>Class 12</option>
            <option>Dropper</option>
          </select>
          <select name="batch" className={inputCls} aria-label="Preferred batch" defaultValue="">
            <option value="" disabled>Preferred Batch</option>
            <option>Morning</option>
            <option>Evening</option>
            <option>Weekend</option>
            <option>Online</option>
          </select>
        </div>
      ) : null}
      <textarea name="message" placeholder="Message" rows={4} className={inputCls} aria-label="Message" />
      <Button type="submit" size="lg" className="w-full" disabled={phase === "submitting"}>
        {phase === "submitting" ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : admission ? "Start Your Journey" : "Talk To Neuron Academy"}
      </Button>
      <p className="text-center text-[12px] text-muted">Frontend demo — connects to the backend API later.</p>
    </form>
  );
}
