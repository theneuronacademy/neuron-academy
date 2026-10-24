"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Volume2, VolumeX, ArrowRight } from "lucide-react";
import { getCarouselAds } from "@/lib/mockStore";
import { getLiveBanners } from "@/services/siteApi";
import type { Advertisement } from "@/lib/types";
import { bannerAnimationClass } from "@/components/website/bannerMotion";
import { cn } from "@/lib/utils";

/** Internal targets (anchors and app routes) navigate in-page; everything
 * else is an external destination that opens safely in a new tab. */
function isInternalHref(href: string): boolean {
  return href.startsWith("/") || href.startsWith("#");
}

function BannerLink({
  href,
  className,
  label,
  children,
}: {
  href: string;
  className: string;
  label: string;
  children: React.ReactNode;
}) {
  if (isInternalHref(href)) {
    if (href.startsWith("#")) {
      return (
        <a href={href} className={className} aria-label={label}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={className} aria-label={label}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={label}>
      {children}
    </a>
  );
}

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
            e.preventDefault();
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
          className="absolute bottom-4 right-4 z-[3] rounded-full bg-black/50 p-2.5 text-white backdrop-blur hover:bg-black/70"
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
        <img
          src={ad.mediaUrl}
          alt={ad.title}
          className="animate-kenburns h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
          loading="eager"
        />
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
      <div className="animate-float absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-secondary/20 blur-3xl" />
      <div className="animate-float-slow absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-brand-primary/20 blur-3xl" />
    </div>
  );
}

/**
 * TopRunningBanner — admin-controlled promotional banners rendered as
 * floating cards: rounded corners, breathing room from the page edge and
 * a polished shadow. The complete card is clickable when a destination
 * URL is configured (external links open safely in a new tab; internal
 * destinations navigate in-page), with the admin-selected motion/entrance
 * animation (motion preferences honoured globally in CSS).
 */
export function TopRunningBanner() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const load = useCallback(() => {
    // Phase 11: database banners win; mockStore stays dev fallback.
    void getLiveBanners().then((live) => {
      if (live && live.length > 0) {
        setAds(live);
      } else {
        const local = getCarouselAds();
        if (local.length > 0) {
          setAds(local);
        } else {
          setAds([]);
        }
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

  if (ads.length === 0) return null;

  return (
    <section aria-label="Academy announcements" className="border-b border-silver-200 bg-gradient-to-b from-white to-silver-50">
      <div className="mx-auto max-w-7xl px-4 pb-5 pt-8 sm:px-6 sm:pb-8">
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
              {ads.map((ad, i) => {
                const isActive = i === index;
                const linked = Boolean(ad.ctaLink);
                return (
                  <div key={ad.id} className="w-full shrink-0 px-0.5 sm:px-1.5">
                    <div
                      className={cn(
                        "group relative min-h-[300px] w-full overflow-hidden rounded-card border border-silver-200 bg-navy-900 shadow-card transition duration-500 hover:border-silver-300 hover:shadow-card-hover sm:min-h-[340px]",
                        // Admin-selected motion style — classes toggle per
                        // activation, so entrance animations replay without
                        // remounting the slide media.
                        isActive && ad.animation && ad.animation !== "none" ? bannerAnimationClass(ad.animation) : "",
                      )}
                    >
                      <SlideMedia ad={ad} />
                      <div className="absolute inset-0 z-[1] bg-gradient-to-r from-navy-800/95 via-navy-800/70 to-navy-800/10" aria-hidden />
                      <div className="relative z-[2] mx-auto flex min-h-[300px] max-w-7xl flex-col justify-center px-4 py-10 sm:min-h-[340px] sm:px-6">
                        <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-brand-secondary-300 backdrop-blur">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-secondary" />
                          {(ad.subtitle || ad.type).toUpperCase()}
                        </p>
                        <h2 className="mt-3 max-w-2xl bg-gradient-to-r from-white via-brand-secondary-200 to-white bg-clip-text text-3xl font-extrabold leading-[1.05] tracking-tight text-transparent sm:text-4xl lg:text-[46px]">
                          {ad.title}
                        </h2>
                        <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-silver-200">{ad.description}</p>
                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          {linked ? (
                            // Whole card navigates to the banner destination —
                            // the stretched link below covers the card.
                            <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand-secondary px-5 py-2.5 text-sm font-bold text-navy-950 shadow-card transition group-hover:bg-brand-secondary-300">
                              {ad.ctaText} <ArrowRight className="h-4 w-4" />
                            </span>
                          ) : ad.ctaText ? (
                            <a href="#courses" className="inline-flex items-center gap-1.5 rounded-xl bg-brand-secondary px-5 py-2.5 text-sm font-bold text-navy-950 shadow-card transition hover:bg-brand-secondary-300">
                              {ad.ctaText} <ArrowRight className="h-4 w-4" />
                            </a>
                          ) : null}
                          {!linked ? (
                            <a href="#courses" className="rounded-xl border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-bold text-white backdrop-blur hover:border-brand-secondary">
                              View All Courses
                            </a>
                          ) : null}
                        </div>
                      </div>
                      {linked ? (
                        <BannerLink
                          href={ad.ctaLink}
                          label={`${ad.title} — open banner destination`}
                          className="absolute inset-0 z-[2] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary/60"
                        >
                          <span className="sr-only">{ad.ctaText || ad.title}</span>
                        </BannerLink>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* autoplay progress */}
          {!paused && ads.length > 1 ? (
            <div className="pointer-events-none absolute inset-x-2 bottom-2 h-[3px] overflow-hidden rounded-full bg-white/10 sm:inset-x-3" aria-hidden>
              <div
                key={index}
                className="h-full origin-left bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary"
                style={{ animation: "ticker-progress 6s linear forwards" }}
              />
            </div>
          ) : null}
        </div>

        {ads.length > 1 ? (
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-2">
              {ads.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Show banner ${i + 1}`}
                  className={cn("h-1.5 rounded-full transition-all", i === index ? "w-10 bg-teal-500" : "w-4 bg-silver-300 hover:bg-silver-400")}
                />
              ))}
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => go(-1)} aria-label="Previous banner" className="rounded-full border border-silver-300 bg-white p-2 text-navy-700 shadow-sm hover:border-teal-500">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => go(1)} aria-label="Next banner" className="rounded-full border border-silver-300 bg-white p-2 text-navy-700 shadow-sm hover:border-teal-500">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
