"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen, Users, FileText, Target, MonitorPlay, Bell, CheckCircle2,
  Phone, Mail, MapPin, Clock, X, ChevronLeft, ChevronRight,
  CalendarCheck, Trophy, MessageCircle, Smartphone, BarChart3, Wallet,
  Sparkles, Medal, Star, GraduationCap,
} from "lucide-react";
import { AnnouncementBar } from "@/components/website/AnnouncementBar";
import { Navbar } from "@/components/website/Navbar";
import { TopRunningBanner } from "@/components/website/TopRunningBanner";
import { Hero } from "@/components/website/Hero";
import { AdvertisementPopup } from "@/components/website/AdvertisementPopup";
import { MobileActionBar } from "@/components/website/MobileActionBar";
import { SmartImage, SITE_PHOTOS } from "@/lib/siteImages";
import { SocialSidebar } from "@/components/website/SocialSidebar";
import { EnquireFloat } from "@/components/website/EnquireFloat";
import { LearningProcess } from "@/components/website/LearningProcess";
import { Faq } from "@/components/website/Faq";
import { CourseCard } from "@/components/website/CourseCard";
import { CourseDetails } from "@/components/website/CourseDetails";
import { FacultyCard } from "@/components/website/FacultyCard";
import { FacultyDetails } from "@/components/website/FacultyDetails";
import { Testimonials } from "@/components/website/Testimonials";
import { ContactForm } from "@/components/website/ContactForm";
import { Footer } from "@/components/website/Footer";
import { Reveal, Marquee, Tilt, WaveDivider } from "@/components/website/motion";
import { SectionHeader, Card, StatusBadge } from "@/components/ui/primitives";
import { useHomepageContent } from "@/lib/useHomepageContent";
import {
  OrganizationJsonLd,
  CourseListJsonLd,
  CourseJsonLd,
  FacultyJsonLd,
  TestimonialJsonLd,
  ResultJsonLd,
  FAQJsonLd,
  WebSiteJsonLd,
} from "@/components/website/SchemaMarkup";
import { FACULTY, GALLERY, CONTACT_INFO, EXAM_TICKER, FAQS } from "@/lib/websiteData";
import type { GalleryItem } from "@/data/gallery";
import type { Testimonial } from "@/data/testimonials";
import { getLiveCourses, getLiveFaculty, getLiveGallery, getLiveShowcase, getLiveTestimonials, getBooks, type LiveBookRow } from "@/services/siteApi";
import { CONTACT } from "@/data/contact";
import { RESULTS, type AcademyResult } from "@/data/results";
import type { Course } from "@/data/courses";
import type { FacultyMember } from "@/data/faculty";

const TRUST = [
  { icon: BookOpen, title: "Focused Courses", desc: "Preparation for JEE, NEET, AMU and Jamia entrances." },
  { icon: FileText, title: "Regular Practice", desc: "Mock tests and question practice for exam preparation." },
  { icon: Users, title: "Mentor Support", desc: "Guidance from the academy’s faculty team." },
  { icon: Target, title: "Progress Tools", desc: "Academic activity and performance in one place." },
  { icon: MonitorPlay, title: "Digital Assessments", desc: "Online tests with results and question review." },
];

const WHY = [
  { t: "Entrance-focused courses", d: "Study pathways for JEE, NEET, AMU and Jamia entrance preparation." },
  { t: "Small batches", d: "A focused classroom environment with room to ask questions and get guidance." },
  { t: "Regular mock tests", d: "Practice with exam-style questions and review performance after each test." },
  { t: "Doubt support", d: "Bring questions to your mentors and work through concepts together." },
  { t: "Progress tracking", d: "Students and families can follow academic activity and progress." },
  { t: "Digital practice tools", d: "Use online tests and review results from the student platform." },
];

const STUDENT_PORTAL_URL = "https://estudde.com/";

function GallerySection({ items: propItems }: { items?: GalleryItem[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [cat, setCat] = useState<string>("All");
  const items = propItems ?? GALLERY;
  const cats = ["All", ...Array.from(new Set(items.map((g) => g.category).filter(Boolean)))];
  const shown = cat === "All" ? items : items.filter((g) => g.category === cat);
  const activeItem = active != null ? shown[active] : undefined;
  const closeRef = useRef<HTMLButtonElement>(null);
  const galleryOpen = active != null;
  useEffect(() => {
    if (!galleryOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [galleryOpen]);
  return (
    <div>
      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter gallery by category">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => { setCat(c); setActive(null); }}
            aria-pressed={cat === c}
            className={`rounded-full px-4 py-1.5 text-[12px] font-bold transition ${cat === c ? "bg-navy-700 text-white" : "border border-silver-300 bg-white text-navy-700 hover:border-teal-500"}`}
          >
            {c}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-8 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No gallery items in this category yet.</p>
      ) : (
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((g, i) => (
          <Reveal key={g.id} delay={(i % 4) * 80} variant="pop">
            <button
              onClick={() => setActive(i)}
              className="group relative h-48 w-full overflow-hidden rounded-card border border-silver-200 bg-navy-800 text-left card-lift"
              aria-label={`Open ${g.title}`}
            >
              <SmartImage
                src={(g as { image?: string }).image || `/images/gallery-${g.id}.jpg`}
                alt={g.title}
                className="absolute inset-0 h-full w-full"
                imgClassName="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
                fallback={
                  <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-br from-navy-700 via-navy-800 to-teal-700 p-4">
                    <StatusBadge tone="teal">{g.category}</StatusBadge>
                    <p className="mt-2 text-sm font-extrabold text-white">{g.title}</p>
                  </div>
                }
              />
              <span className="absolute inset-0 bg-gradient-to-t from-navy-800/70 to-transparent opacity-80 transition group-hover:opacity-95" />
              <span className="absolute bottom-3 left-3 right-3 flex items-center justify-between"><span className="text-[12px] font-extrabold text-white drop-shadow">{g.title}</span><span className="text-lg opacity-0 transition duration-300 group-hover:opacity-100">🔍</span></span>
            </button>
          </Reveal>
        ))}
      </div>
      )}
      {activeItem ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-800/80 p-4" role="dialog" aria-modal="true" aria-label="Gallery preview">
          <div className="w-full max-w-2xl overflow-hidden rounded-card bg-white">
            <div className="flex items-center justify-between border-b border-silver-200 px-4 py-3">
              <p className="text-sm font-extrabold text-navy-700">{activeItem.title}</p>
              <button ref={closeRef} onClick={() => setActive(null)} aria-label="Close gallery" className="rounded-lg p-1.5 hover:bg-silver-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="relative h-72 bg-navy-800">
              <SmartImage
                src={activeItem.image || `/images/gallery-${activeItem.id}.jpg`}
                alt={activeItem.title}
                className="absolute inset-0 h-full w-full"
                imgClassName="h-full w-full object-cover"
                fallback={
                  <div className="bg-metallic-dark flex h-72 items-center justify-center p-8 text-center">
                    <p className="text-xl font-extrabold text-white">{activeItem.title}</p>
                  </div>
                }
              />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <button onClick={() => setActive(((active ?? 0) - 1 + shown.length) % shown.length)} aria-label="Previous image" className="rounded-lg border border-silver-300 p-2"><ChevronLeft className="h-4 w-4" /></button>
              <p className="text-xs font-bold text-muted">{(active ?? 0) + 1} / {shown.length}</p>
              <button onClick={() => setActive(((active ?? 0) + 1) % shown.length)} aria-label="Next image" className="rounded-lg border border-silver-300 p-2"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Live animated phone mockup — cycles questions with a ticking timer. */
function LivePhone() {
  const slides = [
    { q: "Q12. lim (x→0) sin 5x / 3x = ?", opts: ["5/3", "3/5", "1", "0"], pick: 0 },
    { q: "Q13. 45 is what % of 180?", opts: ["20%", "22.5%", "25%", "30%"], pick: 2 },
    { q: "Q14. Unit of force?", opts: ["Joule", "Newton", "Watt", "Pascal"], pick: 1 },
  ];
  const [s, setS] = useState(0);
  const [secs, setSecs] = useState(29 * 60 + 42);
  const viewRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = viewRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!inView) return;
    const t = setInterval(() => {
      setSecs((x) => (x > 0 ? x - 1 : 29 * 60 + 59));
      setS((x) => (x + 1) % slides.length);
    }, 2600);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const cur = slides[s % slides.length];
  return (
    <div ref={viewRef} className="conic-ring mx-auto w-full max-w-[300px] rounded-[28px] bg-white shadow-card">
      <div className="conic-inner animate-float-slow rounded-[28px] border-8 border-navy-800 bg-white">
      <div className="flex items-center justify-between border-b border-silver-200 px-4 py-3">
        <div><p className="text-xs font-extrabold text-navy-700">Sample assessment preview</p><p className="text-[11px] text-muted">Example question view</p></div>
        <span className="rounded-full bg-brand-secondary/20 px-2 py-0.5 text-[10px] font-bold text-brand-secondary-800">PREVIEW</span>
      </div>
      <div className="space-y-2.5 p-4">
        <div key={s} className="animate-fade-in rounded-xl bg-silver-50 p-3 ring-1 ring-silver-200">
          <p className="text-[12px] font-bold text-navy-700">{cur.q}</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {cur.opts.map((o, i) => (
              <span key={o} className={`rounded-lg border px-2 py-1.5 text-center text-[12px] font-bold transition ${i === cur.pick ? "border-teal-500 bg-teal-500 text-white" : "border-silver-200 bg-white"}`}>{o}</span>
            ))}
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-silver-200">
          <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-crimson transition-all duration-1000" style={{ width: `${35 + ((s % slides.length) + 1) * 18}%` }} />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-navy-800 p-3 text-white">
          <span className="text-[12px] font-bold tabular-nums">⏱ {mm}:{ss}</span>
          <span className="rounded-lg bg-brand-secondary px-2.5 py-1 text-[11px] font-bold text-navy-950">Select answer</span>
        </div>
        <p className="text-center text-[11px] text-muted">Sample question interface</p>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [courseCat, setCourseCat] = useState<string>("All");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyMember | null>(null);
  // Live CMS rows (published/active only) swap in over the static fallbacks
  // below. Static-first paint keeps the page instant with no DB; a failed or
  // empty live fetch simply keeps the fallbacks — never an error screen.
  const [liveCourses, setLiveCourses] = useState<Course[] | null>(null);
  const [liveFaculty, setLiveFaculty] = useState<FacultyMember[] | null>(null);
  const [liveGallery, setLiveGallery] = useState<GalleryItem[] | null>(null);
  const [liveTestimonials, setLiveTestimonials] = useState<Testimonial[] | null>(null);
  const [liveWall, setLiveWall] = useState<{ rows: AcademyResult[] } | null>(null);
  const [liveBooks, setLiveBooks] = useState<LiveBookRow[] | null>(null);
  const { content: hc, ready: hcReady } = useHomepageContent();
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [c, f, g, t, w, b] = await Promise.all([getLiveCourses(), getLiveFaculty(), getLiveGallery(), getLiveTestimonials(), getLiveShowcase(), getBooks()]);
        if (!mounted) return;
        // getLive* return null unless the database holds published rows, so a
        // swap always means fresher admin-published content. Shape-validate
        // defensively: one bad row must not blank an entire section.
        if (c && c.every((r) => typeof r.id === "string" && typeof r.name === "string")) {
          setLiveCourses(c.map((r) => ({
            id: String(r.slug ?? r.id),
            name: String(r.name),
            category: String(r.category ?? "Engineering"),
            desc: String(r.description ?? r.shortDescription ?? ""),
            target: String(r.target ?? "Class 11–12"),
            duration: String(r.duration ?? "1 year"),
            mode: String(r.mode ?? "Offline + Online"),
            faculty: String(r.facultyName ?? "Neuron Faculty"),
            imageLabel: String(r.name),
            image: String(r.image ?? ""),
            accent: String(r.accent ?? "#1AA6B5"),
            badge: String(r.badge ?? ""),
            subjects: Array.isArray(r.subjects) ? r.subjects.filter((s): s is string => typeof s === "string") : [],
            highlights: Array.isArray(r.highlights) ? r.highlights.filter((s): s is string => typeof s === "string") : [],
            admissionOpen: r.status !== "INACTIVE",
          })) as Course[]);
        }
        if (f && f.every((r) => typeof r.id === "string" && typeof r.name === "string")) {
          setLiveFaculty(f.map((m) => ({
            id: String(m.id),
            name: String(m.name),
            designation: String(m.designation ?? "Faculty"),
            subject: String(m.subject ?? "General"),
            qualification: String(m.qualification ?? ""),
            experience: String(m.experience ?? ""),
            intro: String(m.bio ?? m.qualification ?? ""),
            image: String(m.photo ?? ""),
            profileUrl: "#faculty",
          })));
        }
        if (g && g.every((r) => typeof r.id === "string" && typeof r.title === "string")) {
          setLiveGallery(g.map((r) => ({ id: String(r.id), title: String(r.title), category: String(r.category ?? "Academy"), image: String(r.imageUrl ?? "") })));
        }
        if (t && t.every((r) => typeof r.id === "string" && typeof r.name === "string")) {
          setLiveTestimonials(t.map((r) => ({
            id: String(r.id),
            studentName: String(r.name),
            course: String(r.role ?? "Student"),
            photo: String(r.photo ?? ""),
            testimonial: String(r.message ?? ""),
            achievement: `Rated ${typeof r.rating === "number" ? r.rating : 5}/5`,
          })));
        }
        // Results showcase: consented + active rows only (server-filtered).
        // Card accent cycles a fixed palette — no admin styling needed.
        if (w && w.every((r) => typeof r.id === "string" && typeof r.studentName === "string")) {
          const palette = ["#1746B8", "#D4AF37", "#102B70", "#7C8BA3"];
          setLiveWall({
            rows: w.map((r, i) => ({
              id: String(r.id),
              name: String(r.studentName),
              score: String(r.score ?? r.achievement ?? ""),
              tag: String(r.achievement ?? ""),
              exam: String(r.exam ?? ""),
              year: String(r.year ?? ""),
              color: palette[i % palette.length],
            })),
          });
        }
        if (b && b.every((r) => typeof r.id === "string" && typeof r.title === "string")) {
          setLiveBooks(b.map((r) => ({
            id: String(r.id),
            title: String(r.title),
            description: String(r.description ?? ""),
            author: String(r.author ?? ""),
            subject: String(r.subject ?? ""),
            className: String(r.className ?? ""),
            category: String(r.category ?? ""),
            coverImageUrl: String(r.coverImageUrl ?? ""),
            pdfUrl: String(r.pdfUrl ?? ""),
            externalUrl: String(r.externalUrl ?? ""),
            visibleTo: String(r.visibleTo ?? "ALL"),
            isActive: Boolean(r.isActive),
            order: Number(r.order ?? 0),
          })));
        }
      } catch {
        /* static fallbacks stay */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const courseList = liveCourses ?? [];
  const facultyList = liveFaculty ?? FACULTY;
  const galleryList = liveGallery ?? GALLERY;
  const testimonialList = liveTestimonials ?? undefined;
  // Showcase wall: live consented rows replace the static set; the DEMO badge
  // below renders only for static fallback rows, never for published data.
  const wall = liveWall?.rows ?? RESULTS;
  const wallLive = liveWall !== null;
  const courseCats = ["All", ...Array.from(new Set(courseList.map((c) => c.category).filter(Boolean)))];
  const courses = courseCat === "All" ? courseList : courseList.filter((c) => c.category === courseCat);
  return (
    <div className="min-h-screen overflow-x-clip bg-background pb-[calc(52px+env(safe-area-inset-bottom))] md:pb-0">
      <a href="#main" className="skip-link">Skip to content</a>
      <AnnouncementBar />
      <Navbar />
      <SocialSidebar />
      <EnquireFloat />
      <MobileActionBar />
      <AdvertisementPopup />

      <main id="main">
        {/* Schema.org Structured Data */}
        <WebSiteJsonLd />
        <OrganizationJsonLd />
        <CourseListJsonLd courses={courseList} />
        <TestimonialJsonLd testimonials={testimonialList ?? []} />
        <ResultJsonLd results={wall} />
        <FAQJsonLd faqs={FAQS.map((f) => ({ question: f.question, answer: f.answer }))} />
        {/* RUNNING BANNER — at the very start, admin-controlled */}
        <TopRunningBanner />
        <Hero />

        {/* Academy features */}
        <section className="relative overflow-hidden border-y border-silver-200 bg-gradient-to-b from-white to-silver-50">
          <div className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full bg-brand-primary/5 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <Reveal>
              <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-center">
                {["Small batches", "Weekly mocks", "Mentor support", "Entrance pathways"].map((l) => (
                  <div key={l}>
                    <p className="mt-0.5 text-[11px] font-semibold tracking-[0.12em] text-neutral-500">{l.toUpperCase()}</p>
                  </div>
                ))}
              </div>
            </Reveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {TRUST.map((f, i) => (
                <Reveal key={f.title} delay={i * 70}>
                  <Tilt max={7}>
                    <Card variant="metallic" className="flex h-full gap-3 p-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/5 text-brand-primary"><f.icon className="h-5 w-5" /></span>
                      <span><span className="block text-sm font-bold tracking-tight text-navy-900">{f.title}</span><span className="mt-1 block text-[13px] leading-snug text-neutral-600">{f.desc}</span></span>
                    </Card>
                  </Tilt>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="relative overflow-hidden bg-background">
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <Reveal variant="left">
              <div className="relative min-h-[360px] overflow-hidden rounded-2xl border border-silver-200 bg-white shadow-card">
                <SmartImage
                  src={SITE_PHOTOS.about}
                  alt="Neuron Academy campus, Shaheen Bagh"
                  className="absolute inset-0 h-full w-full"
                  imgClassName="h-full w-full object-cover transition duration-700 hover:scale-105"
                  fallback={
                    <div className="bg-metallic-dark absolute inset-0 overflow-hidden p-8">
                      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 25% 20%, #1746B8 0, transparent 45%), radial-gradient(circle at 80% 70%, #D4AF37 0, transparent 35%)" }} />
                      <p className="relative text-[11px] font-bold tracking-[0.2em] text-brand-secondary-300">ABOUT NEURON ACADEMY</p>
                      <p className="relative mt-3 text-2xl font-extrabold text-white">A clear path to focused preparation</p>
                    </div>
                  }
                />
                <span className="absolute bottom-4 left-4 rounded-xl border border-white/25 bg-navy-950/85 px-4 py-2.5 backdrop-blur">
                  <span className="block text-sm font-bold text-white">Shaheen Bagh</span>
                  <span className="block text-[10px] font-semibold tracking-widest text-brand-secondary-300">NEW DELHI</span>
                </span>
                <span className="absolute right-4 top-4 rounded-full border border-brand-secondary/50 bg-white/95 px-3 py-2 text-xs font-bold text-navy-900 shadow-card">
                  Entrance preparation
                </span>
              </div>
            </Reveal>
            <Reveal variant="right">
              <div>
                <SectionHeader eyebrow="ABOUT" title={hc["about.heading"] || "A structured approach to exam preparation"} />
                <p className="mt-4 text-[15px] leading-relaxed text-muted">
                  {hc["about.text"] || "Neuron Academy supports students preparing for JEE, NEET, AMU and Jamia entrance exams through focused classes, regular practice and mentor support."}
                </p>
                <ul className="mt-5 space-y-3 text-[14px] text-ink">
                  {["Focused courses for entrance preparation.", "Small batches and support from mentors.", "Regular mock tests and question practice.", "Digital tools for assessment and progress tracking."].map((t) => (
                    <li key={t} className="flex gap-2 rounded-lg py-1"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" /> {t}</li>
                  ))}
                </ul>
                <a href="#courses" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-bold text-white shadow-primary transition hover:bg-brand-primary-hover">Explore courses <ChevronRight className="h-4 w-4" /></a>
              </div>
            </Reveal>
          </div>
        </section>

        {/* WHY */}
        <section className="relative overflow-hidden bg-white">
          <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <Reveal>
              <SectionHeader eyebrow={hc["why.eyebrow"] || "WHY NEURON ACADEMY"} title={hc["why.title"] || "A focused learning experience"} desc={hc["why.desc"] || "Structured support for students preparing for entrance examinations."} />
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {WHY.map((w, i) => (
                <Reveal key={w.t} delay={(i % 3) * 60}>
                  <article className="relative h-full rounded-2xl border border-silver-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-brand-primary/25 hover:shadow-card-hover">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/5 text-sm font-bold text-brand-primary">0{i + 1}</div>
                    <h3 className="mt-5 text-base font-bold text-navy-950">{w.t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">{w.d}</p>
                    <span className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-brand-secondary/70 to-transparent" aria-hidden />
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* COURSES */}
        <section id="courses" className="relative overflow-hidden bg-background">
          <div className="pointer-events-none absolute right-0 top-10 h-72 w-72 rounded-full bg-brand-secondary/10 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <Reveal>
              <SectionHeader eyebrow="COURSES" title="Find the right course for your goals" desc="Explore entrance preparation and foundation courses offered by Neuron Academy." />
            </Reveal>
            <Reveal delay={100}>
              <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter courses by category">
                {courseCats.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCourseCat(c)}
                    aria-pressed={courseCat === c}
                    className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${courseCat === c ? "bg-brand-primary text-white" : "border border-silver-300 bg-white text-navy-800 hover:border-brand-primary/40 hover:bg-brand-primary/5"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Reveal>
            {courses.length === 0 ? (
              <p className="mt-8 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No courses available in this category yet.</p>
            ) : (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((c, i) => (
                  <Reveal key={c.id} delay={(i % 3) * 90} variant="pop">
                    <CourseCard course={c} index={i} onDetails={setSelectedCourse} />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* LEARNING PROCESS */}
        <section className="bg-background">
          <LearningProcess />
        </section>

        {/* EXAM TICKER divider */}
        <div className="bg-metallic-dark border-y border-white/10 py-3">
          <Marquee items={EXAM_TICKER} className="text-white" itemClassName="text-white" />
        </div>

        {/* FACULTY */}
        <section id="faculty" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <Reveal>
              <SectionHeader eyebrow="FACULTY" title="Meet the academy’s faculty" desc="Learn more about the educators featured by Neuron Academy." />
            </Reveal>
            {facultyList.length > 0 && (
              <>
                {facultyList.map((f) => (
                  <FacultyJsonLd key={f.id} faculty={f} />
                ))}
              </>
            )}
            {facultyList.length === 0 ? (
              <p className="mt-10 rounded-card border border-dashed border-silver-300 bg-background p-8 text-center text-sm font-bold text-muted">No faculty profiles published yet.</p>
            ) : (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {facultyList.map((f, i) => (
                <Reveal key={f.id} delay={(i % 4) * 80} variant="pop">
                  <FacultyCard f={f} onView={setSelectedFaculty} />
                </Reveal>
              ))}
            </div>
            )}
          </div>
        </section>

        {/* RESULTS — cinematic toppers wall */}
        <WaveDivider className="bg-white text-navy-800" />
        <section id="results" className="bg-metallic-dark relative overflow-hidden">
          <div className="animate-float-slow pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-teal-400/15 blur-3xl" aria-hidden />
          <div className="animate-float pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-amber-400/15 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <Reveal>
              <SectionHeader dark eyebrow="STUDENT ACHIEVEMENTS" title="Toppers’ wall" desc="Selections and scores our students have earned — verified by the academy." />
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {wall.length === 0 ? (
                <p className="col-span-full rounded-card border border-dashed border-white/20 p-8 text-center text-sm font-bold text-silver-300">No results published yet.</p>
              ) : null}
              {wall.map((t, i) => (
                <Reveal key={t.id} delay={i * 70} variant="pop">
                  <div className="card-lift group relative overflow-hidden rounded-card border border-white/15 bg-white/5 p-6 backdrop-blur transition hover:bg-white/10">
                    <span className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${t.color}, transparent)` }} aria-hidden />
                    <span className="animate-heartbeat flex h-14 w-14 items-center justify-center rounded-2xl text-white transition group-hover:scale-110" style={{ backgroundColor: `${t.color}33`, border: `1px solid ${t.color}66`, animationDelay: `${i * 0.3}s` }}>
                      {i === 0 ? <Trophy className="h-6 w-6" style={{ color: t.color }} /> : <Medal className="h-6 w-6" style={{ color: t.color }} />}
                    </span>
                    <p className="mt-4 text-2xl font-extrabold text-white">{t.score}</p>
                    <p className="mt-1 text-sm font-extrabold text-silver-200">{t.name}</p>
                    <p className="text-[12px] font-bold" style={{ color: t.color }}>{t.tag}</p>
                    {wallLive ? null : (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-silver-300"><Star className="h-3 w-3" /> DEMO — VERIFY BEFORE PUBLISH</p>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={150}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-center">
                {[
                  { l: "📝 Weekly Mocks" },
                  { l: "📚 Syllabus Coverage" },
                  { l: "💡 Doubt Lounge" },
                ].map((x) => (
                  <div key={x.l}>
                    <p className="text-[11px] font-bold tracking-[0.18em] text-teal-300">{x.l.toUpperCase()}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <WaveDivider flip className="bg-background text-navy-800" />
        <section className="relative overflow-hidden bg-background">
          <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6">
            <Reveal>
              <SectionHeader eyebrow="TESTIMONIALS" title="Student and parent experiences" desc="Reviews published by the academy are shown here." />
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-8"><Testimonials items={testimonialList} /></div>
            </Reveal>
          </div>
        </section>

{/* TEST PLATFORM */}
        <section className="relative overflow-hidden bg-white">
          <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <Reveal variant="left">
              <div>
                <SectionHeader eyebrow="TEST PLATFORM" title="Practice and review your progress" desc="Use the student platform for online tests, results and question-wise review." />
                <ul className="mt-5 grid gap-2.5 text-sm font-semibold text-ink sm:grid-cols-2">
                  {["Online tests", "Mock tests", "Results and rankings", "Performance review", "Regular assessment", "Question solutions"].map((t) => (
                    <li key={t} className="flex items-center gap-2 rounded-xl border border-silver-200 bg-background px-3 py-3 text-neutral-700 transition hover:border-brand-primary/30 hover:shadow-card"><CheckCircle2 className="h-4 w-4 shrink-0 text-brand-primary" /> {t}</li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a href="/scholarship-tests" className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-bold text-white shadow-primary transition hover:bg-brand-primary-hover">Scholarship tests <ChevronRight className="h-4 w-4" /></a>
                  <a href={STUDENT_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-silver-300 px-5 py-3 text-sm font-bold text-navy-800 transition hover:border-brand-primary/30 hover:bg-brand-primary/5">Student Portal <span className="text-[10px]">↗</span></a>
                </div>
              </div>
            </Reveal>
            <Reveal variant="right">
              <LivePhone />
            </Reveal>
          </div>
        </section>

        {/* TECHNOLOGY */}
        <section className="bg-metallic-dark relative overflow-hidden">
          <div className="pointer-events-none absolute left-1/4 top-0 h-64 w-64 rounded-full bg-teal-400/15 blur-3xl" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <Reveal variant="left">
              <div>
                <SectionHeader dark eyebrow="DIGITAL LEARNING" title="Learning supported by useful tools" desc="Online assessments, attendance and study resources are available through the student and faculty platforms." />
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    { icon: MonitorPlay, t: "Digital assessments" },
                    { icon: CalendarCheck, t: "Attendance" },
                    { icon: BarChart3, t: "Progress tracking" },
                    { icon: Trophy, t: "Results and rankings" },
                    { icon: Bell, t: "Notifications" },
                    { icon: BookOpen, t: "Question bank" },
                  ].map((x, i) => (
                    <Reveal key={x.t} delay={i * 60}>
                      <div className="card-lift wiggle-on-hover flex items-center gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 transition hover:bg-white/10">
                        <x.icon className="h-5 w-5 shrink-0 text-teal-300" /><span className="text-sm font-bold text-white">{x.t}</span>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal variant="right">
              <div className="conic-ring premium-ring rounded-[20px] bg-white p-5 sm:p-6">
                <p className="flex items-center gap-2 text-sm font-extrabold text-navy-700"><Sparkles className="h-4 w-4 text-teal-600" /> Performance Dashboard</p>
                <div className="mt-4 flex items-center gap-4">
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-navy-700 text-xl font-extrabold text-white ring-4 ring-teal-100"><GraduationCap className="h-8 w-8" /></span>
                  <div className="flex-1 space-y-2 text-[12px] font-bold">
                    <p>Attendance tracking — <span className="text-teal-600">auto</span></p>
                    <p>Test analytics — <span className="text-teal-600">live</span></p>
                    <p>Question bank — <span className="text-teal-600">included</span></p>
                  </div>
                </div>
                <div className="mt-4 flex gap-3 text-center">
                  <div className="flex-1 rounded-xl bg-silver-50 p-3 ring-1 ring-silver-200"><Smartphone className="mx-auto h-4 w-4 text-navy-700" /><p className="mt-1 text-[11px] font-bold">App</p></div>
                  <div className="flex-1 rounded-xl bg-silver-50 p-3 ring-1 ring-silver-200"><Wallet className="mx-auto h-4 w-4 text-navy-700" /><p className="mt-1 text-[11px] font-bold">Fees</p></div>
                  <div className="flex-1 rounded-xl bg-silver-50 p-3 ring-1 ring-silver-200"><MessageCircle className="mx-auto h-4 w-4 text-navy-700" /><p className="mt-1 text-[11px] font-bold">Support</p></div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* BOOKS */}
        <section id="books" className="relative overflow-hidden bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <Reveal>
              <SectionHeader eyebrow="OUR BOOKS" title="Study books & resources" desc="Recommended books and study materials for entrance preparation." />
            </Reveal>
            {(liveBooks ?? []).length === 0 ? (
              <p className="mt-10 rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No books published yet.</p>
            ) : (
              <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {(liveBooks ?? []).map((b, i) => (
                  <Reveal key={b.id} delay={(i % 3) * 90} variant="pop">
                    <article className="relative overflow-hidden rounded-2xl border border-silver-200 bg-white shadow-card">
                      <div className="relative h-48 overflow-hidden">
                        {b.coverImageUrl ? (
                          <img src={b.coverImageUrl} alt={b.title} className="absolute inset-0 h-full w-full object-cover transition duration-500 hover:scale-105" />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-navy-800 p-6 text-center">
                            <BookOpen className="h-8 w-8 mb-3 text-white" />
                            <p className="text-sm font-extrabold text-white">{b.title}</p>
                          </div>
                        )}
                        <span className="absolute top-3 right-3 rounded-full bg-teal-500 px-2.5 py-1 text-[10px] font-extrabold text-white tracking-widest">
                          {b.visibleTo === "ALL" ? "ALL STUDENTS" : "REGULAR ONLY"}
                        </span>
                      </div>
                      <div className="p-4">
                        <h3 className="text-[15px] font-extrabold text-navy-700">{b.title}</h3>
                        {b.author && (
                          <p className="mt-0.5 text-[12px] text-muted">{b.author}</p>
                        )}
                        <p className="mt-2 text-[13px] leading-relaxed text-muted line-clamp-2">
                          {b.description || "No description available."}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {b.subject && <span className="text-[11px] font-bold text-brand-primary bg-brand-primary/10 px-2 py-1 rounded">{b.subject}</span>}
                          {b.className && <span className="text-[11px] font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded">{b.className}</span>}
                          {b.category && <span className="text-[11px] font-bold text-navy-700 bg-silver-100 px-2 py-1 rounded">{b.category}</span>}
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          {b.visibleTo !== "ALL" ? (
                            <a
                              href={STUDENT_PORTAL_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border border-silver-300 px-4 py-2 text-sm font-bold text-navy-700 transition hover:border-brand-primary/30 hover:bg-brand-primary/5"
                            >
                              Student portal only <span className="text-[10px]">↗</span>
                            </a>
                          ) : b.pdfUrl || b.externalUrl ? (
                            <a
                              href={b.pdfUrl || b.externalUrl}
                              target={b.externalUrl ? "_blank" : "_self"}
                              rel={b.externalUrl ? "noopener noreferrer" : undefined}
                              className="inline-flex items-center gap-2 rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800"
                            >
                              {b.pdfUrl ? "View PDF" : "Visit Link"}
                              <span className="text-[10px]">↗</span>
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-2 rounded-xl bg-silver-100 px-4 py-2 text-sm font-bold text-navy-700">
                              No link available
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* GALLERY */}
        <section id="gallery" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <Reveal>
              <SectionHeader eyebrow="GALLERY" title="Inside Neuron Academy" desc="Explore photos shared by the academy." />
            </Reveal>
            <GallerySection items={galleryList} />
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact" className="relative overflow-hidden bg-background">
          <div className="animate-float pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <Reveal variant="left">
              <div>
                <SectionHeader eyebrow="CONTACT" title="Talk with the academy" desc="Visit Neuron Academy in Shaheen Bagh, call, or send an enquiry." />
                <div className="mt-6 space-y-3">
                {[
                  { icon: Phone, t: CONTACT_INFO.phone, href: CONTACT.phoneHref },
                  { icon: MessageCircle, t: `WhatsApp: ${CONTACT_INFO.whatsapp}`, href: CONTACT.whatsappHref },
                  { icon: Mail, t: CONTACT_INFO.email, href: `mailto:${CONTACT_INFO.email}` },
                  { icon: MapPin, t: CONTACT_INFO.address, href: CONTACT.MAP_LINK_URL, external: true },
                  { icon: Clock, t: CONTACT_INFO.hours },
                ].map((c, i) => {
                  const linkProps = c.href
                    ? {
                        href: c.href,
                        ...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {}),
                        className: "flex items-center gap-3 rounded-xl border border-silver-200 bg-white px-4 py-3 text-sm font-semibold text-navy-800 transition hover:border-brand-primary/30 hover:text-brand-primary",
                      }
                    : { className: "flex items-center gap-3 rounded-xl border border-silver-200 bg-white px-4 py-3 text-sm font-semibold text-navy-800" };
                  const El = c.href ? "a" : "p";
                  return (
                    <El key={i} {...linkProps}>
                      <c.icon className="h-4 w-4 shrink-0 text-brand-primary" /> {c.t}
                    </El>
                  );
                })}
                </div>
                <a href={`https://wa.me/91${CONTACT_INFO.whatsapp.replace(/\D/g, "").slice(-10)}`} target="_blank" rel="noreferrer" className="animate-glow mt-4 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 text-sm font-bold text-white">
                  <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
                </a>
                {CONTACT.MAP_EMBED_URL ? (
                  <>
                    <iframe
                      title="Neuron Academy location map"
                      src={CONTACT.MAP_EMBED_URL}
                      loading="lazy"
                      className="mt-4 h-64 w-full rounded-card border border-silver-200"
                    />
                    <a href={CONTACT.MAP_LINK_URL} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-bold text-brand-primary underline-offset-4 hover:underline">
                      Open in Google Maps
                    </a>
                  </>
                ) : (
                  <div className="mt-4 flex h-36 flex-col items-center justify-center gap-1 rounded-card border border-dashed border-silver-300 bg-silver-50 px-4 text-center">
                    <MapPin className="h-5 w-5 text-teal-600" />
                    <p className="text-sm font-extrabold text-navy-700">Find Us in Shaheen Bagh</p>
                    <p className="text-[12px] font-semibold text-muted">Interactive map coming soon — {CONTACT.address}</p>
                  </div>
                )}
              </div>
            </Reveal>
            <Reveal variant="right">
              <ContactForm />
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <Reveal>
              <SectionHeader eyebrow="FAQ" title="Frequently asked questions" desc="Information about courses, classes and getting in touch." />
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-8"><Faq items={FAQS} /></div>
            </Reveal>
          </div>
        </section>

      </main>

      <Footer />
      {selectedCourse ? (
        <>
          <CourseJsonLd course={selectedCourse} />
          <CourseDetails
            course={selectedCourse}
            onClose={() => setSelectedCourse(null)}
            onEnroll={() => {
              setSelectedCourse(null);
              document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </>
      ) : null}
      {selectedFaculty ? (
        <>
          <FacultyJsonLd faculty={selectedFaculty} />
          <FacultyDetails member={selectedFaculty} onClose={() => setSelectedFaculty(null)} />
        </>
      ) : null}
    </div>
  );
}
