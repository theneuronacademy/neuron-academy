"use client";

import Link from "next/link";
import { Download, Facebook, Instagram, Linkedin, MapPin, MessageCircle, Send, Star, Youtube } from "lucide-react";
import { Logo } from "@/components/website/Logo";
import { CONTACT_INFO, SOCIAL_LINKS } from "@/lib/websiteData";
import { EXAM_PAGES } from "@/data/exams";
import { CONTACT } from "@/data/contact";

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
            Coaching for Classes 6 to 12 in Shaheen Bagh, New Delhi: JMI, AMU and CM SHRI entrances, CBSE boards, NEET and JEE.
          </p>
          <a href={CONTACT.MAP_LINK_URL} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-start gap-2 text-sm text-neutral-600 transition hover:text-brand-primary underline-offset-4 hover:underline">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
            {CONTACT_INFO.address}
          </a>
          <a href={CONTACT.GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-brand-primary underline-offset-4 hover:underline">
            <Star className="h-4 w-4" aria-hidden /> Review us on Google
          </a>
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
            {EXAM_PAGES.map((exam) => (
              <li key={exam.slug}>
                <Link href={`/coaching/${exam.slug}`} className="text-neutral-600 transition-colors hover:text-brand-primary">{exam.label} coaching</Link>
              </li>
            ))}
            <li><Link href="/#courses" className="text-neutral-600 transition-colors hover:text-brand-primary">All courses</Link></li>
            <li><Link href="/faculty" className="text-neutral-600 transition-colors hover:text-brand-primary">Faculty</Link></li>
            <li><Link href="/#gallery" className="text-neutral-600 transition-colors hover:text-brand-primary">Campus gallery</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-bold text-navy-950">Student resources</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li><a href="https://estudde.com/" target="_blank" rel="noopener noreferrer" className="text-neutral-600 transition-colors hover:text-brand-primary">Student Portal</a></li>
            <li><a href="https://web.proctur.com/" target="_blank" rel="noopener noreferrer" className="text-neutral-600 transition-colors hover:text-brand-primary">Faculty Portal</a></li>
            <li><a href="https://play.google.com/store/apps/details?id=com.proctur.app223551" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-neutral-600 transition-colors hover:text-brand-primary"><Download className="h-4 w-4 shrink-0" /> Download Student App</a></li>
            
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
          <p>JMI · AMU · CM SHRI · CBSE · NEET · JEE</p>
        </div>
      </div>
    </footer>
  );
}
