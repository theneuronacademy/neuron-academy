import { CalendarCheck, CheckCircle2, MessageCircle } from "lucide-react";
import { Reveal } from "@/components/website/motion";
import { SectionHeader } from "@/components/ui/primitives";

const FEATURES = [
  "Live + Recorded Classes",
  "Complete Syllabus Coverage",
  "Chapter-wise Concept Revision",
  "Important Questions & PYQs",
  "Regular Practice Tests",
  "Weekly Live Doubt Class",
];

const WHATSAPP_NUMBER = "9711917317";
const WHATSAPP_URL = `https://wa.me/91${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hello, I want to enrol in the Class 10 Mathematics Online Crash Course.",
)}`;

/** Homepage promo for the Class 10 Mathematics Online Crash Course (CBSE Board Examination 2027). */
export function CrashCourseAd() {
  return (
    <section id="maths-crash-course" className="relative overflow-hidden bg-white">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-secondary/10 blur-3xl" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-16">
        <Reveal>
          <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-3xl border border-silver-200 bg-navy-950 shadow-card-hover">
            <video
              className="block aspect-[9/16] w-full"
              controls
              playsInline
              preload="none"
              poster="/videos/class10-maths-crash-course-ad-poster.jpg"
              aria-label="Class 10 Mathematics Online Crash Course advertisement"
            >
              <source src="/videos/class10-maths-crash-course-ad.mp4" type="video/mp4" />
            </video>
          </div>
        </Reveal>

        <div>
          <Reveal>
            <SectionHeader
              eyebrow="ADMISSIONS OPEN • ONLINE BATCH"
              title="Class 10 Mathematics Crash Course"
              desc="For CBSE Board Examination 2027. Complete syllabus coverage with a weekly live doubt class."
            />
          </Reveal>

          <Reveal delay={80}>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm font-semibold text-navy-950">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-primary" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={140}>
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border border-silver-200 bg-silver-50 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-600">Special offer fee</p>
                <p className="mt-1 flex items-baseline gap-3">
                  <span className="text-3xl font-extrabold text-navy-950">₹1,999/-</span>
                  <span className="text-base font-semibold text-neutral-500 line-through">₹2,999/-</span>
                </p>
                <p className="mt-1 text-sm font-bold text-brand-primary">Save ₹1,000</p>
              </div>
              <div className="flex items-center gap-2.5 text-sm font-bold text-navy-950">
                <CalendarCheck className="h-5 w-5 text-brand-primary" aria-hidden />
                Batch starts 16 November 2026
              </div>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 text-sm font-bold text-white"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Enrol on WhatsApp: {WHATSAPP_NUMBER}
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
