// Social links — single config object. Backend/admin will control
// these later. Placeholder URLs only — never hardcode real accounts
// in components.

export interface SocialLink {
  label: string;
  href: string;
  icon: "instagram" | "youtube" | "facebook" | "telegram" | "linkedin" | "whatsapp";
}

export const SOCIAL_LINKS: SocialLink[] = [
  { label: "Instagram", href: "https://www.instagram.com/neuron.academy_?stkn=Yjc4OHBuMDE5NTZ4", icon: "instagram" },
  { label: "YouTube", href: "https://youtube.com/@neuron.academy?si=BnJ_UBQtmh3KH-tv", icon: "youtube" },
  { label: "Facebook", href: "https://facebook.com", icon: "facebook" },
  { label: "Telegram", href: "https://t.me/", icon: "telegram" },
  { label: "LinkedIn", href: "https://linkedin.com", icon: "linkedin" },
  { label: "WhatsApp", href: "https://wa.me/919711917317", icon: "whatsapp" },
];
