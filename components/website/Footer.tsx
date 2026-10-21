"use client";

import Link from "next/link";
import { Facebook, Instagram, Linkedin, MapPin, MessageCircle, Send, Youtube } from "lucide-react";
import { Logo } from "@/components/website/Logo";
import { COURSES, CONTACT_INFO, SOCIAL_LINKS } from "@/lib/websiteData";

const SOCIAL_ICONS = {
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
  telegram: Send,
  linkedin: Linkedin,
  whatsapp: MessageCircle,
};

export function Footer() {
  return (
    <footer className="border-t border-silver-200 bg-white text-neutral-700">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-neutral-600">
            JEE, NEET, AMU and Jamia entrance preparation in Shaheen Bagh, New Delhi.
          </p>
          <p className="mt-4 flex items-start gap-2 text-sm text-neutral-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
            {CONTACT_INFO.address}
          </p>
          <div className="mt-5 flex gap-2">
            {SOCIAL_LINKS.map((social) => {
              const Icon = SOCIAL_ICONS[social.icon];
              return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  title={social.label}
                  className="rounded-xl border border-silver-200 bg-white p-2.5 text-neutral-700 transition hover:border-brand-primary/30 hover:bg-brand-primary/5 hover:text-brand-primary"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-navy-950">Explore</p>
          <ul className="mt-4 space-y-3 text-sm">
            {COURSES.map((course) => (
              <li key={course.id}>
                <a href="#courses" className="text-neutral-600 transition-colors hover:text-brand-primary">{course.name}</a>
              </li>
            ))}
            <li><a href="#faculty" className="text-neutral-600 transition-colors hover:text-brand-primary">Faculty</a></li>
            <li><a href="#gallery" className="text-neutral-600 transition-colors hover:text-brand-primary">Campus gallery</a></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-bold text-navy-950">Student resources</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li><Link href="/student/login" className="text-neutral-600 transition-colors hover:text-brand-primary">Student login</Link></li>
            <li><Link href="/student/tests" className="text-neutral-600 transition-colors hover:text-brand-primary">Test platform</Link></li>
            <li><Link href="/scholarship-tests" className="text-neutral-600 transition-colors hover:text-brand-primary">Scholarship tests</Link></li>
            <li><Link href="/faculty/login" className="text-neutral-600 transition-colors hover:text-brand-primary">Faculty login</Link></li>
            <li><Link href="/admin/login" className="text-neutral-600 transition-colors hover:text-brand-primary">Admin login</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-bold text-navy-950">Contact</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li><a href="#contact" className="text-neutral-600 transition-colors hover:text-brand-primary">Send an enquiry</a></li>
            <li><a href={`tel:${CONTACT_INFO.phone.replace(/[^+\d]/g, "")}`} className="text-neutral-600 transition-colors hover:text-brand-primary">{CONTACT_INFO.phone}</a></li>
            <li><a href={`mailto:${CONTACT_INFO.email}`} className="break-all text-neutral-600 transition-colors hover:text-brand-primary">{CONTACT_INFO.email}</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-silver-200 bg-silver-50">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-neutral-500 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} Neuron Academy, Shaheen Bagh</p>
          <p>JEE · NEET · AMU · Jamia preparation</p>
        </div>
      </div>
    </footer>
  );
}
