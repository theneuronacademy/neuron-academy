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

export const FALLBACK_BANNERS: BannerContent[] = [
  {
    id: "fallback-1",
    title: "Admissions Open 2026–27 — JEE • NEET • AMU • Jamia",
    subtitle: "New batches starting soon",
    description: "Small batches, weekly mocks and mentors who track every mark.",
    mediaType: "image",
    mediaUrl: "",
    buttonText: "Explore Courses",
    buttonUrl: "#courses",
    active: true,
    order: 1,
  },
  {
    id: "fallback-2",
    title: "Weekly Mock Tests With Ranks",
    subtitle: "Practice • Perform • Improve",
    description: "Exam-pattern mocks every Saturday with solutions and analysis.",
    mediaType: "image",
    mediaUrl: "",
    buttonText: "Take a Demo Test",
    buttonUrl: "/student/login",
    active: true,
    order: 2,
  },
];

export const BANNER_DEFAULTS = {
  autoplayMs: 6000,
};
