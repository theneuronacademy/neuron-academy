import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GraduationCap, Clock, BookOpen } from "lucide-react";
import { Navbar } from "@/components/website/Navbar";
import { Footer } from "@/components/website/Footer";
import { SmartImage } from "@/lib/siteImages";
import { FacultyJsonLd } from "@/components/website/SchemaMarkup";
import { getPublicFacultyBySlug, getPublicFacultyList, getPublishedFacultySlugs } from "@/services/siteServer";

export async function generateStaticParams() {
  const slugs = await getPublishedFacultySlugs();
  return slugs.map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const member = await getPublicFacultyBySlug(id);
  if (!member) return { title: "Faculty Not Found | Neuron Academy" };
  return {
    title: `${member.name} — ${member.subject} Faculty | Neuron Academy`,
    description: `${member.name}, ${member.designation} (${member.subject}) at Neuron Academy. ${member.intro}`.slice(0, 300),
  };
}

export default async function FacultyProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await getPublicFacultyBySlug(id);
  if (!member) notFound();
  const others = (await getPublicFacultyList()).filter((f) => f.id !== member.id).slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* Profile hero */}
        <section className="bg-metallic-dark relative overflow-hidden">
          <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-teal-400/15 blur-3xl" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[auto_1fr]">
            <div className="premium-ring relative h-56 w-56 overflow-hidden rounded-card-lg">
              <SmartImage
                src={member.image || `/images/faculty-${member.id}.jpg`}
                alt={`${member.name} — ${member.subject} faculty at Neuron Academy`}
                className="absolute inset-0 h-full w-full"
                imgClassName="h-full w-full object-cover"
                eager
                fallback={
                  <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-navy-950 via-navy-800 to-brand-primary text-7xl font-extrabold text-white">
                    {member.name.charAt(0)}
                  </span>
                }
              />
            </div>
            <div>
              <Link href="/faculty" className="inline-flex items-center gap-1 text-[13px] font-bold text-teal-300 hover:text-white">
                <ArrowLeft className="h-4 w-4" /> All Faculty
              </Link>
              <p className="mt-3 text-[11px] font-bold tracking-[0.22em] text-brand-secondary-300">{member.subject.toUpperCase()} FACULTY</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">{member.name}</h1>
              <p className="mt-2 text-base font-bold text-silver-200">{member.designation}</p>
              {member.intro ? <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-silver-200">{member.intro}</p> : null}
              <div className="mt-5 flex flex-wrap gap-2 text-[12px] font-bold text-white">
                {member.qualification ? (
                  <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/20"><GraduationCap className="mr-1 inline h-3.5 w-3.5" />{member.qualification}</span>
                ) : null}
                {member.experience ? (
                  <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/20"><Clock className="mr-1 inline h-3.5 w-3.5" />{member.experience}</span>
                ) : null}
                <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/20"><BookOpen className="mr-1 inline h-3.5 w-3.5" />{member.subject}</span>
              </div>
              <Link href="/#courses" className="mt-6 inline-flex rounded-xl border border-white/30 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:border-brand-secondary hover:bg-white/10">
                Explore Courses
              </Link>
            </div>
          </div>
        </section>

        {/* Other faculty */}
        {others.length > 0 ? (
          <section className="bg-white">
            <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
              <h2 className="text-lg font-extrabold text-navy-700">More Faculty</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {others.map((f) => (
                  <Link key={f.id} href={`/faculty/${f.id}`} className="card-lift flex items-center gap-4 rounded-card border border-silver-200 bg-background p-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-navy-700 text-xl font-extrabold text-white">{f.name.charAt(0)}</span>
                    <span>
                      <span className="block text-[15px] font-extrabold text-navy-700">{f.name}</span>
                      <span className="block text-[12px] font-bold text-teal-600">{f.subject} • {f.designation}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>
      <FacultyJsonLd faculty={member} />
      <Footer />
    </div>
  );
}
