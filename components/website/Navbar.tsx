"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { NAV_LINKS } from "@/lib/websiteData";
import { Logo } from "@/components/website/Logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/primitives";
import { PublicBackground } from "@/components/design-system/BackgroundPatterns";

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
          ? "border-b border-silver-200 bg-white/95 shadow-card backdrop-blur-md"
          : "border-b border-transparent bg-white/80 backdrop-blur-sm"
      )}
    >
      <PublicBackground className="absolute inset-0 -z-10 opacity-30" />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 relative">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-bold transition",
                active === l.href.slice(1)
                  ? "bg-slate-100 text-slate-900 shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/scholarship-tests" className="rounded-xl px-3 py-2 text-sm font-bold text-crimson hover:bg-rose-50 border border-rose-200">
            Scholarship Tests
          </Link>
          <Link href="/student/login" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 border border-slate-200">
            Student Login
          </Link>
          <Link href="/faculty/login" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 border border-slate-200">
            Faculty Login
          </Link>
          <Link href="/admin/login" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 border border-slate-200">
            Admin
          </Link>
          <Link href="#contact" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
            Enquire Now
          </Link>
        </div>
        <button
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-silver-200 bg-white px-4 py-4 lg:hidden" aria-label="Mobile">
          <PublicBackground className="absolute inset-0 -z-10 opacity-20" />
          <div className="grid gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-[15px] font-bold",
                  active === l.href.slice(1) ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-100"
                )}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 grid gap-2 border-t border-silver-200 pt-3">
              <Link href="/scholarship-tests" onClick={() => setOpen(false)} className="rounded-xl bg-rose-600 px-4 py-2.5 text-center text-sm font-bold text-white">
                Scholarship Tests
              </Link>
              <Link href="/student/login" onClick={() => setOpen(false)} className="rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-bold text-white">
                Student Login
              </Link>
              <Link href="/faculty/login" onClick={() => setOpen(false)} className="rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-bold text-white">
                Faculty Login
              </Link>
              <Link href="/admin/login" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-center text-sm font-bold text-slate-700">
                Admin Login
              </Link>
              <Link href="#contact" onClick={() => setOpen(false)} className="rounded-xl bg-rose-600 px-4 py-2.5 text-center text-sm font-bold text-white">
                Enquire Now
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}