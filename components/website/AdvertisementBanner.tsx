"use client";

import { useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { Advertisement } from "@/lib/types";

export function AdvertisementBanner({ ad, compact = false }: { ad: Advertisement; compact?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(ad.muted !== false);
  const [failed, setFailed] = useState(false);

  const showVideo = ad.mediaType === "video" && ad.mediaUrl && !failed;

  return (
    <div className={`relative overflow-hidden rounded-card border border-silver-200 bg-white shadow-card ${compact ? "" : "grid md:grid-cols-2"}`}>
      <div className={`relative ${compact ? "h-48" : "h-56 md:h-full md:min-h-[280px]"} bg-navy-800`}>
        {showVideo ? (
          <video
            ref={videoRef}
            src={ad.mediaUrl}
            poster={ad.posterUrl || undefined}
            autoPlay={ad.autoplay !== false}
            muted={muted}
            loop={ad.loop !== false}
            playsInline
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : ad.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.mediaUrl} alt={ad.title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="bg-metallic-dark absolute inset-0 flex items-center justify-center p-6">
            <p className="text-center text-lg font-extrabold text-white">{ad.title}</p>
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
            aria-label={muted ? `Unmute ${ad.title}` : `Mute ${ad.title}`}
            className="absolute bottom-3 right-3 rounded-full bg-navy-800/80 p-2 text-white backdrop-blur hover:bg-navy-700"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
      <div className="flex flex-col justify-center p-6 sm:p-8">
        {ad.subtitle ? <p className="text-[11px] font-bold tracking-[0.18em] text-teal-600">{ad.subtitle.toUpperCase()}</p> : null}
        <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-navy-700">{ad.title}</h3>
        {ad.description ? <p className="mt-2 text-[14px] leading-relaxed text-muted">{ad.description}</p> : null}
        {ad.ctaText ? (
          <a
            href={ad.ctaLink || "#contact"}
            className="btn-metallic-sheen mt-5 inline-flex w-fit items-center rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-800"
          >
            {ad.ctaText} →
          </a>
        ) : null}
      </div>
    </div>
  );
}
