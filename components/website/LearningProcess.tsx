import { BookOpen, PenLine, FileText, BarChart3, TrendingUp } from "lucide-react";
import { Reveal } from "@/components/website/motion";
import { SectionHeader } from "@/components/ui/primitives";

const STEPS = [
  { n: "01", icon: BookOpen, t: "Learn", d: "Concept-first classes with DPPs after every topic." },
  { n: "02", icon: PenLine, t: "Practice", d: "Daily PYQ drills and chapter-wise question sets." },
  { n: "03", icon: FileText, t: "Test", d: "Weekly mocks in real exam pattern with ranks." },
  { n: "04", icon: BarChart3, t: "Analyse", d: "Accuracy graphs, weak-chapter reports, mentor reviews." },
  { n: "05", icon: TrendingUp, t: "Improve", d: "Personalised revision plan before the next mock." },
];

/** The academy's 5-step learning process. Horizontal on desktop, stacked on mobile. */
export function LearningProcess() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <Reveal>
        <SectionHeader eyebrow="HOW IT WORKS" title="A Process, Not Just Classes." desc="Every Neuron Academy batch runs this five-step loop — from first concept to final rank." />
      </Reveal>
      <ol className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 80}>
            <li className="card-lift premium-ring relative h-full rounded-card bg-white p-5">
              <span className="bg-gradient-to-r from-teal-600 to-navy-700 bg-clip-text text-3xl font-extrabold text-transparent">{s.n}</span>
              <span className="mt-3 flex h-10 w-10 items-center justify-center rounded-xl bg-navy-700 text-white"><s.icon className="h-5 w-5" /></span>
              <p className="mt-3 font-extrabold text-navy-700">{s.t}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.d}</p>
              {i < STEPS.length - 1 ? <span className="absolute -right-3 top-1/2 hidden h-0.5 w-6 -translate-y-1/2 bg-gradient-to-r from-teal-400 to-transparent lg:block" aria-hidden /> : null}
            </li>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}
