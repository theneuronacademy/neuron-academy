import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/website/Navbar";
import { Footer } from "@/components/website/Footer";
import type { LegalDoc } from "@/data/legal";

/** Shared layout for the Privacy Policy and Terms of Use pages. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Home
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-navy-950 sm:text-4xl">{doc.title}</h1>
        <p className="mt-2 text-sm font-semibold text-neutral-600">Last updated: {doc.updated}</p>
        <p className="mt-6 text-[15px] leading-relaxed text-ink">{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="text-lg font-extrabold text-navy-950">{s.heading}</h2>
            {s.lead ? <p className="mt-3 text-[15px] leading-relaxed text-ink">{s.lead}</p> : null}
            <Bullets items={s.bullets} />
            {s.paragraphs?.map((p) => (
              <p key={p} className="mt-3 text-[15px] leading-relaxed text-ink">{p}</p>
            ))}
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}

function Bullets({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink">
      {items.map((b) => (
        <li key={b}>{b}</li>
      ))}
    </ul>
  );
}
