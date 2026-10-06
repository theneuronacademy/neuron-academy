"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, ArrowRight, Phone, ShieldCheck, Sparkles } from "lucide-react";
import type { Advertisement } from "@/lib/types";
import { getHeroAds } from "@/lib/mockStore";
import { getLiveBanners } from "@/services/siteApi";
import { SmartImage, SITE_PHOTOS } from "@/lib/siteImages";
import { Marquee } from "@/components/website/motion";
import { EXAM_TICKER } from "@/lib/websiteData";

const EXAM_PILLS = [
  { label: "JEE", color: "#1AA6B5" },
  { label: "NEET", color: "#16A34A" },
  { label: "AMU Entrance", color: "#D97706" },
  { label: "Jamia Entrance", color: "#B4453D" },
];

function AdMedia({ ad, large = false }: { ad: Advertisement; large?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(ad.muted !== false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setMuted(ad.muted !== false);
    setFailed(false);
  }, [ad.id, ad.muted]);

  if (ad.mediaType === "video" && ad.mediaUrl && !failed) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <video
          ref={videoRef}
          src={ad.mediaUrl}
          poster={ad.posterUrl || undefined}
          autoPlay={ad.autoplay !== false}
          muted={muted}
          loop={ad.loop !== false}
          playsInline
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
        <button
          onClick={() => {
            const v = videoRef.current;
            if (v) {
              const next = !muted;
              v.muted = next;
              setMuted(next);
              if (!next) v.play().catch(() => {});
            }
          }}
          aria-label={muted ? "Unmute video" : "Mute video"}
          className="absolute bottom-4 right-4 rounded-full bg-navy-800/80 p-2.5 text-white backdrop-blur hover:bg-navy-700"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  if (ad.mediaUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={ad.mediaUrl} alt={ad.title || "Neuron Academy featured announcement"} width={1200} height={800} className="animate-kenburns h-full w-full object-cover" loading={large ? "eager" : "lazy"} />;
  }

  return (
    <SmartImage
      src={SITE_PHOTOS.hero}
      alt="Neuron Academy campus"
      className="h-full w-full"
      imgClassName="animate-kenburns h-full w-full object-cover"
      eager={large}
      fallback={
        <div className="metallic-dark flex h-full w-full flex-col justify-end overflow-hidden p-6 sm:p-8">
          <div className="animate-kenburns absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #1AA6B5 0, transparent 42%), radial-gradient(circle at 80% 25%, #B4453D 0, transparent 38%), radial-gradient(circle at 50% 90%, #16A34A 0, transparent 35%)" }} />
          <p className="relative text-[11px] font-bold tracking-[0.2em] text-teal-300">NEURON ACADEMY • SHAHEEN BAGH</p>
          <p className="relative mt-2 max-w-md text-2xl font-extrabold text-white sm:text-3xl">{ad.title}</p>
          {ad.subtitle ? <p className="relative mt-1 text-sm font-bold text-silver-200">{ad.subtitle}</p> : null}
        </div>
      }
    />
  );
}

export function Hero() {
  const [heroAds, setHeroAds] = useState<Advertisement[]>([]);

  useEffect(() => {
    // Phase 11: database banners win on the public homepage; mockStore stays dev fallback.
    const load = () => {
      void getLiveBanners().then((live) => setHeroAds(live && live.length > 0 ? [live[0]] : getHeroAds()));
    };
    load();
    window.addEventListener("neuron-ads-updated", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("neuron-ads-updated", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  const active = heroAds[0];

  return (
    <section id="home" className="metallic-dark bg-aurora relative overflow-hidden">
      {/* symmetric premium grid + ambient colour fields */}
      <div className="bg-symmetric-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-crimson/25 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute left-1/3 top-1/2 h-72 w-72 rounded-full bg-gold-400/10 blur-3xl" aria-hidden />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-12 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:pt-16">
        <div className="animate-slide-up">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold tracking-[0.16em] text-white backdrop-blur">
            <span className="animate-blink h-1.5 w-1.5 rounded-full bg-teal-300" />
            ADMISSIONS OPEN 2026–27 • SHAHEEN BAGH
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAM_PILLS.map((p) => (
              <span key={p.label} className="rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wide text-white ring-1 ring-white/25" style={{ backgroundColor: `${p.color}55` }}>
                {p.label}
              </span>
            ))}
          </div>
          <h1 className="mt-5 text-[42px] font-extrabold leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-[62px]">
            Crack JEE. NEET.
            <span className="animate-gradient-text mt-2 block bg-gradient-to-r from-teal-300 via-gold-200 to-crimson-100 bg-clip-text text-transparent">
              AMU. Jamia.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-silver-200">
            Shaheen Bagh&apos;s focused coaching for engineering, medical and university entrances — small batches, weekly mocks and mentors who track every mark.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#courses" className="animate-glow btn-metallic-sheen inline-flex items-center rounded-xl bg-crimson px-7 py-3.5 text-[15px] font-bold text-white hover:bg-crimson-bright">
              <Sparkles className="mr-1.5 h-4 w-4" /> Explore Courses <ArrowRight className="ml-1 h-4 w-4" />
            </a>
            <a href="#contact" className="inline-flex items-center rounded-xl border border-white/30 bg-white/10 px-7 py-3.5 text-[15px] font-bold text-white backdrop-blur hover:border-teal-300 hover:text-teal-200">
              <Phone className="mr-1.5 h-4 w-4" /> Book Free Demo
            </a>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-bold text-silver-200">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-teal-300" /> Mentor-guided batches</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-teal-300" /> Weekly mocks with ranks</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-teal-300" /> Parent reports</span>
          </div>
          {active ? (
            <div className="mt-6 rounded-2xl border border-teal-300/30 bg-white/10 p-4 backdrop-blur">
              <p className="text-[11px] font-bold tracking-widest text-teal-300">FEATURED: {active.subtitle || active.type.toUpperCase()}</p>
              <p className="mt-1 text-[15px] font-extrabold text-white">{active.title}</p>
              <p className="mt-0.5 text-sm text-silver-200">{active.description}</p>
              {active.ctaText ? (
                <a href={active.ctaLink || "#courses"} className="mt-2 inline-block text-sm font-bold text-teal-300 hover:underline">
                  {active.ctaText} →
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="relative">
          <div className="absolute -inset-5 rounded-[30px] bg-gradient-to-br from-teal-400/25 via-gold-400/10 to-crimson/25 blur-2xl" aria-hidden />
          <div className="premium-ring premium-ring-dark relative overflow-hidden rounded-[26px] border border-white/30 bg-navy-800" style={{ minHeight: 440 }}>
            {active ? (
              <div className="h-[440px] sm:h-[500px]">
                <AdMedia ad={active} large />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-800/95 via-navy-800/50 to-transparent p-6 pt-20">
                  <p className="inline-block rounded-full bg-teal-500 px-2.5 py-1 text-[10px] font-bold tracking-widest text-white">FEATURED</p>
                  <p className="mt-2 text-[17px] font-extrabold text-white">{active.title}</p>
                  <p className="text-[13px] text-silver-200">{active.description}</p>
                </div>
              </div>
            ) : (
              <div className="relative h-[440px] sm:h-[500px]">
                <SmartImage
                  src={SITE_PHOTOS.hero}
                  alt="Neuron Academy — classroom"
                  className="absolute inset-0 h-full w-full"
                  imgClassName="animate-kenburns h-full w-full object-cover"
                  eager
                  fallback={
                    <div className="metallic-dark absolute inset-0 flex flex-col justify-end overflow-hidden p-8">
                      <div className="animate-kenburns absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(circle at 25% 20%, #1AA6B5 0, transparent 42%), radial-gradient(circle at 80% 30%, #B4453D 0, transparent 38%), radial-gradient(circle at 55% 85%, #D97706 0, transparent 32%)" }} />
                      <p className="relative text-[11px] font-bold tracking-[0.2em] text-teal-300">JEE • NEET • AMU • JAMIA</p>
                      <p className="relative mt-3 text-3xl font-extrabold leading-tight text-white">One Academy. Every Entrance.</p>
                      <p className="relative mt-2 max-w-md text-[15px] text-silver-200">Add <code>hero.jpg</code> to <code>public/images/</code> — your campus photo appears here with cinematic zoom.</p>
                    </div>
                  }
                />
                <div className="animate-float absolute left-4 top-4 rounded-2xl border border-white/40 bg-white/90 px-4 py-2.5 shadow-card backdrop-blur">
                  <p className="text-[10px] font-bold tracking-widest text-muted">WEEKLY MOCKS</p>
                  <p className="text-sm font-extrabold text-navy-700">+ Ranks & solutions</p>
                </div>
                <div className="animate-float-slow absolute right-4 top-1/3 rounded-2xl border border-white/40 bg-white/90 px-4 py-2.5 shadow-card backdrop-blur">
                  <p className="text-[10px] font-bold tracking-widest text-muted">DOUBT LOUNGE</p>
                  <p className="text-sm font-extrabold text-navy-700">Open till 8 PM</p>
                </div>
                <div className="absolute inset-x-4 bottom-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/40 bg-white/90 p-4 shadow-card backdrop-blur"><p className="text-[10px] font-bold tracking-widest text-muted">ATTENDANCE</p><p className="text-xl font-extrabold text-navy-700">Auto-tracked</p></div>
                  <div className="rounded-2xl border border-white/40 bg-white/90 p-4 shadow-card backdrop-blur"><p className="text-[10px] font-bold tracking-widest text-muted">TESTS</p><p className="text-xl font-extrabold text-navy-700">Live ranks</p></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* exam ticker */}
      <div className="relative border-t border-white/10 bg-navy-800/80 py-3 backdrop-blur">
        <Marquee items={EXAM_TICKER} className="text-white" itemClassName="text-white" />
      </div>
    </section>
  );
}
