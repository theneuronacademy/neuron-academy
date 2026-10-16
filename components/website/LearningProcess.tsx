import { BookOpen, PenLine, FileText, BarChart3, TrendingUp } from "lucide-react";
import { Reveal, Tilt } from "@/components/website/motion";
import { SectionHeader } from "@/components/ui/primitives";

const STEPS = [
  { n: "01", icon: BookOpen, t: "Learn", d: "Concept-first classes with DPPs after every topic." },
  { n: "02", icon: PenLine, t: "Practice", d: "Daily PYQ drills and chapter-wise question sets." },
  { n: "03", icon: FileText, t: "Test", d: "Weekly mocks in real exam pattern with ranks." },
  { n: "04", icon: BarChart3, t: "Analyse", d: "Accuracy graphs, weak-chapter reports, mentor reviews." },
  { n: "05", icon: TrendingUp, t: "Improve", d: "Personalised revision plan before the next mock." },
];

/** Each step gets its own colour story + playful motion personality. */
const STEP_THEMES = [
  { border: "border-t-teal-500", num: "from-teal-500 to-navy-700", chip: "from-teal-500 to-navy-700", emoji: "📚", anim: "animate-bounce-soft" },
  { border: "border-t-amber-400", num: "from-amber-500 to-orange-600", chip: "from-amber-400 to-orange-600", emoji: "✍️", anim: "animate-wiggle" },
  { border: "border-t-crimson", num: "from-rose-500 to-crimson", chip: "from-rose-500 to-crimson", emoji: "📝", anim: "animate-float" },
  { border: "border-t-violet-500", num: "from-violet-500 to-purple-700", chip: "from-violet-500 to-purple-700", emoji: "📊", anim: "animate-heartbeat" },
  { border: "border-t-emerald-500", num: "from-emerald-500 to-teal-600", chip: "from-emerald-500 to-teal-600", emoji: "🚀", anim: "animate-blink" },
] as const;

/** The academy's 5-step learning process. Horizontal on desktop, stacked on mobile. */
export function LearningProcess() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <Reveal>
        <SectionHeader eyebrow="⚙️ HOW IT WORKS" title="A Process, Not Just Classes. 🎯" desc="🧠 Every Neuron Academy batch runs this five-step loop — from first concept to final rank. 🏆" />
      </Reveal>
      <ol className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STEPS.map((s, i) => {
          const theme = STEP_THEMES[i % STEP_THEMES.length];
          return (
          <Reveal key={s.n} delay={i * 80}>
            <Tilt max={7}>
            <li className={`card-lift premium-ring relative h-full rounded-card border-t-4 bg-white p-5 ${theme.border}`}>
              <span className={`absolute -top-5 right-3 text-3xl drop-shadow ${theme.anim}`} aria-hidden>{theme.emoji}</span>
              <span className={`bg-gradient-to-r bg-clip-text text-3xl font-extrabold text-transparent ${theme.num}`}>{s.n}</span>
              <span className={`wiggle-on-hover mt-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-card ${theme.chip}`}><s.icon className="h-5 w-5" /></span>
              <p className="mt-3 font-extrabold text-navy-700">{s.t} {theme.emoji}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.d}</p>
              {i < STEPS.length - 1 ? <span className="absolute -right-3 top-1/2 hidden h-0.5 w-6 -translate-y-1/2 bg-gradient-to-r from-teal-400 to-transparent lg:block" aria-hidden /> : null}
            </li>
            </Tilt>
          </Reveal>
          );
        })}
      </ol>
    </div>
  );
}
