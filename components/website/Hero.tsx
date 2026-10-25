"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Phone, ShieldCheck, MapPin } from "lucide-react";
import { getLiveHeroImage, type LiveHeroImage } from "@/services/siteApi";
import { SmartImage, SITE_PHOTOS } from "@/lib/siteImages";
import { Marquee } from "@/components/website/motion";
import { EXAM_TICKER } from "@/lib/websiteData";
import { PublicBackground } from "@/components/design-system/BackgroundPatterns";

const EXAM_PILLS = [
  { label: "JEE", color: "border-brand-primary/20 bg-brand-primary/10 text-brand-primary" },
  { label: "NEET", color: "border-silver-200 bg-white text-navy-800" },
  { label: "AMU Entrance", color: "border-brand-secondary/40 bg-brand-secondary/15 text-brand-secondary-800" },
  { label: "Jamia Entrance", color: "border-brand-secondary/40 bg-brand-secondary/15 text-brand-secondary-800" },
];

/**
 * Split hero. The right-side card shows the dedicated "Homepage Hero Image"
 * managed independently in Website → Homepage (admin) — it never reads
 * banner records, so banner management cannot change this card and this
 * upload cannot change the full-width banner carousel. Without a dedicated
 * image the card keeps its original campus-photo fallback.
 */
export function Hero() {
  const [heroImage, setHeroImage] = useState<LiveHeroImage | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    void getLiveHeroImage().then((img) => setHeroImage(img));
  }, []);

  const showImage = Boolean(heroImage?.imageUrl) && !imageFailed;

  return (
    <section id="home" className="relative bg-white overflow-hidden">
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
          <div className="group relative isolate h-[350px] overflow-hidden rounded-[24px] border border-silver-200 bg-navy-900 shadow-xl transition duration-500 hover:border-silver-300 hover:shadow-card-hover sm:h-[430px] lg:h-[500px]">
            {showImage ? (
              // object-contain keeps the artwork fully visible at its own
              // aspect ratio — navy backdrop frames whatever is not covered.
              <Image
                src={heroImage?.imageUrl ?? ""}
                alt={heroImage?.altText || "Neuron Academy featured announcement"}
                width={1200}
                height={800}
                unoptimized
                className="h-full w-full object-contain"
                priority
                onError={() => setImageFailed(true)}
              />
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
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur">
                <MapPin className="h-4 w-4 text-brand-secondary-300" /> Shaheen Bagh, New Delhi
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-silver-200 bg-silver-50 py-3">
        <Marquee items={EXAM_TICKER} className="text-navy-700" itemClassName="text-navy-700" />
      </div>
    </section>
  );
}
