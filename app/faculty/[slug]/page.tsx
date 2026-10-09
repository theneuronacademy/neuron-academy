import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { Navbar } from "@/components/website/Navbar";
import { Footer } from "@/components/website/Footer";
import { SmartImage } from "@/lib/siteImages";
import { ContactForm } from "@/components/website/ContactForm";
import { SectionHeader } from "@/components/ui/primitives";
import { getPublicCourseList, getPublicFacultyBySlug, getPublishedFacultySlugs } from "@/services/siteServer";

export async function generateStaticParams() {
  const slugs = await getPublishedFacultySlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const m = await getPublicFacultyBySlug(slug);
  if (!m) return { title: "Faculty Not Found | Neuron Academy" };
  return {
    title: `${m.name} — ${m.subject} | Neuron Academy Faculty`,
    description: `${m.name}, ${m.designation} (${m.subject}). ${m.qualification}.`,
  };
}

export default async function FacultyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const member = await getPublicFacultyBySlug(slug);
  if (!member) notFound();
  const courses = await getPublicCourseList();
  const teaches = courses.filter((c) => c.subjects.includes(member.subject));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="metallic-dark relative overflow-hidden">
          <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[280px_1fr]">
            <div className="premium-ring relative h-72 overflow-hidden rounded-card-lg lg:h-80">
              <SmartImage
                src={member.image}
                alt={`${member.name} — ${member.subject}`}
                className="absolute inset-0 h-full w-full"
                imgClassName="h-full w-full object-cover"
                eager
                fallback={
                  <div className="metallic-dark absolute inset-0 flex flex-col items-center justify-center">
                    <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 text-4xl font-extrabold text-white ring-1 ring-white/20">{member.name.charAt(0)}</span>
                  </div>
                }
              />
            </div>
            <div>
              <Link href="/#faculty" className="inline-flex items-center gap-1 text-[13px] font-bold text-teal-300 hover:text-white">
                <ArrowLeft className="h-4 w-4" /> All Faculty
              </Link>
              <p className="mt-3 text-[11px] font-bold tracking-[0.22em] text-teal-300">{member.subject.toUpperCase()} • {member.designation.toUpperCase()}</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{member.name}</h1>
              <p className="mt-2 text-sm text-silver-200">{member.qualification}</p>
              <p className="text-sm font-bold text-silver-200">Experience: {member.experience}</p>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-silver-200">{member.intro}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2">
          <div className="rounded-card border border-silver-200 bg-white p-6 shadow-card">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-navy-700"><GraduationCap className="h-5 w-5 text-teal-600" /> Expertise</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[["Subject", member.subject], ["Designation", member.designation], ["Qualification", member.qualification], ["Experience", member.experience]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-silver-100 pb-2.5 last:border-0">
                  <dt className="font-bold text-muted">{k}</dt>
                  <dd className="text-right font-extrabold text-navy-700">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <SectionHeader eyebrow="TEACHES" title="Courses by This Faculty" />
            {teaches.length === 0 ? (
              <p className="mt-4 rounded-card border border-dashed border-silver-300 bg-white p-6 text-sm font-bold text-muted">Course allocation will be updated soon.</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {teaches.map((c) => (
                  <Link key={c.id} href={`/courses/${c.id}`} className="card-lift rounded-card border border-silver-200 bg-white p-4">
                    <p className="text-[11px] font-bold tracking-widest text-teal-600">{c.category.toUpperCase()}</p>
                    <p className="font-extrabold text-navy-700">{c.name}</p>
                    <p className="text-[13px] text-muted">{c.duration} • {c.mode}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
            <SectionHeader eyebrow="CONTACT" title="Ask This Faculty a Doubt" desc="Send an enquiry — the faculty team responds during working hours." />
            <div className="mt-6"><ContactForm /></div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
