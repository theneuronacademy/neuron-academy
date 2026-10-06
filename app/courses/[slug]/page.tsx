import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, MonitorPlay, ArrowLeft, Phone } from "lucide-react";
import { Navbar } from "@/components/website/Navbar";
import { Footer } from "@/components/website/Footer";
import { SmartImage } from "@/lib/siteImages";
import { ContactForm } from "@/components/website/ContactForm";
import { Faq } from "@/components/website/Faq";
import { SectionHeader } from "@/components/ui/primitives";
import { getCourse, getCourses, getFaculty, getFAQ } from "@/services/siteApi";

export async function generateStaticParams() {
  const courses = await getCourses();
  return courses.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) return { title: "Course Not Found | Neuron Academy" };
  return {
    title: `${course.name} | Neuron Academy`,
    description: `${course.name} — ${course.desc} Duration: ${course.duration}. Mode: ${course.mode}.`,
  };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) notFound();
  const [faculty, faqs, all] = await Promise.all([getFaculty(), getFAQ(), getCourses()]);
  const teachers = faculty.filter((f) => course.subjects.includes(f.subject));
  const shown = teachers.length > 0 ? teachers : faculty.slice(0, 2);
  const related = all.filter((c) => c.id !== course.id && c.category === course.category).slice(0, 3);
  const accent = course.accent || "#008C9E";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* Course hero */}
        <section className="metallic-dark relative overflow-hidden">
          <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-teal-400/15 blur-3xl" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2">
            <div>
              <Link href="/#courses" className="inline-flex items-center gap-1 text-[13px] font-bold text-teal-300 hover:text-white">
                <ArrowLeft className="h-4 w-4" /> All Courses
              </Link>
              <p className="mt-3 text-[11px] font-bold tracking-[0.22em]" style={{ color: accent === "#24466D" ? "#5DBECD" : accent }}>
                {course.category.toUpperCase()} {course.admissionOpen ? "• ADMISSION OPEN" : ""}
              </p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">{course.name}</h1>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-silver-200">{course.desc}</p>
              <div className="mt-5 flex flex-wrap gap-2 text-[12px] font-bold text-white">
                <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/20"><Clock className="mr-1 inline h-3.5 w-3.5" />{course.duration}</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/20"><MonitorPlay className="mr-1 inline h-3.5 w-3.5" />{course.mode}</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/20">🎯 {course.target}</span>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="#enquire" className="btn-metallic-sheen rounded-xl bg-crimson px-6 py-3 text-sm font-bold text-white">Enquire About This Course</a>
                <a href={process.env.NEXT_PUBLIC_WHATSAPP_URL || "#enquire"} className="rounded-xl border border-white/30 bg-white/5 px-6 py-3 text-sm font-bold text-white">WhatsApp Us</a>
              </div>
            </div>
            <div className="premium-ring relative min-h-[280px] overflow-hidden rounded-card-lg">
              <SmartImage
                src={course.image}
                alt={`${course.name} at Neuron Academy`}
                className="absolute inset-0 h-full w-full"
                imgClassName="h-full w-full object-cover"
                eager
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, #183653, ${accent})` }}>
                    <p className="p-6 text-center text-2xl font-extrabold text-white">{course.imageLabel}</p>
                  </div>
                }
              />
            </div>
          </div>
        </section>

        {/* Overview + highlights */}
        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionHeader eyebrow="OVERVIEW" title={`Who Is This For?`} desc={`${course.target}. ${course.faculty} lead every batch with weekly mocks and doubt support.`} />
            <ul className="mt-5 space-y-2.5">
              {course.highlights.map((h) => (
                <li key={h} className="flex gap-2 rounded-xl border border-silver-200 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-card">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /> {h}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-card border border-silver-200 bg-white p-6 shadow-card">
            <h2 className="text-lg font-extrabold text-navy-700">Batch Information</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[["Duration", course.duration], ["Mode", course.mode], ["Target", course.target], ["Faculty", course.faculty], ["Subjects", course.subjects.join(" • ")]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-silver-100 pb-2.5 last:border-0">
                  <dt className="font-bold text-muted">{k}</dt>
                  <dd className="text-right font-extrabold text-navy-700">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 flex items-center gap-1.5 text-[13px] font-bold text-teal-600"><Phone className="h-4 w-4" /> Batch timings shared during counselling.</p>
          </div>
        </section>

        {/* Faculty */}
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <SectionHeader eyebrow="FACULTY" title="Taught By Specialists" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {shown.map((f) => (
                <Link key={f.id} href={`/faculty/${f.id}`} className="card-lift flex items-center gap-4 rounded-card border border-silver-200 bg-background p-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-navy-700 text-xl font-extrabold text-white">{f.name.charAt(0)}</span>
                  <span>
                    <span className="block text-[15px] font-extrabold text-navy-700">{f.name}</span>
                    <span className="block text-[12px] font-bold text-teal-600">{f.subject} • {f.experience}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ + Enquiry */}
        <section id="enquire" className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionHeader eyebrow="FAQ" title="Common Questions" />
            <div className="mt-6"><Faq items={faqs.slice(0, 4)} /></div>
          </div>
          <div>
            <SectionHeader eyebrow="ENQUIRE" title={`Enquire About ${course.name}`} desc="Free demo class + diagnostic test + study plan." />
            <div className="mt-6"><ContactForm /></div>
          </div>
        </section>

        {/* Related */}
        {related.length > 0 ? (
          <section className="bg-white">
            <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
              <SectionHeader eyebrow="KEEP EXPLORING" title="Related Courses" />
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {related.map((c) => (
                  <Link key={c.id} href={`/courses/${c.id}`} className="card-lift rounded-card border border-silver-200 bg-background p-5">
                    <p className="text-[11px] font-bold tracking-widest text-teal-600">{c.category.toUpperCase()}</p>
                    <p className="mt-1 font-extrabold text-navy-700">{c.name}</p>
                    <p className="mt-1 text-[13px] text-muted">{c.duration} • {c.mode}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
