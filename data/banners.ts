// Promotional banner content contract. The live ad system
// (lib/mockStore.ts, admin-controlled) stays the source of truth —
// this file only defines the shape + offline fallbacks for the
// reusable Banner UI, and will map 1:1 to backend banner records later.

import type { BannerAnimation } from "@/lib/types";

export interface BannerContent {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  buttonText: string;
  buttonUrl: string;
  /** Motion style — absent/legacy rows default to "none". */
  animation?: BannerAnimation;
  active: boolean;
  order: number;
}

export const FALLBACK_BANNERS: BannerContent[] = [];

export const BANNER_DEFAULTS = {
  autoplayMs: 6000,
};
