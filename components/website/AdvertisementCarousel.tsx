"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { getCarouselAds } from "@/lib/mockStore";
import { AdvertisementBanner } from "@/components/website/AdvertisementBanner";
import { cn } from "@/lib/utils";

export function AdvertisementCarousel() {
  const [ads, setAds] = useState(() => (typeof window !== "undefined" ? getCarouselAds() : []));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const load = useCallback(() => {
    setAds(getCarouselAds());
    setIndex(0);
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
    const t = setInterval(() => setIndex((i) => (i + 1) % ads.length), 5000);
    return () => clearInterval(t);
  }, [paused, ads.length]);

  if (ads.length === 0) return null;

  const go = (dir: number) => {
    setPaused(true);
    setIndex((i) => (i + dir + ads.length) % ads.length);
    setTimeout(() => setPaused(false), 6000);
  };

  return (
    <div
      className="relative"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {ads.map((ad) => (
            <div key={ad.id} className="w-full shrink-0 px-0.5">
              <AdvertisementBanner ad={ad} />
            </div>
          ))}
        </div>
      </div>
      {ads.length > 1 ? (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2">
            {ads.map((a, i) => (
              <button
                key={a.id}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={cn("h-2 rounded-full transition-all", i === index ? "w-8 bg-teal-500" : "w-2 bg-silver-300 hover:bg-silver-400")}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPaused(!paused)} aria-label={paused ? "Play carousel" : "Pause carousel"} className="rounded-lg border border-silver-300 bg-white p-2 text-navy-700 hover:border-teal-500">
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button onClick={() => go(-1)} aria-label="Previous advertisement" className="rounded-lg border border-silver-300 bg-white p-2 text-navy-700 hover:border-teal-500">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => go(1)} aria-label="Next advertisement" className="rounded-lg border border-silver-300 bg-white p-2 text-navy-700 hover:border-teal-500">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
