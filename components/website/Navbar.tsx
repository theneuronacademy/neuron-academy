"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { NAV_LINKS } from "@/lib/websiteData";
import { Logo } from "@/components/website/Logo";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("home");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
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
    const ids = ["home", "about", "courses", "faculty", "results", "gallery", "contact"];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-silver-200 bg-white/90 shadow-card backdrop-blur-md"
          : "border-b border-transparent bg-white/60 backdrop-blur-sm"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-bold transition",
                active === l.href.slice(1) ? "bg-navy-50 text-navy-700" : "text-muted hover:bg-silver-50 hover:text-navy-700"
              )}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <a href="/student/login" className="rounded-xl px-3 py-2 text-sm font-bold text-navy-700 hover:bg-silver-50">
            Student Login
          </a>
          <Link href="/faculty/login" className="rounded-xl px-3 py-2 text-sm font-bold text-navy-700 hover:bg-silver-50">
            Faculty Login
          </Link>
          <a href="/admin/login" className="rounded-xl px-3 py-2 text-sm font-bold text-muted hover:text-navy-700">
            Admin
          </a>
          <a href="#contact" className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800">
            Enquire Now
          </a>
        </div>
        <button
          className="rounded-lg p-2 text-navy-700 hover:bg-silver-100 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-silver-200 bg-white px-4 py-4 lg:hidden" aria-label="Mobile">
          <div className="grid gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-[15px] font-bold",
                  active === l.href.slice(1) ? "bg-navy-50 text-navy-700" : "text-ink hover:bg-silver-50"
                )}
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 grid gap-2 border-t border-silver-200 pt-3">
              <a href="/student/login" onClick={() => setOpen(false)} className="rounded-xl bg-navy-700 px-4 py-2.5 text-center text-sm font-bold text-white">
                Student Login
              </a>
              <Link href="/faculty/login" onClick={() => setOpen(false)} className="rounded-xl bg-teal-600 px-4 py-2.5 text-center text-sm font-bold text-white">
                Faculty Login
              </Link>
              <a href="/admin/login" onClick={() => setOpen(false)} className="rounded-xl border border-silver-300 px-4 py-2.5 text-center text-sm font-bold text-navy-700">
                Admin Login
              </a>
              <a href="#contact" onClick={() => setOpen(false)} className="rounded-xl bg-crimson-DEFAULT px-4 py-2.5 text-center text-sm font-bold text-white">
                Enquire Now
              </a>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
