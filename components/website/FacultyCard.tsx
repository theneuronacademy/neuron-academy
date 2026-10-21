"use client";

import { SmartImage } from "@/lib/siteImages";
import type { FacultyMember } from "@/data/faculty";
import { Button } from "@/components/ui/primitives";

export function FacultyCard({ f, onView }: { f: FacultyMember; onView?: (m: FacultyMember) => void }) {
  const subjectColors: Record<string, string> = {
    Physics: "#1AA6B5",
    Biology: "#16A34A",
    Maths: "#D97706",
    Chemistry: "#B4453D",
    General: "#24466D",
  };
  const subjectColor = subjectColors[f.subject] || "#1AA6B5";

  return (
    <article className="card-lift premium-ring shine-sweep group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white border border-slate-100">
      <span className="absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-r from-[{subjectColor}] to-transparent" style={{ "--subjectColor": subjectColor } as React.CSSProperties} aria-hidden />
      <div className="relative h-56 bg-slate-900 overflow-hidden">
        <SmartImage
          src={f.image || `/images/faculty-${f.id}.jpg`}
          alt={`${f.name} — ${f.subject} faculty at Neuron Academy`}
          className="absolute inset-0 h-full w-full"
          imgClassName="h-full w-full object-cover transition duration-700 group-hover:scale-[1.07]"
          fallback={
            <div className="metallic-dark absolute inset-0 flex flex-col items-center justify-center p-5 text-center">
              <span className="wiggle-on-hover flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl font-extrabold text-white ring-1 ring-white/20">
                {f.name.charAt(0)}
              </span>
              <p className="mt-3 text-sm font-extrabold text-white">{f.subject}</p>
              <p className="text-[11px] font-bold tracking-widest text-teal-300">PHOTO COMING SOON</p>
            </div>
          }
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" aria-hidden />
        <span className="absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-widest text-white shadow-card" style={{ backgroundColor: subjectColor }}>
          {f.subject.toUpperCase()}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[15px] font-extrabold tracking-tight text-slate-900">{f.name}</h3>
        <p className="text-[12px] font-bold text-teal-600">{f.designation} • {f.experience}</p>
        <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-slate-600">{f.intro}</p>
        <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => onView?.(f)}>
          View Profile
        </Button>
      </div>
    </article>
  );
}