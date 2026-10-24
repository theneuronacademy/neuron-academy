// Shared banner motion/animation vocabulary.
// Used by the admin banner form (Motion / Animation Style selector) and by
// the public website (TopRunningBanner, Hero) so both sides stay in sync.
// Value "none" (or anything unknown/legacy) renders with no animation.

export type BannerAnimation =
  | "none"
  | "fade"
  | "slide-up"
  | "slide-left"
  | "slide-right"
  | "float"
  | "zoom";

export const BANNER_ANIMATIONS: { value: BannerAnimation; label: string; hint: string }[] = [
  { value: "none", label: "None", hint: "No motion — banner simply appears." },
  { value: "fade", label: "Fade in", hint: "Gentle opacity transition." },
  { value: "slide-up", label: "Slide up", hint: "Content rises into place." },
  { value: "slide-left", label: "Slide from left", hint: "Content enters from the left edge." },
  { value: "slide-right", label: "Slide from right", hint: "Content enters from the right edge." },
  { value: "float", label: "Gentle float", hint: "Soft, endless floating motion." },
  { value: "zoom", label: "Subtle zoom", hint: "Slight settle-in zoom." },
];

const ANIMATION_CLASSES: Record<BannerAnimation, string> = {
  none: "",
  fade: "animate-banner-fade",
  "slide-up": "animate-banner-slide-up",
  "slide-left": "animate-banner-slide-left",
  "slide-right": "animate-banner-slide-right",
  float: "animate-banner-float",
  zoom: "animate-banner-zoom",
};

export function isBannerAnimation(v: unknown): v is BannerAnimation {
  return typeof v === "string" && v in ANIMATION_CLASSES;
}

/** Normalise any legacy/unknown value to "none". */
export function toBannerAnimation(v: unknown): BannerAnimation {
  return isBannerAnimation(v) ? v : "none";
}

/** Tailwind animation class for a banner animation value ("" for none). */
export function bannerAnimationClass(v: unknown): string {
  return ANIMATION_CLASSES[toBannerAnimation(v)];
}
