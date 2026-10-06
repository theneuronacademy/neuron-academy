import Link from "next/link";
import { Instagram, Youtube, Facebook, Linkedin, MessageCircle, MapPin, Send } from "lucide-react";
import { Logo } from "@/components/website/Logo";
import { COURSES, CONTACT_INFO, SOCIAL_LINKS } from "@/lib/websiteData";

const SOCIAL_ICONS = {
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
  telegram: Send,
  linkedin: Linkedin,
  whatsapp: MessageCircle,
} as const;

export function Footer() {
  return (
    <footer className="metallic-dark relative overflow-hidden text-silver-200">
      <div className="pointer-events-none absolute -top-20 left-1/3 h-56 w-96 rounded-full bg-teal-400/10 blur-3xl" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-teal-400 via-amber-300 to-crimson" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo dark />
          <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-silver-300">
            Shaheen Bagh&apos;s entrance-focused academy — JEE, NEET, AMU & Jamia preparation with weekly mocks, doubt lounge and a digital test platform.
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-[12px] font-bold text-silver-300"><MapPin className="h-3.5 w-3.5 text-teal-300" /> {CONTACT_INFO.address}</p>
          <div className="mt-4 flex gap-2">
            {SOCIAL_LINKS.map((s) => {
              const Icon = SOCIAL_ICONS[s.icon];
              return (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="rounded-lg bg-white/10 p-2.5 text-white transition hover:-translate-y-0.5 hover:bg-teal-500"
                >
                  <Icon className="h-4 w-4" />
                </a>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-[12px] font-bold tracking-widest text-teal-300">COURSES</p>
          <ul className="mt-3 space-y-2 text-sm font-semibold">
            {COURSES.map((c) => (
              <li key={c.id}><a href="#courses" className="hover:text-white">{c.name}</a></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[12px] font-bold tracking-widest text-teal-300">STUDENTS</p>
          <ul className="mt-3 space-y-2 text-sm font-semibold">
            <li><Link href="/student/login" className="hover:text-white">Student Login</Link></li>
            <li><Link href="/student/tests" className="hover:text-white">Test Platform</Link></li>
            <li><a href="#gallery" className="hover:text-white">Gallery</a></li>
            <li><a href="#contact" className="hover:text-white">Contact</a></li>
            <li><a href="/admin/login" className="hover:text-white">Admin Login</a></li>
          </ul>
        </div>
        <div>
          <p className="text-[12px] font-bold tracking-widest text-teal-300">ACADEMY</p>
          <ul className="mt-3 space-y-2 text-sm font-semibold">
            <li><a href="#about" className="hover:text-white">About</a></li>
            <li><a href="#faculty" className="hover:text-white">Faculty</a></li>
            <li><a href="#results" className="hover:text-white">Results</a></li>
            <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
          </ul>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-[12px] font-semibold text-silver-300 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} Neuron Academy, Shaheen Bagh — All Rights Reserved.</p>
          <p>JEE • NEET • AMU • Jamia</p>
        </div>
      </div>
    </footer>
  );
}
