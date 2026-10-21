import { BookOpen, PenLine, FileText, BarChart3, TrendingUp } from "lucide-react";
import { Reveal } from "@/components/website/motion";
import { SectionHeader } from "@/components/ui/primitives";

const STEPS = [
  { n: "01", icon: BookOpen, t: "Learn", d: "Build understanding of core concepts with your teachers." },
  { n: "02", icon: PenLine, t: "Practice", d: "Strengthen concepts with focused question practice." },
  { n: "03", icon: FileText, t: "Test", d: "Apply your learning in exam-style assessments." },
  { n: "04", icon: BarChart3, t: "Review", d: "Review answers and identify topics to revisit." },
  { n: "05", icon: TrendingUp, t: "Improve", d: "Plan the next step with guidance from your mentors." },
];

/** A simple five-step overview of the learning process. */
export function LearningProcess() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <Reveal>
        <SectionHeader eyebrow="LEARNING APPROACH" title="A steady rhythm for exam preparation" desc="Learn, practice, review and build on what you know." />
      </Reveal>
      <ol className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 80}>
            <li className="relative h-full rounded-2xl border border-silver-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-brand-primary/25 hover:shadow-card-hover">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-[0.15em] text-brand-primary">{s.n}</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/5 text-brand-primary"><s.icon className="h-5 w-5" /></span>
              </div>
              <p className="mt-5 font-bold text-navy-950">{s.t}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{s.d}</p>
              {i < STEPS.length - 1 ? <span className="absolute -right-3 top-1/2 hidden h-0.5 w-6 -translate-y-1/2 bg-brand-secondary/70 lg:block" aria-hidden /> : null}
            </li>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}
