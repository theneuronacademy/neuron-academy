import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Phone } from "lucide-react";
import { Navbar } from "@/components/website/Navbar";
import { Footer } from "@/components/website/Footer";
import { SectionHeader } from "@/components/ui/primitives";
import { TOPICS, getTopicBySlug } from "@/data/topics";

export function generateStaticParams() {
  return TOPICS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const topic = getTopicBySlug(slug);
  if (!topic) return { title: "Topic Not Found | Neuron Academy" };
  return {
    title: `${topic.title} | Neuron Academy`,
    description: topic.lead.slice(0, 300),
  };
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = getTopicBySlug(slug);
  if (!topic) notFound();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* Topic hero */}
        <section className="bg-metallic-dark relative overflow-hidden">
          <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-teal-400/15 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <Link href="/" className="inline-flex items-center gap-1 text-[13px] font-bold text-teal-300 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
            <p className="mt-4 text-[11px] font-bold tracking-[0.22em] text-brand-secondary-300">{topic.eyebrow}</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">{topic.title}</h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-silver-200">{topic.lead}</p>
          </div>
        </section>

        {/* Body */}
        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionHeader eyebrow="IN DETAIL" title={topic.title} desc={topic.lead} />
            <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink">
              {topic.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
          <div className="rounded-card border border-silver-200 bg-white p-6 shadow-card">
            <h2 className="text-lg font-extrabold text-navy-700">What this means for you</h2>
            <ul className="mt-5 space-y-2.5">
              {topic.bullets.map((b) => (
                <li key={b} className="flex gap-2 rounded-xl border border-silver-200 bg-background px-4 py-3 text-sm font-semibold text-ink shadow-card">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /> {b}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6">
            <p className="mx-auto max-w-2xl text-[15px] font-semibold text-navy-700">{topic.closing}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/#courses" className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-6 py-3 text-sm font-bold text-white shadow-primary transition hover:bg-brand-primary-hover">
                Explore Courses <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/#contact" className="inline-flex items-center gap-2 rounded-xl border border-silver-300 px-6 py-3 text-sm font-bold text-navy-800 transition hover:border-brand-primary/30 hover:bg-brand-primary/5">
                Talk to us <Phone className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
