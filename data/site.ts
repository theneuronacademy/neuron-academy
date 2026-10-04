// Central academy/site content. Components consume this file — never
// hardcode academy content in JSX. Later: replaced by backend API responses
// via services/siteApi.ts without touching UI.

export const ACADEMY = {
  name: "Neuron Academy",
  tagline: "Learn. Prepare. Succeed.",
  branch: "Shaheen Bagh • New Delhi",
  hero: {
    title: "Crack JEE. NEET.",
    titleAccent: "AMU. Jamia.",
    subtitle: "Entrance Specialist",
    description:
      "Shaheen Bagh's focused coaching for engineering, medical and university entrances — small batches, weekly mocks and mentors who track every mark.",
    primaryButton: { label: "Explore Courses", href: "#courses" },
    secondaryButton: { label: "Book Free Demo", href: "#contact" },
    backgroundType: "gradient" as const,
    backgroundUrl: "/images/hero.jpg",
  },
};

export const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Courses", href: "#courses" },
  { label: "Faculty", href: "#faculty" },
  { label: "Results", href: "#results" },
  { label: "Gallery", href: "#gallery" },
  { label: "Contact", href: "#contact" },
] as const;

import { CONTACT } from "@/data/contact";

export const CONTACT_INFO = {
  phone: CONTACT.phone,
  whatsapp: CONTACT.whatsapp,
  email: CONTACT.email,
  address: CONTACT.address,
  hours: CONTACT.hours,
};

export const DEFAULT_ANNOUNCEMENT = {
  text: "Admissions Open — New Batches Starting Soon",
  ctaText: "Explore Courses",
  ctaLink: "#courses",
};

export const EXAM_TICKER = [
  "JEE Main + Advanced",
  "NEET-UG",
  "AMU Entrance",
  "Jamia (JMI) Entrance",
  "Foundation IX–X",
  "Weekly Mock Tests",
  "Doubt Lounge Open Till 8 PM",
];

export const HERO_STATS = [
  { value: 2400, suffix: "+", label: "Learners" },
  { value: 4, suffix: "", label: "Exam Tracks" },
  { value: 52, suffix: "", label: "Weekly Mocks / Yr" },
  { value: 15, suffix: "+", label: "Expert Mentors" },
];

export const ABOUT_STATS = [
  { value: 2400, suffix: "+", label: "Learners Guided" },
  { value: 5, suffix: "", label: "Course Tracks" },
  { value: 15, suffix: "+", label: "Expert Mentors" },
  { value: 52, suffix: "", label: "Mocks Every Year" },
];
