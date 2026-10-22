"use client";

import { Clock, MonitorPlay, ArrowRight, CheckCircle2 } from "lucide-react";
import { SmartImage } from "@/lib/siteImages";
import { CONTACT } from "@/data/contact";
import type { Course } from "@/data/courses";

export function CourseCard({ course, index = 0, onDetails }: { course: Course; index?: number; onDetails?: (c: Course) => void }) {
  const accent = course.accent || "#1746B8";
  const categoryColors: Record<string, string> = {
    Engineering: "#1746B8",
    Medical: "#102B70",
    "University Entrance": "#A98418",
    Foundation: "#4D5D75",
  };
  const categoryColor = categoryColors[course.category] || "#1746B8";

  return (
    <article
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-brand-primary/25 hover:shadow-card-hover"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <span className="absolute inset-x-0 top-0 z-10 h-1" style={{ background: `linear-gradient(90deg, ${accent}, ${categoryColor}, transparent)` }} aria-hidden />
      <div className="relative h-44 overflow-hidden bg-neutral-900">
        <SmartImage
          src={course.image || `/images/course-${course.id}.jpg`}
          alt={course.name}
          className="absolute inset-0 h-full w-full"
          imgClassName="h-full w-full object-cover transition duration-700 group-hover:scale-[1.07]"
          fallback={
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-5" style={{ background: `linear-gradient(135deg, #0A1D50 0%, ${accent}99 60%, #D4AF37 100%)` }}>
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 25% 25%, #fff 0, transparent 40%)" }} />
              <p className="relative text-center text-xl font-extrabold tracking-tight text-white">{course.imageLabel}</p>
            </div>
          }
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/80 via-transparent to-transparent" aria-hidden />
        {course.badge ? (
          <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider text-white" style={{ backgroundColor: accent }}>
            {course.badge.toUpperCase()}
          </span>
        ) : null}
        <span className="absolute bottom-3 left-3 flex gap-1.5">
          <span className="rounded-full border border-white/25 bg-neutral-900/70 px-2.5 py-1 text-[10px] font-bold tracking-widest text-white backdrop-blur">
            {course.category.toUpperCase()}
          </span>
          <span className="rounded-full border border-white/25 bg-neutral-900/70 px-2.5 py-1 text-[10px] font-bold tracking-widest text-white backdrop-blur">
            {course.duration.toUpperCase()}
          </span>
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold tracking-tight text-navy-950 transition group-hover:text-brand-primary">{course.name}</h3>
        <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-neutral-600">{course.desc}</p>
        {course.subjects ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {course.subjects.map((s) => (
              <span key={s} className="rounded-full bg-silver-50 px-2.5 py-1 text-[11px] font-medium text-neutral-700 ring-1 ring-silver-200">{s}</span>
            ))}
          </div>
        ) : null}
        <div className="mt-3 space-y-1 text-[12px] font-bold text-neutral-700/80">
          <p className="flex items-center gap-1.5">{course.target}</p>
          <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {course.duration} • <MonitorPlay className="h-3.5 w-3.5" /> {course.mode}</p>
          <p className="flex items-center gap-1.5 text-brand-primary"><CheckCircle2 className="h-3.5 w-3.5" /> {course.faculty}</p>
        </div>
        <div className="metallic-divider my-3.5" />
        <div className="flex gap-2">
          <button onClick={() => onDetails?.(course)} className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-center text-[13px] font-semibold text-neutral-700 transition hover:border-brand-primary/40 hover:bg-brand-primary/5 hover:text-brand-primary">
            Course details
          </button>
          <a href={CONTACT.whatsappHref} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-primary px-3 py-2.5 text-[13px] font-bold text-white transition hover:bg-brand-primary-hover">
            Enquire <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}
