"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { CONTACT } from "@/data/contact";

/**
 * Floating enquiry CTA. Desktop pill + mobile compact button.
 * Opens WhatsApp when WHATSAPP_FLOAT mode is on, else scrolls to #contact.
 * Number comes from data/contact.ts — never hardcoded here.
 */
const MODE: "whatsapp" | "enquiry" = "whatsapp";

export function EnquireFloat() {
  const [contactVisible, setContactVisible] = useState(false);
  const href = MODE === "whatsapp" ? CONTACT.whatsappHref : "#contact";

  useEffect(() => {
    const contactSection = document.getElementById("contact");
    if (!contactSection || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      ([entry]) => setContactVisible(entry.isIntersecting),
      { threshold: 0.12 },
    );
    observer.observe(contactSection);
    return () => observer.disconnect();
  }, []);

  if (contactVisible) return null;

  return (
    <>
      <a
        href={href}
        target={MODE === "whatsapp" ? "_blank" : undefined}
        rel="noreferrer"
        aria-label="Enquire now on WhatsApp"
        className="animate-glow fixed bottom-20 left-4 z-40 hidden items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-extrabold text-white shadow-card transition hover:brightness-110 md:inline-flex"
      >
        <MessageCircle className="h-4 w-4" /> Enquire Now
      </a>
      <a
        href={href}
        target={MODE === "whatsapp" ? "_blank" : undefined}
        rel="noreferrer"
        aria-label="Enquire now"
        className="fixed bottom-20 right-4 z-40 rounded-full bg-[#25D366] p-3.5 text-white shadow-card transition hover:brightness-110 md:hidden"
      >
        <MessageCircle className="h-5 w-5" />
      </a>
    </>
  );
}
