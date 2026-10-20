import Link from "next/link";
import { MapPin } from "lucide-react";
import { Logo } from "@/components/website/Logo";
import { Marquee } from "@/components/website/motion";
import { COURSES, CONTACT_INFO, SOCIAL_LINKS } from "@/lib/websiteData";

const FOOTER_TICKER = [
  "🎉 Admissions Open 2026",
  "🧠 Activate Your Neuron",
  "📝 Weekly Mocks + PYQs",
  "🏆 JEE • NEET • AMU • Jamia",
  "💡 Doubt Lounge Till 8 PM",
  "🚀 Small Batches, Big Ranks",
];

const SOCIAL_ICONS = {
  instagram: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#FF0000" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#1877F2" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#0088cc" aria-hidden="true">
      <path d="M11.944 2.016A9.996 9.996 0 0 0 2.016 11.944C2.016 16.404 4.232 20.512 8.172 23.256c1.214.844 1.82 2.132 1.456 3.408-.344 1.224-1.264 2.032-2.432 2.176C3.74 27.712 0 24.512 0 19.936 0 8.944 8.944 0 19.936 0c5.568 0 10.672 2.672 13.976 6.884.12.152.24.304.336.472.536 1.08.848 2.224.848 3.44 0 2.328-.952 4.52-2.624 6.136-1.648 1.6-3.84 2.52-6.416 2.52-.488 0-.968-.04-1.448-.112-.984-.152-1.912-.608-2.72-1.368-.672-.624-1.2-.688-1.872-.176-.784.616-1.52 1.144-2.32 1.384-1.048.328-2.136.24-3.168-.312-1.024-.56-1.616-1.56-1.616-2.72 0-.992.424-1.912 1.216-2.72.544-.544 1.128-1.12 1.664-1.6.472-.4 1.16-.8 1.728-1.04.312-.136.688-.032.96.272.168.184.336.432.384.736.304 1.904.544 3.92.544 5.856 0 6.608-5.36 11.968-11.968 11.968S2.016 18.552 2.016 11.944c0-2.416.776-4.744 2.12-6.632.536-.744 1.248-1.288 2.024-1.624.832-.352 1.736-.352 2.648 0 .64.28 1.208.752 1.744 1.192.536.44.832 1.016.832 1.664 0 .304-.04.592-.112.872-.52.936-1.2 1.712-2.048 2.344-.776.608-1.648.944-2.592.944-1.888 0-3.712-.768-5.008-2.312A9.99 9.99 0 0 1 11.944 2.016z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#0A66C2" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#25D366" aria-hidden="true">
      <path d="M19.11 17.205c-.372 0-.744-.216-1.08-.528l-2.688-2.472a21.542 21.542 0 0 1-3.024-2.808c-.3-.372-.492-.744-.492-1.212 0-.48.108-.792.324-1.128.204-.312.336-.648.504-.996.168-.336.048-.6-.156-1.08a11.89 11.89 0 0 0-.732-1.524c-.24-.264-.468-.552-.684-.84-.216-.3-.3-.612-.216-.948.108-.312.324-.672.528-.996.216-.312.552-.816.864-1.224.324-.432.756-.816 1.296-1.068.444-.204.888-.384 1.38-.564a11.3 11.3 0 0 1 1.572-.576c.6.024 1.212.252 1.68.672.468.42.756.972.756 1.608 0 .432-.096.852-.264 1.248-.18.432-.528 1.02-1.116 1.704-.504.576-1.092 1.308-1.632 1.848-.516.54-1.104 1.14-1.56 1.668-.372.516-.624 1.056-.672 1.332-.036.288-.036.576-.036.864 0 .72.42 1.428 1.26 1.752.672.252 1.416.336 2.172.312.72-.024 1.392-.18 1.968-.42.6-.24 1.128-.648 1.5-1.104.456-.54.732-1.176.732-1.704 0-.24-.012-.492-.048-.744zM12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.205-.012-3.584-.069-4.849-.149-3.225-1.664-4.771-4.919-4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.205-.012-3.584-.069-4.849-.149-3.225-1.664-4.771-4.919-4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.205-.012-3.584-.069-4.849-.149-3.225-1.664-4.771-4.919-4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.205-.012-3.584-.069-4.849-.149-3.225-1.664-4.771-4.919-4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.205-.012-3.584-.069-4.849-.149-3.225-1.664-4.771-4.919-4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.205-.012-3.584-.069-4.849-.149-3.225-1.664-4.771-4.919-4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  ),
} as const;

export function Footer() {
  return (
    <footer className="metallic-dark relative overflow-hidden text-silver-200">
      <div className="pointer-events-none absolute -top-20 left-1/3 h-56 w-56 animate-float rounded-full bg-teal-400/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 h-64 w-64 animate-float-slow rounded-full bg-amber-300/10 blur-3xl" aria-hidden />
      <div className="animate-gradient-pan absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-teal-400 via-amber-300 to-crimson" style={{ backgroundSize: "200% 100%" }} aria-hidden />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo dark />
          <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-silver-300">
            Shaheen Bagh&apos;s entrance-focused academy — JEE, NEET, AMU & Jamia preparation with weekly mocks, doubt lounge and a digital test platform.
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-[12px] font-bold text-silver-300"><MapPin className="h-3.5 w-3.5 text-teal-300" /> {CONTACT_INFO.address}</p>
          <div className="mt-4 flex gap-2">
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                title={s.label}
                className="wiggle-on-hover rounded-lg bg-white/10 p-2.5 text-white transition hover:-translate-y-1 hover:scale-110 hover:bg-teal-500 hover:shadow-card"
              >
                {SOCIAL_ICONS[s.icon]}
              </a>
            ))}
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
      {/* Celebration ticker — decorative marquee, aria-hidden, no links. */}
      <div className="relative border-t border-white/10 bg-white/5">
        <Marquee items={FOOTER_TICKER} speed={30} className="py-2.5 text-silver-200" itemClassName="text-silver-200" />
      </div>
      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-[12px] font-semibold text-silver-300 sm:flex-row sm:px-6">
          <p className="animate-fade-in">🎓 © {new Date().getFullYear()} Neuron Academy, Shaheen Bagh — All Rights Reserved. ✨</p>
          <p className="animate-gradient-text bg-gradient-to-r from-teal-300 via-amber-200 to-teal-300 bg-clip-text font-extrabold text-transparent">🧠 ACTIVATE YOUR NEURONs ⚡</p>
          <p className="animate-fade-in">🎯 JEE • NEET • AMU • Jamia 🚀</p>
        </div>
      </div>
    </footer>
  );
}
