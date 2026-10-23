"use client";

import { useEffect, useState } from "react";
import { MessageCircle, MapPin, Phone } from "lucide-react";
import { CONTACT } from "@/data/contact";

export function MobileActionBar() {
  const [contactVisible, setContactVisible] = useState(false);

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

  const whatsappHref = `https://wa.me/91${CONTACT.whatsapp.replace(/\D/g, "").slice(-10)}`;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[55] border-t border-silver-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(10,29,80,0.08)] backdrop-blur md:hidden"
      aria-label="Quick contact actions"
    >
      <div className="grid grid-cols-3 divide-x divide-silver-200">
        <a
          href={CONTACT.phoneHref}
          className="flex items-center justify-center gap-1.5 py-3 text-[13px] font-extrabold text-navy-900 transition hover:bg-brand-primary/5"
        >
          <Phone className="h-4 w-4 text-brand-primary" /> Call
        </a>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 py-3 text-[13px] font-extrabold text-[#128C45] transition hover:bg-[#25D366]/10"
        >
          <MessageCircle className="h-4 w-4 text-[#25D366]" /> WhatsApp
        </a>
        <a
          href={CONTACT.MAP_LINK_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 py-3 text-[13px] font-extrabold text-navy-900 transition hover:bg-brand-primary/5"
        >
          <MapPin className="h-4 w-4 text-brand-primary" /> Directions
        </a>
      </div>
    </div>
  );
}
