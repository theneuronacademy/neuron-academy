// Central Advertisement model — designed so a real backend/DB can replace
// the localStorage mock store later without changing components.

export type AdMediaType = "image" | "video";

export type AdType =
  | "hero"
  | "banner"
  | "popup"
  | "announcement"
  | "course"
  | "admission"
  | "result";

/** Motion/animation style for admin-configured banners. */
export type BannerAnimation =
  | "none"
  | "fade"
  | "slide-up"
  | "slide-left"
  | "slide-right"
  | "float"
  | "zoom";

export interface Advertisement {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  mediaType: AdMediaType;
  mediaUrl: string;
  posterUrl: string;
  ctaText: string;
  ctaLink: string;
  type: AdType;
  priority: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isActive: boolean;
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  audioEnabled: boolean;
  /** Optional motion style — absent means no animation (legacy rows). */
  animation?: BannerAnimation;
  createdAt: string;
  updatedAt: string;
}

export type AdFilter =
  | "all"
  | "active"
  | "inactive"
  | "scheduled"
  | "expired"
  | "popup"
  | "hero"
  | "banner";
