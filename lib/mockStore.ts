"use client";

import type { AdFilter, Advertisement } from "@/lib/types";

// Centralized advertisement store (mock). All public + admin surfaces read
// from here. Swap these functions with API calls later — component contracts
// stay the same.

const STORAGE_KEY = "neuron_ads_v1";
const POPUP_KEY = "neuron_ad_popup_dismissed";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function uid(prefix = "ad"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const seedAds: Advertisement[] = [
  {
    id: "seed-hero-1",
    title: "SSC CGL 2027 — Foundation Batch",
    subtitle: "Admissions Open",
    description: "Structured maths + reasoning track with weekly mocks and mentor reviews.",
    mediaType: "image",
    mediaUrl: "",
    posterUrl: "",
    ctaText: "Explore Courses",
    ctaLink: "#courses",
    type: "hero",
    priority: 100,
    startDate: "2025-01-01",
    endDate: "2030-12-31",
    isActive: true,
    autoplay: true,
    muted: true,
    loop: true,
    audioEnabled: false,
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
  },
  {
    id: "seed-banner-1",
    title: "JEE Main Test Series — Weekly Mocks",
    subtitle: "Practice. Perform. Improve.",
    description: "60-question mocks with ranks, solutions and time analysis every Saturday.",
    mediaType: "image",
    mediaUrl: "",
    posterUrl: "",
    ctaText: "View Test Platform",
    ctaLink: "#contact",
    type: "banner",
    priority: 90,
    startDate: "2025-01-01",
    endDate: "2030-12-31",
    isActive: true,
    autoplay: true,
    muted: true,
    loop: true,
    audioEnabled: false,
    createdAt: "2026-09-21T10:00:00.000Z",
    updatedAt: "2026-09-21T10:00:00.000Z",
  },
];

function readStore(): Advertisement[] {
  if (typeof window === "undefined") return [...seedAds];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedAds));
      return [...seedAds];
    }
    const parsed = JSON.parse(raw) as Advertisement[];
    if (!Array.isArray(parsed)) return [...seedAds];
    return parsed;
  } catch {
    return [...seedAds];
  }
}

function writeStore(ads: Advertisement[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ads));
    window.dispatchEvent(new CustomEvent("neuron-ads-updated"));
  } catch {
    /* storage full — ignore for demo */
  }
}

export function getAllAds(): Advertisement[] {
  return readStore().sort((a, b) => b.priority - a.priority || b.updatedAt.localeCompare(a.updatedAt));
}

export function getAdById(id: string): Advertisement | null {
  return readStore().find((a) => a.id === id) ?? null;
}

export function createAd(input: Omit<Advertisement, "id" | "createdAt" | "updatedAt">): Advertisement {
  const now = new Date().toISOString();
  const ad: Advertisement = { ...input, id: uid("ad"), createdAt: now, updatedAt: now };
  writeStore([ad, ...readStore()]);
  return ad;
}

export function updateAd(id: string, patch: Partial<Advertisement>): Advertisement | null {
  const all = readStore();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  const updated: Advertisement = { ...all[idx], ...patch, id, updatedAt: new Date().toISOString() };
  all[idx] = updated;
  writeStore(all);
  return updated;
}

export function deleteAd(id: string): void {
  writeStore(readStore().filter((a) => a.id !== id));
}

export function toggleAdActive(id: string): Advertisement | null {
  const ad = getAdById(id);
  if (!ad) return null;
  return updateAd(id, { isActive: !ad.isActive });
}

function inWindow(ad: Advertisement, today: string): boolean {
  return ad.startDate <= today && today <= ad.endDate;
}

/** Public filtering: active + within date window. */
export function getVisibleAds(today: string = todayISO()): Advertisement[] {
  return readStore()
    .filter((a) => a.isActive && inWindow(a, today))
    .sort((a, b) => b.priority - a.priority);
}

export function getHeroAds(): Advertisement[] {
  return getVisibleAds().filter((a) => a.type === "hero");
}

export function getCarouselAds(): Advertisement[] {
  return getVisibleAds().filter((a) =>
    ["banner", "course", "admission", "result"].includes(a.type)
  );
}

export function getPopupAds(): Advertisement[] {
  return getVisibleAds().filter((a) => a.type === "popup");
}

export function getAnnouncementAds(): Advertisement[] {
  return getVisibleAds().filter((a) => a.type === "announcement");
}

export function filterAds(ads: Advertisement[], filter: AdFilter, today: string = todayISO()): Advertisement[] {
  switch (filter) {
    case "active":
      return ads.filter((a) => a.isActive && inWindow(a, today));
    case "inactive":
      return ads.filter((a) => !a.isActive);
    case "scheduled":
      return ads.filter((a) => a.startDate > today);
    case "expired":
      return ads.filter((a) => a.endDate < today);
    case "popup":
    case "hero":
    case "banner":
      return ads.filter((a) => a.type === filter);
    default:
      return ads;
  }
}

// Popup session helpers
export function wasPopupDismissedThisSession(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(POPUP_KEY) === "session-dismissed";
  } catch {
    return true;
  }
}

export function markPopupDismissed(): void {
  try {
    window.localStorage.setItem(POPUP_KEY, "session-dismissed");
  } catch {
    /* ignore */
  }
}

export function clearPopupDismissedForDemo(): void {
  try {
    window.localStorage.removeItem(POPUP_KEY);
  } catch {
    /* ignore */
  }
}

export { todayISO, uid, POPUP_KEY };
