"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { SmartImage } from "@/lib/siteImages";
import { CONTACT } from "@/data/contact";
import type { FacultyMember } from "@/data/faculty";

/** Full faculty profile dialog (FacultyDetails). */
export function FacultyDetails({ member, onClose }: { member: FacultyMember; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-navy-800/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={`${member.name} profile`} onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-card bg-white shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-60 bg-navy-800">
          <SmartImage
            src={member.image}
            alt={`${member.name} — ${member.subject}`}
            className="absolute inset-0 h-full w-full"
            imgClassName="h-full w-full object-cover"
            fallback={
              <div className="bg-metallic-dark absolute inset-0 flex flex-col items-center justify-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 text-4xl font-extrabold text-white ring-1 ring-white/20">{member.name.charAt(0)}</span>
                <p className="mt-3 text-[11px] font-bold tracking-widest text-teal-300">PHOTO COMING SOON</p>
              </div>
            }
          />
          <button onClick={onClose} aria-label="Close faculty profile" className="absolute right-3 top-3 rounded-full bg-navy-800/70 p-2.5 text-white hover:bg-navy-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-[11px] font-bold tracking-widest text-teal-600">{member.subject.toUpperCase()} • {member.designation.toUpperCase()}</p>
          <h3 className="mt-1 text-xl font-extrabold text-navy-700">{member.name}</h3>
          <p className="mt-1 text-[13px] font-bold text-muted">{member.qualification}</p>
          <p className="text-[13px] font-bold text-muted">Experience: {member.experience}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink">{member.intro}</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button onClick={onClose} className="rounded-xl border border-silver-300 px-4 py-2.5 text-sm font-bold text-navy-700">Close</button>
            <a href={CONTACT.whatsappHref} target="_blank" rel="noreferrer" onClick={onClose} className="rounded-xl bg-navy-700 px-4 py-2.5 text-center text-sm font-bold text-white">Ask a Doubt</a>
          </div>
        </div>
      </div>
    </div>
  );
}
