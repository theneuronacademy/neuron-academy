// Promotional banner content contract. The live ad system
// (lib/mockStore.ts, admin-controlled) stays the source of truth —
// this file only defines the shape + offline fallbacks for the
// reusable Banner UI, and will map 1:1 to backend banner records later.

export interface BannerContent {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  buttonText: string;
  buttonUrl: string;
  active: boolean;
  order: number;
}

export const FALLBACK_BANNERS: BannerContent[] = [];

export const BANNER_DEFAULTS = {
  autoplayMs: 6000,
};
