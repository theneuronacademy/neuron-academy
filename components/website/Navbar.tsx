"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { NAV_LINKS } from "@/lib/websiteData";
import { Logo } from "@/components/website/Logo";
import { cn } from "@/lib/utils";

const PORTAL_LINKS = [
  { href: "/scholarship-tests", label: "Scholarship tests" },
  { href: "https://estudde.com/", label: "Student Portal", external: true },
  { href: "/admin/login", label: "Admin login" },
];

function PortalLink({ link, className, onClick }: { link: { href: string; label: string; external?: boolean }; className?: string; onClick?: () => void }) {
  if (link.external) {
    return (
      <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={className} onClick={onClick}>
        {link.label}
      </a>
    );
  }
  return (
    <Link key={link.href} href={link.href} className={className} onClick={onClick}>
      {link.label}
    </Link>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("home");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const sections = NAV_LINKS.map((link) => document.getElementById(link.href.replace(/^#/, ""))).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
    if (sections.length === 0 || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const navLinkClass = (href: string) =>
    cn(
      "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
      active === href.replace(/^#/, "")
        ? "bg-brand-primary/10 text-brand-primary"
        : "text-neutral-600 hover:bg-brand-primary/5 hover:text-brand-primary",
    );

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-all duration-200",
        scrolled ? "border-silver-200 bg-white/95 shadow-sm backdrop-blur-xl" : "border-transparent bg-white",
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-1 xl:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={navLinkClass(link.href)}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-neutral-600 transition hover:bg-silver-50 hover:text-navy-900 [&::-webkit-details-marker]:hidden">
              Portals <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-silver-200 bg-white p-1.5 shadow-xl">
              {PORTAL_LINKS.map((link) => (
                <PortalLink
                  key={link.href}
                  link={link}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-brand-primary/5 hover:text-brand-primary"
                />
              ))}
            </div>
          </details>
          <Link href="#contact" className="inline-flex items-center justify-center rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white shadow-primary transition hover:bg-brand-primary-hover">
            Enquire now
          </Link>
        </div>

        <button
          className="rounded-xl border border-silver-200 p-2.5 text-navy-900 transition hover:border-brand-primary/30 hover:bg-brand-primary/5 xl:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls={open ? "mobile-navigation" : undefined}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <nav id="mobile-navigation" className="border-t border-silver-200 bg-white px-4 py-4 shadow-lg xl:hidden" aria-label="Mobile">
          <div className="mx-auto grid max-w-7xl gap-1 sm:px-2">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className={cn("rounded-lg px-3 py-3 text-[15px] font-semibold", navLinkClass(link.href))}>
                {link.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-silver-200 pt-3">
              {PORTAL_LINKS.map((link) => (
                <PortalLink
                  key={link.href}
                  link={link}
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-silver-200 px-3 py-2.5 text-center text-sm font-semibold text-neutral-700 transition hover:border-brand-primary/30 hover:bg-brand-primary/5 hover:text-brand-primary"
                />
              ))}
            </div>
            <Link href="#contact" onClick={() => setOpen(false)} className="mt-2 rounded-xl bg-brand-primary px-4 py-3 text-center text-sm font-bold text-white shadow-primary">
              Enquire now
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
