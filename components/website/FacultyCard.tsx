"use client";

import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { SmartImage } from "@/lib/siteImages";
import { initials, portraitPhoto } from "@/lib/displayText";
import type { FacultyMember } from "@/data/faculty";

export function FacultyCard({ f, delay }: { f: FacultyMember; delay?: number }) {
  // Accent by subject family; matched loosely so "CHEMISTRY" and "Chemistry" agree.
  const subject = f.subject.toLowerCase();
  const subjectColor = subject.includes("math") ? "#A98418"
    : subject.includes("bio") || subject.includes("botany") || subject.includes("zoology") ? "#102B70"
    : subject.includes("chem") ? "#1B43B0"
    : subject.includes("phys") || subject.includes("science") ? "#1746B8"
    : "#4D5D75";

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-brand-primary/25 hover:shadow-card-hover">
      <span className="absolute inset-x-0 top-0 z-10 h-1" style={{ background: `linear-gradient(90deg, ${subjectColor}, #D4AF37, transparent)` }} aria-hidden />
      <div className="relative aspect-[4/5] overflow-hidden bg-neutral-900">
        <SmartImage
          src={f.image ? portraitPhoto(f.image) : `/images/faculty-${f.id}.jpg`}
          alt={`${f.name} — ${f.subject} faculty at Neuron Academy`}
          className="absolute inset-0 h-full w-full"
          imgClassName="h-full w-full object-cover object-top transition duration-700 group-hover:scale-[1.04]"
          fallback={
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-navy-950 via-navy-800 to-brand-primary p-5 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-2xl font-bold text-white">
                {initials(f.name)}
              </span>
              <p className="mt-3 text-sm font-extrabold text-white">{f.subject}</p>
              <p className="text-[11px] font-semibold tracking-widest text-brand-secondary-300">FACULTY PROFILE</p>
            </div>
          }
        />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-neutral-900/70 to-transparent" aria-hidden />
        <span className="absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-widest text-white shadow-card" style={{ backgroundColor: subjectColor }}>
          {f.subject.toUpperCase()}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5" style={delay ? { transitionDelay: `${delay * 80}ms` } : undefined}>
        <h3 className="text-base font-bold tracking-tight text-navy-950">{f.name}</h3>
        <p className="mt-0.5 line-clamp-2 text-[12px] font-bold text-brand-primary">{f.designation}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold text-navy-800">
          {f.qualification ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-silver-50 px-2 py-1 ring-1 ring-silver-200">
              <GraduationCap className="h-3 w-3" aria-hidden /> {f.qualification}
            </span>
          ) : null}
          {f.experience ? <span className="rounded-full bg-silver-50 px-2 py-1 ring-1 ring-silver-200">{f.experience}</span> : null}
        </div>
        <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-neutral-600">{f.intro}</p>
        <div className="h-4 shrink-0" aria-hidden />
        {/* View more → dedicated faculty profile page (/faculty/[id]) */}
        <Link
          href={`/faculty/${f.id}`}
          className="mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-brand-primary px-4 py-2.5 text-[13px] font-bold text-brand-primary transition hover:bg-brand-primary/5 active:bg-brand-primary/10"
        >
          View more <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}
