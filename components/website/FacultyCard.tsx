import { SmartImage } from "@/lib/siteImages";
import type { FacultyMember } from "@/data/faculty";

export function FacultyCard({ f, onView }: { f: FacultyMember; onView?: (m: FacultyMember) => void }) {
  return (
    <article className="card-lift premium-ring flex h-full flex-col overflow-hidden rounded-card bg-white">
      <div className="relative h-56 bg-navy-800">
        <SmartImage
          src={f.image || `/images/faculty-${f.id}.jpg`}
          alt={`${f.name} — ${f.subject} faculty at Neuron Academy`}
          className="absolute inset-0 h-full w-full"
          imgClassName="h-full w-full object-cover"
          fallback={
            <div className="metallic-dark absolute inset-0 flex flex-col items-center justify-center p-5 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl font-extrabold text-white ring-1 ring-white/20">
                {f.name.charAt(0)}
              </span>
              <p className="mt-3 text-sm font-extrabold text-white">{f.subject}</p>
              <p className="text-[11px] font-bold tracking-widest text-teal-300">PHOTO COMING SOON</p>
            </div>
          }
        />
        <span className="absolute bottom-3 left-3 rounded-full bg-teal-500 px-2.5 py-1 text-[10px] font-bold tracking-widest text-white shadow-card">
          {f.subject.toUpperCase()}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[15px] font-extrabold tracking-tight text-navy-700">{f.name}</h3>
        <p className="text-[12px] font-bold text-teal-600">{f.designation} • {f.experience}</p>
        <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-muted">{f.intro}</p>
        <button onClick={() => onView?.(f)} className="mt-4 rounded-xl border border-silver-300 bg-white px-4 py-2 text-[13px] font-bold text-navy-700 transition hover:border-teal-500 hover:text-teal-600">
          View Profile
        </button>
      </div>
    </article>
  );
}
