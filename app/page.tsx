"use client";

import { useEffect, useState } from "react";
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
import { Reveal, Marquee, Tilt, FloatingEmojis, ConfettiBurst } from "@/components/website/motion";
import { SectionHeader, MetallicCard, StatusBadge } from "@/components/ui/primitives";
import { COURSES, COURSE_CATEGORIES, FACULTY, GALLERY, CONTACT_INFO, EXAM_TICKER, FAQS } from "@/lib/websiteData";
import type { GalleryItem } from "@/data/gallery";
import type { Testimonial } from "@/data/testimonials";
import { getLiveCourses, getLiveFaculty, getLiveGallery, getLiveShowcase, getLiveTestimonials } from "@/services/siteApi";
import { CONTACT } from "@/data/contact";
import { RESULTS, type AcademyResult } from "@/data/results";
import type { Course } from "@/data/courses";
import type { FacultyMember } from "@/data/faculty";

const TRUST = [
  { icon: Users, title: "⭐ Expert Faculty", desc: "IIT, medical & AMU/JMI alumni mentors." },
  { icon: BookOpen, title: "🎯 Entrance-First Courses", desc: "JEE • NEET • AMU • Jamia mapped syllabus." },
  { icon: FileText, title: "📝 Weekly Mocks", desc: "Exam-pattern tests with ranks & solutions." },
  { icon: Target, title: "📊 Performance Tracking", desc: "Marks, attendance & growth in one place." },
  { icon: MonitorPlay, title: "💻 Digital Test Platform", desc: "Live tests, instant results, analysis." },
];

const WHY = [
  { t: "🎯 Entrance Specialists", d: "Not a generic tuition — every batch is engineered around JEE, NEET, AMU or Jamia patterns." },
  { t: "👥 Small Focused Batches", d: "Mentors know every student by name, strength and weak chapter." },
  { t: "📝 Weekly Mocks + PYQs", d: "Saturday full-syllabus mocks, daily PYQ drills and live sprint tests." },
  { t: "💡 Doubt Lounge Till 8 PM", d: "Walk in with any doubt — walk out with the concept crystal clear." },
  { t: "📊 Parent Reports", d: "Monthly score cards on WhatsApp + mentor calls after every major test." },
  { t: "💻 Digital Test App", d: "Attempt from home, get instant ranks, accuracy graphs and solutions." },
];

function GallerySection({ items: propItems }: { items?: GalleryItem[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [cat, setCat] = useState<string>("All");
  const items = propItems ?? GALLERY;
  const cats = ["All", ...Array.from(new Set(items.map((g) => g.category).filter(Boolean)))];
  const shown = cat === "All" ? items : items.filter((g) => g.category === cat);
  const activeItem = active != null ? shown[active] : undefined;
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
              <button onClick={() => setActive(null)} aria-label="Close gallery" className="rounded-lg p-1.5 hover:bg-silver-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="relative h-72 bg-navy-800">
              <SmartImage
                src={activeItem.image || `/images/gallery-${activeItem.id}.jpg`}
                alt={activeItem.title}
                className="absolute inset-0 h-full w-full"
                imgClassName="h-full w-full object-cover"
                fallback={
                  <div className="metallic-dark flex h-72 items-center justify-center p-8 text-center">
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
  useEffect(() => {
    const t = setInterval(() => {
      setSecs((x) => (x > 0 ? x - 1 : 29 * 60 + 59));
      setS((x) => (x + 1) % slides.length);
    }, 2600);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const cur = slides[s % slides.length];
  return (
    <div className="conic-ring mx-auto w-full max-w-[300px] rounded-[28px] bg-white shadow-card">
      <div className="conic-inner animate-float-slow rounded-[28px] border-8 border-navy-800 bg-white">
      <div className="flex items-center justify-between border-b border-silver-200 px-4 py-3">
        <div><p className="text-xs font-extrabold text-navy-700">📱 NEET Practice — 07</p><p className="text-[11px] text-muted">🔴 Live • auto ranks</p></div>
        <span className="animate-blink rounded-full bg-crimson px-2 py-0.5 text-[10px] font-extrabold text-white">● LIVE</span>
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
          <span className="animate-bounce-soft rounded-lg bg-teal-500 px-2.5 py-1 text-[11px] font-bold">Submit 🚀</span>
        </div>
        <p className="text-center text-[11px] text-muted">👇 Interactive preview — try a live test below ✨</p>
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
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [c, f, g, t, w] = await Promise.all([getLiveCourses(), getLiveFaculty(), getLiveGallery(), getLiveTestimonials(), getLiveShowcase()]);
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
          const palette = ["#1AA6B5", "#F59E0B", "#8B5CF6", "#10B981"];
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
      } catch {
        /* static fallbacks stay */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const courseList = liveCourses ?? COURSES;
  const facultyList = liveFaculty ?? FACULTY;
  const galleryList = liveGallery ?? GALLERY;
  const testimonialList = liveTestimonials ?? undefined;
  // Showcase wall: live consented rows replace the static set; the DEMO badge
  // below renders only for static fallback rows, never for published data.
  const wall = liveWall?.rows ?? RESULTS;
  const wallLive = liveWall !== null;
  const courseCats = ["All", ...Array.from(new Set(courseList.map((c) => c.category).filter(Boolean))), ...COURSE_CATEGORIES.filter((c) => !courseList.some((x) => x.category === c))];
  const courses = courseCat === "All" ? courseList : courseList.filter((c) => c.category === courseCat);
  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <AnnouncementBar />
      <Navbar />
      <SocialSidebar />
      <EnquireFloat />
      <AdvertisementPopup />

      <main>
        {/* RUNNING BANNER — at the very start, admin-controlled */}
        <TopRunningBanner />
        <Hero />

        {/* TRUST — animated counters */}
        <section className="relative overflow-hidden border-y border-silver-200 bg-gradient-to-b from-white to-silver-50">
          <div className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <Reveal>
              <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-center">
                {["👥 Small Batches", "📝 Weekly Mocks", "🧑‍🏫 Expert Mentors", "🎯 4 Entrance Tracks"].map((l) => (
                  <div key={l} className="transition duration-300 hover:-translate-y-1 hover:scale-105">
                    <p className="mt-0.5 text-[11px] font-bold tracking-[0.18em] text-muted">{l.toUpperCase()}</p>
                  </div>
                ))}
              </div>
            </Reveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {TRUST.map((f, i) => (
                <Reveal key={f.title} delay={i * 70}>
                  <Tilt max={7}>
                    <MetallicCard className="card-lift premium-ring flex h-full gap-3 p-4">
                      <span className="wiggle-on-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy-700 to-teal-600 text-white shadow-card"><f.icon className="h-5 w-5" /></span>
                      <span><span className="block text-sm font-extrabold tracking-tight text-navy-700">{f.title}</span><span className="mt-0.5 block text-[13px] leading-snug text-muted">{f.desc}</span></span>
                    </MetallicCard>
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
              <div className="premium-ring relative min-h-[380px] overflow-hidden rounded-card-lg">
                <SmartImage
                  src={SITE_PHOTOS.about}
                  alt="Neuron Academy campus, Shaheen Bagh"
                  className="absolute inset-0 h-full w-full"
                  imgClassName="h-full w-full object-cover transition duration-700 hover:scale-105"
                  fallback={
                    <div className="metallic-dark absolute inset-0 overflow-hidden p-8">
                      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 25% 20%, #1AA6B5 0, transparent 45%), radial-gradient(circle at 80% 70%, #D97706 0, transparent 35%)" }} />
                      <p className="relative text-[11px] font-bold tracking-[0.2em] text-teal-300">ABOUT NEURON ACADEMY • SHAHEEN BAGH</p>
                      <p className="relative mt-3 text-2xl font-extrabold text-white">A Serious Place For Serious Aspirants</p>
                      <p className="relative mt-2 text-sm text-silver-200">Add <code>about-campus.jpg</code> to <code>public/images/</code> — it appears here automatically.</p>
                    </div>
                  }
                />
                <span className="animate-float absolute bottom-4 left-4 rounded-2xl border border-white/25 bg-navy-800/80 px-4 py-2.5 backdrop-blur">
                  <span className="block text-lg font-extrabold text-white">Shaheen Bagh</span>
                  <span className="block text-[10px] font-bold tracking-widest text-teal-300">NEW DELHI • ENTRANCE FOCUS</span>
                </span>
              </div>
            </Reveal>
            <Reveal variant="right">
              <div>
                <SectionHeader eyebrow="✨ ABOUT" title="More Than Classes 🎓 — A Structured Learning Experience." />
                <p className="mt-4 text-[15px] leading-relaxed text-muted">
                  In the heart of Shaheen Bagh, Neuron Academy prepares students for JEE, NEET, AMU and Jamia entrances with
                  small batches, weekly mocks and mentors who track every mark — so students always know what to study next. 🧠⚡
                </p>
                <ul className="mt-5 space-y-3 text-[14px] text-ink">
                  {["🎯 Mission: a top rank from every lane of Shaheen Bagh.", "📚 Teaching: concept-first, PYQ-heavy, doubt-supported.", "🤝 Environment: disciplined batches with mentor check-ins.", "💻 Technology: digital tests, attendance and instant ranks.", "📊 Assessment: weekly mocks with solutions and parent reports."].map((t) => (
                    <li key={t} className="flex gap-2 rounded-lg px-2 py-1 transition hover:-translate-y-0.5 hover:bg-silver-50"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /> {t}</li>
                  ))}
                </ul>
                <a href="#courses" className="btn-metallic-sheen cta-bounce shine-sweep mt-6 inline-block rounded-xl bg-navy-700 px-6 py-3 text-sm font-bold text-white">See Our Tracks 🚀 →</a>
              </div>
            </Reveal>
          </div>
        </section>

        {/* WHY */}
        <section className="relative overflow-hidden bg-white">
          <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <Reveal>
              <SectionHeader eyebrow="💖 WHY NEURON" title="Why Shaheen Bagh Chooses Neuron Academy ✨" desc="Entrance specialists — not a generic tuition centre. 🧠" />
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {WHY.map((w, i) => (
                <Reveal key={w.t} delay={(i % 3) * 90}>
                  <Tilt max={8}>
                    <div className={i === 0 ? "conic-ring card-lift relative h-full overflow-hidden rounded-card bg-gradient-to-br from-navy-800 via-navy-700 to-teal-700 p-6 text-white shadow-card" : "card-lift premium-ring h-full rounded-card bg-white p-6"}>
                      {i === 0 ? <FloatingEmojis emojis={["🧠", "⚡", "✨"]} count={4} /> : null}
                      <span className="bg-gradient-to-r from-teal-500 to-amber-400 bg-clip-text text-[12px] font-extrabold tracking-[0.18em] text-transparent">0{i + 1}</span>
                      <p className={`mt-1 text-[16px] font-extrabold tracking-tight ${i === 0 ? "text-white" : "text-navy-700"}`}>{w.t}</p>
                      <p className={`mt-1.5 text-[13.5px] leading-relaxed ${i === 0 ? "text-silver-200" : "text-muted"}`}>{w.d}</p>
                    </div>
                  </Tilt>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* LEARNING PROCESS */}
        <section className="bg-background">
          <LearningProcess />
        </section>

        {/* COURSES */}
        <section id="courses" className="relative overflow-hidden bg-background">
          <div className="pointer-events-none absolute right-0 top-10 h-72 w-72 rounded-full bg-crimson/10 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <Reveal>
              <SectionHeader eyebrow="📚 COURSES" title="One Academy. Every Entrance. 🚀" desc="JEE • NEET • AMU • Jamia • Foundation — pick your battlefield. ⚔️" />
            </Reveal>
            <Reveal delay={100}>
              <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter courses by category">
                {courseCats.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCourseCat(c)}
                    aria-pressed={courseCat === c}
                    className={`rounded-full px-4 py-1.5 text-[12px] font-bold transition ${courseCat === c ? "bg-navy-700 text-white" : "border border-silver-300 bg-white text-navy-700 hover:border-teal-500"}`}
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

        {/* EXAM TICKER divider */}
        <div className="metallic-dark border-y border-white/10 py-3">
          <Marquee items={EXAM_TICKER} className="text-white" itemClassName="text-white" />
        </div>

        {/* LOUD TAGLINE TAPE */}
        <div className="overflow-hidden border-y-4 border-double border-amber-300 bg-gradient-to-r from-navy-800 via-teal-600 to-navy-800 py-2.5">
          <Marquee
            items={["🧠 ACTIVATE YOUR NEURONs ⚡", "🚀 JEE • NEET • AMU • JAMIA 🎯", "📝 WEEKLY MOCKS + RANKS 🏆", "💡 DOUBT LOUNGE TILL 8 PM ✨"]}
            className="text-white"
            itemClassName="text-white"
          />
        </div>

        {/* FACULTY */}
        <section id="faculty" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <Reveal>
              <SectionHeader eyebrow="🧑‍🏫 FACULTY" title="Learn From Mentors Who've Been There 🌟" desc="IIT, medical & AMU/JMI alumni guiding every batch. 💪" />
            </Reveal>
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
        <section id="results" className="metallic-dark relative overflow-hidden">
          <div className="animate-float-slow pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-teal-400/15 blur-3xl" aria-hidden />
          <div className="animate-float pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-amber-400/15 blur-3xl" aria-hidden />
          <FloatingEmojis emojis={["🏆", "🥇", "⭐", "🎉", "🧠"]} count={9} />
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <Reveal>
              <SectionHeader dark eyebrow="🏆 RESULTS" title="Progress You Can Measure. 📈" desc="Verified selections from our entrance batches will appear here. ✨" />
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {wall.length === 0 ? (
                <p className="col-span-full rounded-card border border-dashed border-white/20 p-8 text-center text-sm font-bold text-silver-300">No results published yet.</p>
              ) : null}
              {wall.map((t, i) => (
                <Reveal key={t.name} delay={i * 90} variant="pop">
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
        <section className="relative overflow-hidden bg-background">
          <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6">
            <Reveal>
              <SectionHeader eyebrow="💬 TESTIMONIALS" title="What Students & Parents Say. ❤️" desc="Verified reviews from our learners and their families will appear here. 🌟" />
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
                <SectionHeader eyebrow="⚡ TEST PLATFORM" title="Practice. Perform. Improve. 🚀" desc="Our digital test app — live mocks, instant ranks and question-wise analysis. It's already working: try it below. 👇" />
                <ul className="mt-5 grid gap-2.5 text-sm font-semibold text-ink sm:grid-cols-2">
                  {["🔴 Live Tests", "📝 Mock Tests", "⚡ Instant Results", "📊 Performance Analysis", "🗓️ Regular Assessment", "🏆 Solutions + Ranks"].map((t) => (
                    <li key={t} className="card-lift flex items-center gap-2 rounded-xl border border-silver-200 bg-background px-3 py-2.5 transition hover:-translate-y-1 hover:border-teal-400 hover:shadow-card"><CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" /> {t}</li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-wrap gap-3">
                  <ConfettiBurst>
                    <a href="/scholarship-tests" className="animate-glow btn-metallic-sheen cta-bounce shine-sweep inline-block rounded-xl bg-crimson px-6 py-3 text-sm font-bold text-white">🎓 Scholarship Tests <span className="animate-heartbeat inline-block">→</span></a>
                  </ConfettiBurst>
                  <a href="/student/login" className="cta-bounce inline-block rounded-xl border border-silver-300 px-6 py-3 text-sm font-bold text-navy-700 hover:border-teal-500">▶️ Take a Live Demo Test</a>
                </div>
              </div>
            </Reveal>
            <Reveal variant="right">
              <LivePhone />
            </Reveal>
          </div>
        </section>

        {/* TECHNOLOGY */}
        <section className="metallic-dark relative overflow-hidden">
          <div className="pointer-events-none absolute left-1/4 top-0 h-64 w-64 rounded-full bg-teal-400/15 blur-3xl" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <Reveal variant="left">
              <div>
                <SectionHeader dark eyebrow="💻 TECHNOLOGY" title="Traditional Teaching. Modern Assessment. ⚡" desc="PDF question papers become digital tests with ranks — built right into this website. 🚀" />
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    { icon: MonitorPlay, t: "📄 PDF → Digital Tests" },
                    { icon: CalendarCheck, t: "✅ Attendance" },
                    { icon: BarChart3, t: "📊 Performance Tracking" },
                    { icon: Trophy, t: "🏆 Instant Ranks" },
                    { icon: Bell, t: "🔔 Notifications" },
                    { icon: BookOpen, t: "📚 Question Bank" },
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

        {/* GALLERY */}
        <section id="gallery" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <Reveal>
              <SectionHeader eyebrow="📸 GALLERY" title="Life At Neuron Academy 🎉" desc="Campus, classrooms and events — add real photos to public/images/ and they appear here. ✨" />
            </Reveal>
            <GallerySection items={galleryList} />
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact" className="relative overflow-hidden bg-background">
          <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <Reveal variant="left">
              <div>
                <SectionHeader eyebrow="📞 CONTACT" title="Let's Plan Your Next Step. 🗺️" desc="Visit us in Shaheen Bagh, call, or drop an enquiry — counsellors reply within a day. 😊" />
                <div className="mt-6 space-y-3">
                  {[
                    { icon: Phone, t: CONTACT_INFO.phone },
                    { icon: MessageCircle, t: `WhatsApp: ${CONTACT_INFO.whatsapp}` },
                    { icon: Mail, t: CONTACT_INFO.email },
                    { icon: MapPin, t: CONTACT_INFO.address },
                    { icon: Clock, t: CONTACT_INFO.hours },
                  ].map((c, i) => (
                    <p key={i} className="card-lift flex items-center gap-3 rounded-xl border border-silver-200 bg-white px-4 py-3 text-sm font-bold text-navy-700"><c.icon className="h-4 w-4 shrink-0 text-teal-600" /> {c.t}</p>
                  ))}
                </div>
                <a href={`https://wa.me/91${CONTACT_INFO.whatsapp.replace(/\D/g, "").slice(-10)}`} target="_blank" rel="noreferrer" className="animate-glow cta-bounce mt-4 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 text-sm font-bold text-white">
                  <MessageCircle className="h-4 w-4 animate-wiggle" /> 💬 Chat on WhatsApp
                </a>
                {CONTACT.MAP_EMBED_URL ? (
                  <iframe
                    title="Neuron Academy location map"
                    src={CONTACT.MAP_EMBED_URL}
                    loading="lazy"
                    className="mt-4 h-44 w-full rounded-card border border-silver-200"
                  />
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

        {/* ADMISSION */}
        <section className="relative overflow-hidden bg-white">
          <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <Reveal variant="left">
              <div>
                <SectionHeader eyebrow="🎯 ADMISSION" title="Your Rank Journey Starts With One Demo. 🚀" desc="Free demo class + diagnostic test + personalised study plan — no fee, no pressure. 😌" />
                <ul className="mt-4 space-y-2 text-sm font-semibold text-ink">
                  <li className="flex gap-2 rounded-lg px-2 py-1 transition hover:-translate-y-0.5 hover:bg-silver-50"><CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" /> 🎓 Free demo class in your target exam</li>
                  <li className="flex gap-2 rounded-lg px-2 py-1 transition hover:-translate-y-0.5 hover:bg-silver-50"><CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" /> 📋 Diagnostic test + study plan</li>
                  <li className="flex gap-2 rounded-lg px-2 py-1 transition hover:-translate-y-0.5 hover:bg-silver-50"><CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" /> 🤝 Transparent fees, honest counselling</li>
                </ul>
                <div className="mt-5 flex gap-6">
                  <div className="transition duration-300 hover:-translate-y-1 hover:scale-105"><p className="text-2xl font-extrabold text-navy-700">👥 Small</p><p className="text-[11px] font-bold text-muted">BATCHES</p></div>
                  <div className="transition duration-300 hover:-translate-y-1 hover:scale-105"><p className="text-2xl font-extrabold text-navy-700">📝 Weekly</p><p className="text-[11px] font-bold text-muted">MOCKS</p></div>
                  <div className="transition duration-300 hover:-translate-y-1 hover:scale-105"><p className="text-2xl font-extrabold text-navy-700">🌟 Expert</p><p className="text-[11px] font-bold text-muted">MENTORS</p></div>
                </div>
              </div>
            </Reveal>
            <Reveal variant="right">
              <ContactForm admission />
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <Reveal>
              <SectionHeader eyebrow="❓ FAQ" title="Questions, Answered. 💡" desc="Everything parents and students ask before joining. 👨‍👩‍👧‍👦" />
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-8"><Faq items={FAQS} /></div>
            </Reveal>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="metallic-dark relative overflow-hidden">
          <div className="animate-float-slow pointer-events-none absolute left-1/2 top-0 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-teal-400/15 blur-3xl" aria-hidden />
          <div className="animate-float pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-crimson/25 blur-3xl" aria-hidden />
          <FloatingEmojis emojis={["🧠", "⚡", "🏆", "🚀", "✨", "🎯"]} count={12} />
          <div className="relative mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
            <Reveal>
              <p className="text-[11px] font-bold tracking-[0.24em] text-teal-300">🧠 JEE • NEET • AMU • JAMIA • ADMISSIONS OPEN ⚡</p>
              <p className="animate-gradient-text mx-auto mt-4 bg-gradient-to-r from-amber-200 via-teal-200 to-amber-200 bg-clip-text text-2xl font-extrabold tracking-wide text-transparent sm:text-3xl">
                ACTIVATE YOUR NEURONs 🧠⚡
              </p>
              <h2 className="mx-auto mt-2 max-w-2xl text-3xl font-extrabold text-white sm:text-5xl">Your Rank Is Waiting. 🏆</h2>
              <p className="mx-auto mt-3 max-w-xl text-[15px] text-silver-200">Visit Shaheen Bagh, attend a free demo, take the diagnostic — and leave with a plan. 🚀</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <ConfettiBurst>
                  <a href="#courses" className="animate-glow cta-bounce shine-sweep rounded-xl bg-crimson px-8 py-3.5 text-sm font-bold text-white hover:bg-crimson-bright"><span className="animate-heartbeat inline-block">🚀</span> Explore Courses</a>
                </ConfettiBurst>
                <ConfettiBurst>
                  <a href="#contact" className="cta-bounce rounded-xl border border-white/30 bg-white/5 px-8 py-3.5 text-sm font-bold text-white backdrop-blur hover:border-teal-300"><span className="animate-heartbeat inline-block">🎯</span> Book Free Demo</a>
                </ConfettiBurst>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
      {selectedCourse ? (
        <CourseDetails
          course={selectedCourse}
          onClose={() => setSelectedCourse(null)}
          onEnroll={() => {
            setSelectedCourse(null);
            document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      ) : null}
      {selectedFaculty ? (
        <FacultyDetails member={selectedFaculty} onClose={() => setSelectedFaculty(null)} />
      ) : null}
    </div>
  );
}
