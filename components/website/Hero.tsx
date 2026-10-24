"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Volume2, VolumeX, ArrowRight, Phone, ShieldCheck, MapPin } from "lucide-react";
import type { Advertisement } from "@/lib/types";
import { getHeroAds } from "@/lib/mockStore";
import { getLiveBanners } from "@/services/siteApi";
import { SmartImage, SITE_PHOTOS } from "@/lib/siteImages";
import { Marquee } from "@/components/website/motion";
import { EXAM_TICKER } from "@/lib/websiteData";
import { PublicBackground } from "@/components/design-system/BackgroundPatterns";
import { bannerAnimationClass } from "@/components/website/bannerMotion";
import { cn } from "@/lib/utils";

const EXAM_PILLS = [
  { label: "JEE", color: "border-brand-primary/20 bg-brand-primary/10 text-brand-primary" },
  { label: "NEET", color: "border-silver-200 bg-white text-navy-800" },
  { label: "AMU Entrance", color: "border-brand-secondary/40 bg-brand-secondary/15 text-brand-secondary-800" },
  { label: "Jamia Entrance", color: "border-brand-secondary/40 bg-brand-secondary/15 text-brand-secondary-800" },
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
          preload="metadata"
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
          className="absolute bottom-4 right-4 z-[3] rounded-full bg-neutral-900/80 p-2.5 text-white backdrop-blur hover:bg-neutral-800"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  if (ad.mediaUrl && !failed) {
    return <Image src={ad.mediaUrl} alt={ad.title || "Neuron Academy featured announcement"} width={1200} height={800} unoptimized className="animate-kenburns h-full w-full object-cover" priority={large} onError={() => setFailed(true)} />;
  }

  return (
    <SmartImage
      src={SITE_PHOTOS.hero}
      alt="Neuron Academy campus"
      className="h-full w-full"
      imgClassName="animate-kenburns h-full w-full object-cover"
      eager={large}
      fallback={
        <div className="bg-neutral-900 flex h-full w-full flex-col justify-end overflow-hidden p-6 sm:p-8">
          <div className="animate-kenburns absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #1746B8 0, transparent 42%), radial-gradient(circle at 80% 25%, #D4AF37 0, transparent 38%), radial-gradient(circle at 50% 90%, #0A1D50 0, transparent 35%)" }} />
          <p className="relative text-[11px] font-bold tracking-[0.2em] text-brand-secondary">NEURON ACADEMY • SHAHEEN BAGH</p>
          <p className="relative mt-2 max-w-md text-2xl font-extrabold text-white sm:text-3xl">{ad.title}</p>
          {ad.subtitle ? <p className="relative mt-1 text-sm font-bold text-neutral-300">{ad.subtitle}</p> : null}
        </div>
      }
    />
  );
}

export function Hero() {
  const [heroAds, setHeroAds] = useState<Advertisement[]>([]);

  useEffect(() => {
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
    <section id="home" className="relative overflow-hidden bg-white">
      <PublicBackground className="opacity-35" />
      <div className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-brand-primary/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute bottom-10 left-1/4 h-48 w-48 rounded-full bg-brand-secondary/10 blur-3xl" aria-hidden />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14 lg:py-20">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-primary/15 bg-brand-primary/5 px-3.5 py-2 text-[11px] font-bold tracking-[0.14em] text-brand-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-secondary" /> NEURON ACADEMY <span className="text-silver-400">/</span> SHAHEEN BAGH
          </p>
          <h1 className="mt-6 text-[40px] font-extrabold leading-[1.07] tracking-tight text-navy-950 sm:text-5xl lg:text-[60px]">
            Focused coaching for
            <span className="mt-1 block text-brand-primary">your next big step.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            Prepare for JEE, NEET, AMU and Jamia entrances with a clear study plan, regular practice and support from your mentors.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {EXAM_PILLS.map((pill) => (
              <span key={pill.label} className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${pill.color}`}>
                {pill.label}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#courses" className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3.5 text-sm font-bold text-white shadow-primary transition hover:bg-brand-primary-hover">
              Explore courses <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#contact" className="inline-flex items-center gap-2 rounded-xl border border-silver-300 bg-white px-5 py-3.5 text-sm font-bold text-navy-900 transition hover:border-brand-primary/30 hover:bg-brand-primary/5 hover:text-brand-primary">
              <Phone className="h-4 w-4" /> Book a free demo class
            </a>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-neutral-600">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-primary" /> Mentor support</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-primary" /> Regular mock tests</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-primary" /> Digital practice tools</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[640px]">
          <div className="absolute -inset-3 rounded-[30px] bg-gradient-to-br from-brand-primary/15 via-brand-secondary/15 to-brand-primary/10 blur-xl" aria-hidden />
          <div
            className={cn(
              "group relative isolate h-[350px] overflow-hidden rounded-[24px] border border-silver-200 bg-navy-900 shadow-xl transition duration-500 hover:border-silver-300 hover:shadow-card-hover sm:h-[430px] lg:h-[500px]",
              // Admin-selected motion style for the featured banner.
              active && active.animation && active.animation !== "none" ? bannerAnimationClass(active.animation) : "",
            )}
          >
            {active ? (
              <AdMedia ad={active} large />
            ) : (
              <SmartImage
                src={SITE_PHOTOS.hero}
                alt="Students studying at Neuron Academy"
                className="absolute inset-0 h-full w-full"
                imgClassName="h-full w-full object-cover"
                eager
                fallback={
                  <div className="absolute inset-0 flex items-end bg-gradient-to-br from-navy-900 via-navy-800 to-brand-primary p-8">
                    <p className="max-w-md text-2xl font-bold text-white sm:text-3xl">JEE · NEET · AMU · Jamia</p>
                  </div>
                }
              />
            )}
            <div className="absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-navy-950/90 via-navy-950/45 to-transparent px-5 pb-5 pt-24 sm:px-7 sm:pb-7">
              {active ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-secondary-300">{active.subtitle || "Featured at Neuron Academy"}</p>
                  <p className="mt-2 text-xl font-bold text-white sm:text-2xl">{active.title}</p>
                  {active.description ? <p className="mt-1 max-w-lg text-sm text-white/80">{active.description}</p> : null}
                  {active.ctaText ? <a href={active.ctaLink || "#courses"} className="relative z-[3] mt-3 inline-flex items-center gap-2 text-sm font-bold text-white underline decoration-brand-secondary underline-offset-4">{active.ctaText}<ArrowRight className="h-4 w-4" /></a> : null}
                </>
              ) : (
                <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur">
                  <MapPin className="h-4 w-4 text-brand-secondary-300" /> Shaheen Bagh, New Delhi
                </p>
              )}
            </div>
            {active && active.ctaLink ? (
              <a href={active.ctaLink} target={active.ctaLink.startsWith("http") ? "_blank" : undefined} rel={active.ctaLink.startsWith("http") ? "noopener noreferrer" : undefined} className="absolute inset-0 z-[2] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary/60" aria-label={`${active.title} — open banner destination`}>
                <span className="sr-only">{active.ctaText || active.title}</span>
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t border-silver-200 bg-silver-50 py-3">
        <Marquee items={EXAM_TICKER} className="text-navy-700" itemClassName="text-navy-700" />
      </div>
    </section>
  );
}
