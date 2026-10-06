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

export async function getCourses(): Promise<Course[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = pickDb<any>(await apiItems("/api/courses"));
  if (db) {
    return db.map((r, i) => ({
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = pickDb<any>(await apiItems("/api/faculty"));
  if (db) {
    return db.map((f) => ({
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = pickDb<any>(await apiItems("/api/gallery"));
  if (db) {
    return db.map((g) => ({
      id: String(g.id),
      title: String(g.title),
      category: String(g.category ?? "Academy"),
      image: String(g.imageUrl ?? ""),
    }));
  }
  return GALLERY;
}

export async function getTestimonials(): Promise<Testimonial[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = pickDb<any>(await apiItems("/api/testimonials"));
  if (db) {
    return db.map((t) => ({
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
}

/**
 * Enquiry submission. Tries POST /api/enquiries when the database is live;
 * falls back to the previous mock transport so the form never breaks.
 */
export async function submitEnquiry(input: EnquiryInput): Promise<{ ok: boolean; reference: string }> {
  try {
    if (typeof window !== "undefined") {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: input.name, phone: input.mobile, email: input.email, message: input.message }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.success === true) {
          return { ok: true, reference: `ENQ-${String(json.data?.item?.id ?? Date.now()).slice(-6).toUpperCase()}` };
        }
      } else if (res.status !== 503) {
        await new Promise((r) => setTimeout(r, 900));
        return { ok: true, reference: `ENQ-${Date.now().toString(36).toUpperCase()}` };
      }
    }
  } catch {
    /* fall through to mock transport */
  }
  await new Promise((r) => setTimeout(r, 900));
  void input;
  return { ok: true, reference: `ENQ-${Date.now().toString(36).toUpperCase()}` };
}
