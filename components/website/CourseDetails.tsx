"use client";

import { X, CheckCircle2, Clock, MonitorPlay } from "lucide-react";
import { SmartImage } from "@/lib/siteImages";
import { CONTACT } from "@/data/contact";
import type { Course } from "@/data/courses";

/** Full course details dialog (CourseDetails). */
export function CourseDetails({ course, onClose, onEnroll }: { course: Course; onClose: () => void; onEnroll: () => void }) {
  const accent = course.accent || "#008C9E";
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-navy-800/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={`${course.name} details`} onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-48 bg-navy-800">
          <SmartImage
            src={course.image}
            alt={course.name}
            className="absolute inset-0 h-full w-full"
            imgClassName="h-full w-full object-cover"
            fallback={
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, #183653, ${accent})` }}>
                <p className="text-2xl font-extrabold text-white">{course.imageLabel}</p>
              </div>
            }
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-800/85 to-transparent" />
          <button onClick={onClose} aria-label="Close course details" className="absolute right-3 top-3 rounded-full bg-navy-800/70 p-2 text-white hover:bg-navy-700">
            <X className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-4 right-4">
            <p className="text-[11px] font-bold tracking-widest" style={{ color: accent }}>{course.category.toUpperCase()} {course.admissionOpen ? "• ADMISSION OPEN" : ""}</p>
            <h3 className="text-xl font-extrabold text-white">{course.name}</h3>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-sm leading-relaxed text-muted">{course.desc}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] font-bold text-navy-700">
            <p className="rounded-lg bg-silver-50 px-3 py-2 ring-1 ring-silver-200">🎯 {course.target}</p>
            <p className="flex items-center gap-1 rounded-lg bg-silver-50 px-3 py-2 ring-1 ring-silver-200"><Clock className="h-3.5 w-3.5" /> {course.duration}</p>
            <p className="flex items-center gap-1 rounded-lg bg-silver-50 px-3 py-2 ring-1 ring-silver-200"><MonitorPlay className="h-3.5 w-3.5" /> {course.mode}</p>
            <p className="rounded-lg bg-silver-50 px-3 py-2 ring-1 ring-silver-200">👨‍🏫 {course.faculty}</p>
          </div>
          <p className="mt-4 text-[13px] font-extrabold text-navy-700">What you get</p>
          <ul className="mt-2 space-y-1.5">
            {course.highlights.map((h) => (
              <li key={h} className="flex gap-2 text-[13.5px] font-semibold text-ink"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /> {h}</li>
            ))}
          </ul>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button onClick={onClose} className="rounded-xl border border-silver-300 px-4 py-2.5 text-sm font-bold text-navy-700">Close</button>
            <a href={CONTACT.whatsappHref} target="_blank" rel="noreferrer" className="btn-metallic-sheen rounded-xl px-4 py-2.5 text-sm font-bold text-white text-center" style={{ backgroundColor: accent }}>Enroll Now</a>
          </div>
        </div>
      </div>
    </div>
  );
}
