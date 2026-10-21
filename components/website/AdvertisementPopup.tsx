"use client";

import { useEffect, useRef, useState } from "react";
import { X, Volume2, VolumeX } from "lucide-react";
import type { Advertisement } from "@/lib/types";
import { getPopupAds, markPopupDismissed, wasPopupDismissedThisSession } from "@/lib/mockStore";
import { getLivePopups } from "@/services/siteApi";

export function AdvertisementPopup({ forceAd = null }: { forceAd?: Advertisement | null }) {
  const [ad, setAd] = useState<Advertisement | null>(forceAd ?? null);
  const [visible, setVisible] = useState(!!forceAd);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (forceAd) {
      setAd(forceAd);
      setVisible(true);
      return;
    }
    if (wasPopupDismissedThisSession()) return;
    const t = setTimeout(() => {
      // Phase 11: database popups win; mockStore stays dev fallback.
      void getLivePopups().then((live) => {
        const popups = live ?? getPopupAds();
        if (popups.length > 0) {
          setAd(popups[0]);
          setMuted(popups[0].muted !== false);
          setVisible(true);
        }
      });
    }, 5000);
    return () => clearTimeout(t);
  }, [forceAd]);

  if (!visible || !ad) return null;

  const close = () => {
    setVisible(false);
    if (!forceAd) markPopupDismissed();
  };

  const showVideo = ad.mediaType === "video" && ad.mediaUrl;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-navy-800/60 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={ad.title}>
      <div className="relative w-full max-w-lg overflow-hidden rounded-[20px] bg-white shadow-2xl animate-slide-up">
        <button onClick={close} aria-label="Close advertisement" className="absolute right-3 top-3 z-10 rounded-full bg-navy-800/70 p-2 text-white hover:bg-navy-700">
          <X className="h-4 w-4" />
        </button>
        <div className="relative h-56 bg-navy-800 sm:h-64">
          {showVideo ? (
            <video
              ref={videoRef}
              src={ad.mediaUrl}
              poster={ad.posterUrl || undefined}
              autoPlay={ad.autoplay !== false}
              muted={muted}
              loop={ad.loop !== false}
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : ad.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.mediaUrl} alt={ad.title} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="metallic-dark absolute inset-0 flex items-center justify-center p-6">
              <p className="text-center text-xl font-extrabold text-white">{ad.title}</p>
            </div>
          )}
          {showVideo ? (
            <button
              onClick={() => {
                const v = videoRef.current;
                if (v) {
                  const n = !muted;
                  v.muted = n;
                  setMuted(n);
                  if (!n) v.play().catch(() => {});
                }
              }}
              aria-label={muted ? "Enable sound" : "Mute"}
              className="absolute bottom-3 right-3 rounded-full bg-navy-800/80 p-2.5 text-white hover:bg-navy-700"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
        <div className="p-6">
          {ad.subtitle ? <p className="text-[11px] font-bold tracking-[0.18em] text-teal-600">{ad.subtitle.toUpperCase()}</p> : null}
          <h3 className="mt-1 text-xl font-extrabold text-navy-700">{ad.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{ad.description}</p>
          <div className="mt-4 flex gap-2">
            {ad.ctaText ? (
            <a href={ad.ctaLink || "#contact"} onClick={close} className="flex-1 rounded-xl bg-brand-primary px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-brand-primary-hover">
                {ad.ctaText}
              </a>
            ) : null}
            <button onClick={close} className="rounded-xl border border-silver-300 px-4 py-2.5 text-sm font-bold text-navy-700">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
