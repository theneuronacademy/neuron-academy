// Social links — verified academy accounts only. Placeholders removed
// (Phase 10). Add further networks here once the academy provides them.

export interface SocialLink {
  label: string;
  href: string;
  icon: "instagram" | "youtube" | "facebook" | "telegram" | "linkedin" | "whatsapp";
}

export const SOCIAL_LINKS: SocialLink[] = [
  { label: "Instagram", href: "https://www.instagram.com/neuron.academy_?stkn=Yjc4OHBuMDE5NTZ4", icon: "instagram" },
  { label: "YouTube", href: "https://youtube.com/@neuron.academy?si=BnJ_UBQtmh3KH-tv", icon: "youtube" },
  { label: "WhatsApp", href: "https://wa.me/919711917317", icon: "whatsapp" },
];
