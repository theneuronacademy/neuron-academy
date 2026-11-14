import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, MessageCircle, Phone } from "lucide-react";
import { Navbar } from "@/components/website/Navbar";
import { Footer } from "@/components/website/Footer";
import { SectionHeader } from "@/components/ui/primitives";
import { FAQJsonLd } from "@/components/website/SchemaMarkup";
import { CONTACT } from "@/data/contact";
import { EXAM_PAGES, getExamPage } from "@/data/exams";
import { getDb } from "@/lib/prisma";
import { getStoreItems } from "@/lib/store";
import { itemsForExam } from "@/lib/storeLinks";
import { rupees, sizedImage } from "@/lib/displayText";

// Study material for the exam comes from the admin panel; refresh it at most every five minutes.
export const revalidate = 300;

export function generateStaticParams() {
  return EXAM_PAGES.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const exam = getExamPage(slug);
  if (!exam) return { title: "Page Not Found" };
  return {
    title: exam.metaTitle,
    description: exam.metaDescription,
    alternates: { canonical: `/coaching/${exam.slug}` },
    openGraph: { title: exam.metaTitle, description: exam.metaDescription, type: "website", siteName: "Neuron Academy", locale: "en_IN", url: `/coaching/${exam.slug}` },
  };
}

export default async function ExamCoachingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exam = getExamPage(slug);
  if (!exam) notFound();

  const whatsapp = `${CONTACT.whatsappHref}?text=${encodeURIComponent(`Hello, I would like details about ${exam.title.replace(" in Shaheen Bagh", "")} at Neuron Academy.`)}`;
  const others = EXAM_PAGES.filter((e) => e.slug !== exam.slug);
  const material = itemsForExam((await getStoreItems(getDb())) ?? [], exam.slug).slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <FAQJsonLd faqs={exam.faqs} />
      <main>
        {/* Hero */}
        <section className="bg-metallic-dark relative overflow-hidden">
          <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-teal-400/15 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
            <Link href="/" className="inline-flex items-center gap-1 text-[13px] font-bold text-teal-300 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
            <p className="mt-4 text-[11px] font-bold tracking-[0.22em] text-brand-secondary-300">{exam.eyebrow}</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">{exam.title}</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-silver-200">{exam.lead}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-bold text-white">
                <MessageCircle className="h-4 w-4" aria-hidden /> Enquire on WhatsApp
              </a>
              <a href={CONTACT.phoneHref} className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                <Phone className="h-4 w-4" aria-hidden /> Call {CONTACT.phone}
              </a>
            </div>
          </div>
        </section>

        {/* Programmes */}
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <SectionHeader eyebrow="OUR PROGRAMMES" title="Choose the programme for your class" desc="Each programme has its own page with full details." />
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {exam.programmes.map((p) => (
                <article key={p.courseSlug} className="flex flex-col rounded-2xl border border-silver-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-extrabold text-navy-950">{p.name}</h3>
                  <p className="mt-1 text-[13px] font-bold text-brand-primary">{p.forWhom}</p>
                  <ul className="mt-4 flex-1 space-y-2">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex gap-2 text-sm leading-relaxed text-neutral-700">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" aria-hidden /> {pt}
                      </li>
                    ))}
                  </ul>
                  <Link href={`/courses/${p.courseSlug}`} className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand-primary underline-offset-4 hover:underline">
                    View programme details <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Approach + about the exam */}
        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionHeader eyebrow="HOW WE PREPARE STUDENTS" title="Concept first, then practice, then tests" />
            <ul className="mt-6 space-y-2.5">
              {exam.approach.map((a) => (
                <li key={a} className="flex gap-2 rounded-xl border border-silver-200 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-card">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden /> {a}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-card border border-silver-200 bg-white p-6 shadow-card">
            <h2 className="text-lg font-extrabold text-navy-700">{exam.aboutHeading}</h2>
            <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink">
              {exam.about.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <a href={exam.official.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand-primary underline-offset-4 hover:underline">
              Official website: {exam.official.label} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            <p className="mt-5 border-t border-silver-200 pt-4 text-[13px] leading-relaxed text-neutral-600">
              Dates, eligibility, seats and the test pattern can change every year. Please confirm them on the official website. Neuron Academy is an independent coaching institute and is not affiliated with {exam.conductedBy}.
            </p>
          </div>
        </section>

        {/* Study material on sale for this exam */}
        {material.length > 0 ? (
          <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
            <SectionHeader eyebrow="STUDY MATERIAL" title={`Question banks for ${exam.label}`} desc="Prepared by Neuron Academy's teachers. Buy online and download the PDF." />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {material.map((item) => (
                <Link key={item.id} href={`/store/${item.id}`} className="flex gap-4 rounded-2xl border border-silver-200 bg-white p-4 shadow-card transition hover:border-brand-primary/40">
                  {item.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sizedImage(item.coverImageUrl, 240)} alt={`Cover: ${item.title}`} loading="lazy" className="h-24 w-20 shrink-0 rounded-lg border border-silver-200 object-cover" />
                  ) : null}
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold leading-snug text-navy-950">{item.title}</span>
                    <span className="mt-2 block text-sm font-extrabold text-brand-primary">{rupees(item.price)} · Digital PDF</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* FAQ */}
        <section className="bg-white">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
            <SectionHeader eyebrow="QUESTIONS PARENTS ASK" title="Frequently asked questions" />
            <div className="mt-6 space-y-3">
              {exam.faqs.map((f) => (
                <details key={f.question} className="group rounded-xl border border-silver-200 bg-white px-5 py-4">
                  <summary className="cursor-pointer list-none text-[15px] font-bold text-navy-950 marker:hidden">{f.question}</summary>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-700">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Other programmes + CTA */}
        <section className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6">
          <p className="text-[15px] font-semibold text-navy-700">Visit us at {CONTACT.address}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-6 py-3 text-sm font-bold text-white shadow-primary transition hover:bg-brand-primary-hover">
              Enquire now <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <Link href="/#results" className="inline-flex items-center gap-2 rounded-xl border border-silver-300 px-6 py-3 text-sm font-bold text-navy-800 transition hover:border-brand-primary/30">
              See our students&apos; results
            </Link>
          </div>
          <p className="mt-8 text-sm text-neutral-600">
            Also at Neuron Academy:{" "}
            {others.map((o, i) => (
              <span key={o.slug}>
                {i > 0 ? " · " : ""}
                <Link href={`/coaching/${o.slug}`} className="font-bold text-brand-primary underline-offset-4 hover:underline">{o.label}</Link>
              </span>
            ))}
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
