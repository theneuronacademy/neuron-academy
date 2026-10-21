"use client";

import type { Advertisement } from "@/lib/types";
import { AdvertisementStatusBadge } from "@/components/admin/AdvertisementStatusBadge";
import { todayISO } from "@/lib/mockStore";

export function AdvertisementPreview({ ad, mode }: { ad: Partial<Advertisement>; mode: "desktop" | "mobile" | "hero" | "banner" | "popup" }) {
  const today = todayISO();
  const full = {
    id: "preview",
    title: ad.title || "SSC CGL 2027",
    subtitle: ad.subtitle || "Admissions Open",
    description: ad.description || "Start your preparation with Neuron Academy.",
    mediaType: ad.mediaType || "image",
    mediaUrl: ad.mediaUrl || "",
    posterUrl: ad.posterUrl || "",
    ctaText: ad.ctaText || "Explore Course",
    ctaLink: ad.ctaLink || "#courses",
    type: ad.type || "banner",
    priority: ad.priority ?? 10,
    startDate: ad.startDate || "2025-01-01",
    endDate: ad.endDate || "2030-12-31",
    isActive: ad.isActive ?? true,
    autoplay: true,
    muted: true,
    loop: true,
    audioEnabled: false,
    createdAt: "",
    updatedAt: "",
  } as Advertisement;

  const isMobile = mode === "mobile";
  const isPopup = mode === "popup";

  return (
    <div className={`overflow-hidden rounded-2xl border border-silver-300 bg-white shadow-card ${isMobile ? "mx-auto max-w-[360px]" : ""}`}>
      <div className="flex items-center justify-between border-b border-silver-200 bg-silver-50 px-3 py-2">
        <p className="text-[11px] font-bold text-muted">PREVIEW • {mode.toUpperCase()}</p>
        <AdvertisementStatusBadge ad={full} today={today} />
      </div>
      {isPopup ? (
        <div className="p-4">
          <div className="overflow-hidden rounded-xl bg-navy-800">
            {full.mediaUrl ? (
              full.mediaType === "video" ? (
                <video src={full.mediaUrl} poster={full.posterUrl || undefined} muted loop playsInline controls className="h-44 w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={full.mediaUrl} alt={full.title} className="h-44 w-full object-cover" />
              )
            ) : (
              <div className="bg-metallic-dark flex h-44 items-center justify-center p-4 text-center text-sm font-extrabold text-white">{full.title}</div>
            )}
          </div>
          <p className="mt-3 text-[11px] font-bold tracking-widest text-teal-600">{full.subtitle.toUpperCase()}</p>
          <p className="text-[15px] font-extrabold text-navy-700">{full.title}</p>
          <p className="mt-1 text-[13px] text-muted">{full.description}</p>
          <span className="mt-3 block rounded-xl bg-crimson px-4 py-2 text-center text-[13px] font-bold text-white">{full.ctaText}</span>
        </div>
      ) : (
        <div className={mode === "hero" ? "" : "grid sm:grid-cols-2"}>
          <div className={`relative bg-navy-800 ${mode === "hero" ? "h-56" : "h-48"}`}>
            {full.mediaUrl ? (
              full.mediaType === "video" ? (
                <video src={full.mediaUrl} poster={full.posterUrl || undefined} muted loop playsInline controls className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={full.mediaUrl} alt={full.title} className="absolute inset-0 h-full w-full object-cover" />
              )
            ) : (
              <div className="bg-metallic-dark absolute inset-0 flex items-center justify-center p-4 text-center text-sm font-extrabold text-white">{full.title}</div>
            )}
          </div>
          <div className="p-4">
            <p className="text-[11px] font-bold tracking-widest text-teal-600">{full.subtitle.toUpperCase()}</p>
            <p className="mt-1 text-lg font-extrabold text-navy-700">{full.title}</p>
            <p className="mt-1 text-[13px] text-muted">{full.description}</p>
            <span className="mt-3 inline-block rounded-xl bg-navy-700 px-4 py-2 text-[13px] font-bold text-white">{full.ctaText} →</span>
          </div>
        </div>
      )}
    </div>
  );
}
