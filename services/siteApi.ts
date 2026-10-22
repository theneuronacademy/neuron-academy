// Website service layer — API-first with demo fallback.
// TODAY: each function returns centralized demo data (no network, no fake
// servers). When the database is connected AND holds rows, /api/* data
// flows through with identical component signatures — no UI rewrite.
// With no DATABASE_URL (or an empty table) the existing demo/mock
// behaviour is preserved exactly, so the website never changes or crashes.

import { COURSES, type Course } from "@/data/courses";
import { FACULTY, type FacultyMember } from "@/data/faculty";
import { GALLERY, type GalleryItem } from "@/data/gallery";
import { TESTIMONIALS, type Testimonial } from "@/data/testimonials";
import { RESULTS, type AcademyResult } from "@/data/results";
import { FAQS, type Faq } from "@/data/faq";
import { ACADEMY, CONTACT_INFO } from "@/data/site";
import { POPUP_DEFAULTS, type PopupContent } from "@/data/popups";
import { getVisibleAds } from "@/lib/mockStore";
import type { Advertisement, AdType } from "@/lib/types";
import type { BannerContent } from "@/data/banners";

/** Client-side API fetch — null on server, offline, no-DB, or bad shape. */
async function apiItems<T>(path: string): Promise<{ items: T[]; source: string } | null> {
  try {
    if (typeof window === "undefined") return null;
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || json.success !== true || !json.data || !Array.isArray(json.data.items)) return null;
    return json.data as { items: T[]; source: string };
  } catch {
    return null;
  }
}

/** Only database rows (non-empty) override demo — demo fallback keeps old behaviour. */
function pickDb<T>(result: { items: T[]; source: string } | null): T[] | null {
  if (result && result.source === "database" && result.items.length > 0) return result.items;
  return null;
}

export async function getSiteSettings() {
  return { academy: ACADEMY, contact: CONTACT_INFO };
}

export async function getHero() {
  return ACADEMY.hero;
}

export interface LiveCourseRow {
  id: string;
  slug?: string;
  name: string;
  category?: string;
  description?: string;
  shortDescription?: string;
  target?: string;
  duration?: string;
  mode?: string;
  facultyName?: string;
  image?: string;
  accent?: string;
  badge?: string;
  subjects?: string[];
  highlights?: string[];
  status?: string;
}

export interface LiveFacultyRow {
  id: string;
  name: string;
  designation?: string;
  subject?: string;
  qualification?: string;
  experience?: string;
  bio?: string;
  photo?: string;
}

export interface LiveGalleryRow {
  id: string;
  title: string;
  category?: string;
  imageUrl?: string;
}

export interface LiveTestimonialRow {
  id: string;
  name: string;
  role?: string;
  photo?: string;
  message?: string;
  rating?: number;
}

export interface LiveShowcaseRow {
  id: string;
  studentName: string;
  exam?: string;
  achievement?: string;
  score?: string;
  year?: string;
  imageUrl?: string;
}

/**
 * Published/active CMS rows, or null when the database is unreachable,
 * empty, or the shape is bad. Never throws, never returns demo rows —
 * callers pair these with static fallbacks explicitly.
 */
export async function getLiveCourses(): Promise<LiveCourseRow[] | null> {
  return pickDb<LiveCourseRow>(await apiItems("/api/courses"));
}

export async function getLiveFaculty(): Promise<LiveFacultyRow[] | null> {
  return pickDb<LiveFacultyRow>(await apiItems("/api/faculty"));
}

export async function getLiveGallery(): Promise<LiveGalleryRow[] | null> {
  return pickDb<LiveGalleryRow>(await apiItems("/api/gallery"));
}

export async function getLiveTestimonials(): Promise<LiveTestimonialRow[] | null> {
  return pickDb<LiveTestimonialRow>(await apiItems("/api/testimonials"));
}

/** Published results-showcase rows (consented + active), or null without DB rows. */
export async function getLiveShowcase(): Promise<LiveShowcaseRow[] | null> {
  return pickDb<LiveShowcaseRow>(await apiItems("/api/showcase"));
}

export async function getCourses(): Promise<Course[]> {
  const live = await getLiveCourses();
  if (live) {
    return live.map((r, i) => ({
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
      subjects: Array.isArray(r.subjects) ? r.subjects : [],
      highlights: Array.isArray(r.highlights) ? r.highlights : [],
      admissionOpen: r.status !== "INACTIVE",
      _order: i,
    })) as Course[];
  }
  return COURSES;
}

export async function getCourse(slug: string): Promise<Course | null> {
  const courses = await getCourses();
  return courses.find((c) => c.id === slug) ?? null;
}

export async function getFaculty(): Promise<FacultyMember[]> {
  const live = await getLiveFaculty();
  if (live) {
    return live.map((f) => ({
      id: String(f.id),
      name: String(f.name),
      designation: String(f.designation ?? "Faculty"),
      subject: String(f.subject ?? "General"),
      qualification: String(f.qualification ?? ""),
      experience: String(f.experience ?? ""),
      intro: String(f.bio ?? f.qualification ?? ""),
      image: String(f.photo ?? ""),
      profileUrl: "#faculty",
    }));
  }
  return FACULTY;
}

export async function getFacultyMember(slug: string): Promise<FacultyMember | null> {
  const faculty = await getFaculty();
  return faculty.find((f) => f.id === slug) ?? null;
}

export async function getGallery(): Promise<GalleryItem[]> {
  const live = await getLiveGallery();
  if (live) {
    return live.map((g) => ({
      id: String(g.id),
      title: String(g.title),
      category: String(g.category ?? "Academy"),
      image: String(g.imageUrl ?? ""),
    }));
  }
  return GALLERY;
}

export async function getTestimonials(): Promise<Testimonial[]> {
  const live = await getLiveTestimonials();
  if (live) {
    return live.map((t) => ({
      id: String(t.id),
      studentName: String(t.name),
      course: String(t.role ?? "Student"),
      photo: String(t.photo ?? ""),
      testimonial: String(t.message ?? ""),
      achievement: `Rated ${t.rating ?? 5}/5`,
    }));
  }
  return TESTIMONIALS;
}

export async function getResults(): Promise<AcademyResult[]> {
  // Website showcase selections stay demo-curated; exam marks API (/api/results) is separate.
  return RESULTS;
}

export async function getFAQ(): Promise<Faq[]> {
  return FAQS;
}

export interface LiveBookRow {
  id: string;
  title: string;
  description?: string;
  author?: string;
  subject?: string;
  className?: string;
  category?: string;
  coverImageUrl?: string;
  pdfUrl?: string;
  externalUrl?: string;
  visibleTo?: string;
  isActive?: boolean;
  order?: number;
}

/** Published books for the public book section. */
export async function getBooks(): Promise<LiveBookRow[] | null> {
  return pickDb<LiveBookRow>(await apiItems("/api/books"));
}

/** Active popup inventory for the admin-ready popup model. */
export async function getPopups(): Promise<PopupContent[]> {
  return getVisibleAds()
    .filter((a) => a.type === "popup")
    .map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      mediaType: a.mediaType,
      mediaUrl: a.mediaUrl,
      buttonText: a.ctaText,
      buttonUrl: a.ctaLink,
      delayMs: POPUP_DEFAULTS.delayMs,
      frequency: POPUP_DEFAULTS.frequency,
      active: a.isActive,
    }));
}

/** Live banners: database rows win; otherwise the admin mockStore stays source of truth. */
export async function getBanners(): Promise<BannerContent[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = pickDb<any>(await apiItems("/api/banners"));
  if (db) {
    return db.map((b, i) => ({
      id: String(b.id),
      title: String(b.title ?? ""),
      subtitle: String(b.subtitle ?? ""),
      description: String(b.description ?? ""),
      mediaType: (b.videoUrl ? "video" : "image") as "image" | "video",
      mediaUrl: String(b.imageUrl ?? b.image ?? b.videoUrl ?? ""),
      buttonText: String(b.buttonText ?? ""),
      buttonUrl: String(b.buttonUrl ?? ""),
      active: b.isActive ?? b.active ?? true,
      order: typeof b.displayOrder === "number" ? b.displayOrder : (b.order ?? i),
    }));
  }
  return getVisibleAds().map((a, i) => ({
    id: a.id,
    title: a.title,
    subtitle: a.subtitle,
    description: a.description,
    mediaType: a.mediaType,
    mediaUrl: a.mediaUrl,
    buttonText: a.ctaText,
    buttonUrl: a.ctaLink,
    active: a.isActive,
    order: a.priority ?? i,
  }));
}

/**
 * Phase 11 — homepage ad inventory in mockStore shape, database-first.
 * Returns null when PostgreSQL has no rows so callers fall back to the
 * local mockStore (dev) or render nothing (production, gated there).
 * Enforces active flag + start/end window + display order server-side
 * (client clock used only for display filtering).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bannerRowToAd(b: any, type: AdType): Advertisement | null {
  const active = b.isActive ?? b.active ?? true;
  if (!active) return null;
  const now = Date.now();
  const start = b.startDate ? Date.parse(b.startDate) : NaN;
  const end = b.endDate ? Date.parse(b.endDate) : NaN;
  if (!Number.isNaN(start) && now < start) return null;
  if (!Number.isNaN(end) && now > end) return null;
  return {
    id: String(b.id),
    title: String(b.title ?? ""),
    subtitle: String(b.subtitle ?? ""),
    description: String(b.description ?? ""),
    mediaType: b.videoUrl ? "video" : "image",
    mediaUrl: String(b.imageUrl ?? b.image ?? b.videoUrl ?? ""),
    posterUrl: "",
    ctaText: String(b.buttonText ?? ""),
    ctaLink: String(b.buttonUrl ?? ""),
    type,
    priority: typeof b.displayOrder === "number" ? b.displayOrder : (b.order ?? 0),
    startDate: b.startDate ? String(b.startDate).slice(0, 10) : "2025-01-01",
    endDate: b.endDate ? String(b.endDate).slice(0, 10) : "2030-12-31",
    isActive: true,
    autoplay: true,
    muted: true,
    loop: true,
    audioEnabled: false,
    createdAt: "",
    updatedAt: "",
  };
}

export async function getLiveBanners(): Promise<Advertisement[] | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = pickDb<any>(await apiItems("/api/banners"));
  if (!db) return null;
  const ads = db
    .map((b) => bannerRowToAd(b, "banner"))
    .filter((a): a is Advertisement => a !== null)
    .sort((a, b) => a.priority - b.priority);
  return ads.length > 0 ? ads : null;
}

export async function getLivePopups(): Promise<Advertisement[] | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = pickDb<any>(await apiItems("/api/popups"));
  if (!db) return null;
  const ads = db
    .map((b) => bannerRowToAd(b, "popup"))
    .filter((a): a is Advertisement => a !== null);
  return ads.length > 0 ? ads : null;
}

export interface EnquiryInput {
  name: string;
  mobile: string;
  email: string;
  course: string;
  message: string;
  batch?: string;
  className?: string;
}

export interface EnquiryResult {
  ok: boolean;
  reference: string;
  /** Human-safe failure message (server message when available). */
  error?: string;
  /** Machine code (e.g. ENQUIRY_UNAVAILABLE, ENQUIRY_RATE_LIMITED). */
  code?: string;
  /** True when retrying later may succeed (unavailable/rate-limited/offline). */
  retryable: boolean;
}

/**
 * Enquiry submission — honest transport, no mock fallback.
 * Success returns the real server reference. Every failure returns ok:false
 * with a safe message: validation errors are final, while service
 * outages/rate limits/network failures are marked retryable so the UI can
 * say so and keep the user's input. Nothing is ever faked.
 */
export async function submitEnquiry(input: EnquiryInput): Promise<EnquiryResult> {
  const fail = (error: string, code?: string, retryable = false): EnquiryResult => ({
    ok: false,
    reference: "",
    error,
    code,
    retryable,
  });
  try {
    if (typeof window === "undefined") {
      return fail("Enquiry form needs a browser session.", "ENQUIRY_NO_BROWSER", false);
    }
    const context: string[] = [];
    if (input.course.trim()) context.push(`Course: ${input.course.trim().slice(0, 80)}`);
    if (input.className && input.className.trim()) context.push(`Class: ${input.className.trim().slice(0, 40)}`);
    if (input.batch && input.batch.trim()) context.push(`Batch: ${input.batch.trim().slice(0, 40)}`);
    const note = input.message.trim().slice(0, 1000);
    const message = [...context, note].filter(Boolean).join("\n");
    const res = await fetch("/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name.trim().slice(0, 80),
        phone: input.mobile.trim().slice(0, 20),
        email: input.email.trim().slice(0, 120),
        message,
      }),
    });
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: { item?: { id?: string } };
      error?: string;
      code?: string;
    } | null;
    if (res.ok && json?.success === true) {
      return {
        ok: true,
        reference: `ENQ-${String(json.data?.item?.id ?? "").slice(-6).toUpperCase() || "SENT"}`,
        retryable: false,
      };
    }
    const serverMessage = typeof json?.error === "string" && json.error ? json.error : null;
    if (res.status === 429) {
      return fail(serverMessage ?? "Too many enquiries. Please try again in a few minutes.", json?.code ?? "ENQUIRY_RATE_LIMITED", true);
    }
    if (res.status === 503) {
      return fail(
        serverMessage ?? "Enquiry service is temporarily unavailable. Please try again later or call us directly.",
        json?.code ?? "ENQUIRY_UNAVAILABLE",
        true
      );
    }
    if (res.status === 400) {
      return fail(serverMessage ?? "Please check the highlighted fields and try again.", json?.code, false);
    }
    return fail(serverMessage ?? "Could not send the enquiry. Please try again.", json?.code, true);
  } catch {
    return fail("Cannot reach the server. Check your connection and try again — your details are kept.", "ENQUIRY_NETWORK", true);
  }
}
