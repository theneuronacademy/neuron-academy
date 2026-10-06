"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Volume2, VolumeX, ArrowRight } from "lucide-react";
import { getCarouselAds } from "@/lib/mockStore";
import { getLiveBanners } from "@/services/siteApi";
import type { Advertisement } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEFAULT_BANNERS: Advertisement[] = [
  {
    id: "default-top-1",
    title: "SSC CGL 2027 — Admissions Open",
    subtitle: "New batches starting soon",
    description: "Structured maths + reasoning track with weekly mocks and mentor reviews.",
    mediaType: "image",
    mediaUrl: "",
    posterUrl: "",
    ctaText: "Explore Courses",
    ctaLink: "#courses",
    type: "banner",
    priority: 100,
    startDate: "2025-01-01",
    endDate: "2030-12-31",
    isActive: true,
    autoplay: true,
    muted: true,
    loop: true,
    audioEnabled: false,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "default-top-2",
    title: "JEE Main Weekly Test Series",
    subtitle: "Practice • Perform • Improve",
    description: "60-question mocks every Saturday with ranks, solutions and time analysis.",
    mediaType: "image",
    mediaUrl: "",
    posterUrl: "",
    ctaText: "View Test Platform",
    ctaLink: "#contact",
    type: "banner",
    priority: 90,
    startDate: "2025-01-01",
    endDate: "2030-12-31",
    isActive: true,
    autoplay: true,
    muted: true,
    loop: true,
    audioEnabled: false,
    createdAt: "",
    updatedAt: "",
  },
];

function SlideMedia({ ad }: { ad: Advertisement }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(ad.muted !== false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setMuted(ad.muted !== false);
    setFailed(false);
  }, [ad.id, ad.muted]);

  if (ad.mediaType === "video" && ad.mediaUrl && !failed) {
    return (
      <div className="absolute inset-0">
        <video
          ref={ref}
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
          onClick={(e) => {
            e.stopPropagation();
            const v = ref.current;
            if (v) {
              const n = !muted;
              v.muted = n;
              setMuted(n);
              if (!n) v.play().catch(() => {});
            }
          }}
          aria-label={muted ? `Unmute ${ad.title}` : `Mute ${ad.title}`}
          className="absolute bottom-4 right-4 rounded-full bg-black/50 p-2.5 text-white backdrop-blur hover:bg-black/70"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  if (ad.mediaUrl) {
    return (
      <div className="absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ad.mediaUrl} alt={ad.title} className="animate-kenburns h-full w-full object-cover" loading="eager" />
      </div>
    );
  }

  // Cinematic gradient fallback — abstract academy feel, no fake photos
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-navy-800 via-navy-700 to-teal-700">
      <div
        className="animate-kenburns absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(26,166,181,.65) 0, transparent 45%), radial-gradient(circle at 85% 25%, rgba(180,69,61,.55) 0, transparent 40%), radial-gradient(circle at 55% 85%, rgba(217,119,6,.45) 0, transparent 38%), linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)",
          backgroundSize: "auto, auto, auto, 36px 36px, 36px 36px",
        }}
      />
      <div className="animate-float absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-400/25 blur-3xl" />
      <div className="animate-float-slow absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-crimson/25 blur-3xl" />
    </div>
  );
}

/**
 * TopRunningBanner — full-width premium running banner at the very start
 * of the website (directly below the header). Admin-controlled via
 * /admin/advertisements (type = Banner/Course/Admission/Result).
 */
export function TopRunningBanner() {
  const [ads, setAds] = useState<Advertisement[]>(DEFAULT_BANNERS);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const load = useCallback(() => {
    // Phase 11: database banners win; mockStore then static defaults stay fallback.
    void getLiveBanners().then((live) => {
      if (live) {
        setAds(live);
      } else {
        const local = getCarouselAds();
        setAds(local.length > 0 ? local : DEFAULT_BANNERS);
      }
      setIndex(0);
    });
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("neuron-ads-updated", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("neuron-ads-updated", load);
      window.removeEventListener("storage", load);
    };
  }, [load]);

  useEffect(() => {
    if (paused || ads.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % ads.length), 6000);
    return () => clearInterval(t);
  }, [paused, ads.length]);

  const go = (dir: number) => setIndex((i) => (i + dir + ads.length) % ads.length);

  return (
    <section aria-label="Academy announcements" className="metallic-dark relative overflow-hidden border-b border-white/10">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-teal-400 via-white/60 to-crimson" aria-hidden />
      <div
        className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        <div className="overflow-hidden">
          <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
            {ads.map((ad) => (
              <div key={ad.id} className="relative min-h-[300px] w-full shrink-0 sm:min-h-[340px]">
                <SlideMedia ad={ad} />
                <div className="absolute inset-0 bg-gradient-to-r from-navy-800/95 via-navy-800/70 to-navy-800/10" aria-hidden />
                <div className="relative mx-auto flex min-h-[300px] max-w-7xl flex-col justify-center px-4 py-10 sm:min-h-[340px] sm:px-6">
                  <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-teal-300 backdrop-blur">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-300" />
                    {(ad.subtitle || ad.type).toUpperCase()}
                  </p>
                  <h2 className="animate-gradient-text mt-3 max-w-2xl bg-gradient-to-r from-white via-teal-200 to-amber-200 bg-clip-text text-3xl font-extrabold leading-[1.05] tracking-tight text-transparent sm:text-4xl lg:text-[46px]">
                    {ad.title}
                  </h2>
                  <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-silver-200">{ad.description}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {ad.ctaText ? (
                      <a
                        href={ad.ctaLink || "#courses"}
                        className="btn-metallic-sheen inline-flex items-center gap-1.5 rounded-xl bg-crimson px-5 py-2.5 text-sm font-bold text-white shadow-card hover:bg-crimson-bright"
                      >
                        {ad.ctaText} <ArrowRight className="h-4 w-4" />
                      </a>
                    ) : null}
                    <a href="#courses" className="rounded-xl border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-bold text-white backdrop-blur hover:border-teal-300">
                      View All Courses
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* autoplay progress */}
        {!paused && ads.length > 1 ? (
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10" aria-hidden>
            <div
              key={index}
              className="h-full bg-gradient-to-r from-teal-300 via-amber-300 to-crimson-100"
              style={{ animation: "ticker-progress 6s linear forwards" }}
            />
          </div>
        ) : null}
        {ads.length > 1 ? (
          <div className="absolute inset-x-0 bottom-4">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6">
              <div className="flex gap-2">
                {ads.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => setIndex(i)}
                    aria-label={`Show banner ${i + 1}`}
                    className={cn("h-1.5 rounded-full transition-all", i === index ? "w-10 bg-teal-300" : "w-4 bg-white/30 hover:bg-white/60")}
                  />
                ))}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => go(-1)} aria-label="Previous banner" className="rounded-full border border-white/20 bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => go(1)} aria-label="Next banner" className="rounded-full border border-white/20 bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
