"use client";

import { useRef, useState } from "react";
import type { AdMediaType, AdType, Advertisement } from "@/lib/types";
import { AdvertisementPreview } from "@/components/admin/AdvertisementPreview";
import { Button } from "@/components/ui/primitives";

export interface AdFormValue {
  title: string;
  subtitle: string;
  description: string;
  mediaType: AdMediaType;
  mediaUrl: string;
  posterUrl: string;
  ctaText: string;
  ctaLink: string;
  type: AdType;
  priority: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  audioEnabled: boolean;
}

const inputCls = "w-full rounded-xl border border-silver-300 bg-white px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";
const labelCls = "mb-1.5 block text-[12px] font-bold tracking-wide text-navy-700";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function AdvertisementForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: AdFormValue;
  submitLabel: string;
  onSubmit: (v: AdFormValue) => void;
}) {
  const [v, setV] = useState<AdFormValue>(initial);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile" | "hero" | "banner" | "popup">("desktop");
  const mediaInput = useRef<HTMLInputElement>(null);
  const posterInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof AdFormValue>(k: K, val: AdFormValue[K]) => setV((p) => ({ ...p, [k]: val }));

  const handleMediaFile = async (f: File | undefined, kind: "media" | "poster") => {
    if (!f) return;
    const isVideo = f.type.startsWith("video/");
    const isImage = f.type.startsWith("image/");
    if (kind === "media") {
      if (v.mediaType === "video" && !isVideo) {
        setError("Media type is Video — please choose a video file (mp4/webm).");
        return;
      }
      if (v.mediaType === "image" && !isImage) {
        setError("Media type is Image — please choose an image file (jpg/png/webp).");
        return;
      }
    } else if (!isImage) {
      setError("Poster must be an image file.");
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      setError("File too large — please keep uploads under 12MB for this demo.");
      return;
    }
    setError(null);
    const url = await fileToDataUrl(f);
    if (kind === "media") set("mediaUrl", url);
    else set("posterUrl", url);
  };

  const validate = (): string | null => {
    if (!v.title.trim()) return "Title is required.";
    if (!v.type) return "Advertisement type is required.";
    if (v.startDate && v.endDate && v.startDate > v.endDate) return "Start date must be before end date.";
    if (!Number.isFinite(v.priority)) return "Priority must be a number.";
    return null;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="space-y-4 rounded-card border border-silver-200 bg-white p-5 shadow-card sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          const err = validate();
          if (err) {
            setError(err);
            return;
          }
          setError(null);
          onSubmit(v);
        }}
      >
        {error ? <p className="rounded-xl border border-crimson-100 bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson-DEFAULT" role="alert">{error}</p> : null}

        <div><label className={labelCls} htmlFor="ad-title">Title *</label><input id="ad-title" className={inputCls} value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="SSC CGL 2027" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelCls} htmlFor="ad-sub">Subtitle</label><input id="ad-sub" className={inputCls} value={v.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="Admissions Open" /></div>
          <div><label className={labelCls} htmlFor="ad-type">Advertisement Type *</label>
            <select id="ad-type" className={inputCls} value={v.type} onChange={(e) => set("type", e.target.value as AdType)}>
              <option value="banner">Banner</option>
              <option value="hero">Hero</option>
              <option value="popup">Popup</option>
              <option value="announcement">Announcement</option>
              <option value="course">Course</option>
              <option value="admission">Admission</option>
              <option value="result">Result</option>
            </select>
          </div>
        </div>
        <div><label className={labelCls} htmlFor="ad-desc">Description</label><textarea id="ad-desc" rows={3} className={inputCls} value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="Start your preparation with Neuron Academy." /></div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelCls} htmlFor="ad-media-type">Media Type</label>
            <select id="ad-media-type" className={inputCls} value={v.mediaType} onChange={(e) => set("mediaType", e.target.value as AdMediaType)}>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div><label className={labelCls} htmlFor="ad-priority">Priority</label><input id="ad-priority" type="number" className={inputCls} value={v.priority} onChange={(e) => set("priority", Number(e.target.value))} /></div>
        </div>

        <div className="rounded-2xl border border-silver-200 bg-silver-50 p-4">
          <p className={labelCls}>Media Upload (demo: browser local)</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => mediaInput.current?.click()}>Upload {v.mediaType === "video" ? "Video" : "Image"}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => posterInput.current?.click()}>Upload Poster</Button>
            {v.mediaUrl ? <Button type="button" variant="ghost" size="sm" onClick={() => set("mediaUrl", "")}>Remove media</Button> : null}
          </div>
          <input ref={mediaInput} type="file" accept={v.mediaType === "video" ? "video/mp4,video/webm" : "image/*"} className="hidden" onChange={(e) => handleMediaFile(e.target.files?.[0], "media")} aria-label="Upload media" />
          <input ref={posterInput} type="file" accept="image/*" className="hidden" onChange={(e) => handleMediaFile(e.target.files?.[0], "poster")} aria-label="Upload poster" />
          <p className="mt-2 text-[12px] text-muted">Images: jpg/png/webp • Videos: mp4/webm • Max 12MB • Preview updates instantly.</p>
          {v.mediaUrl ? <p className="mt-1 truncate text-[12px] font-bold text-teal-600">Media attached ({v.mediaType})</p> : <p className="mt-1 text-[12px] text-muted">No media yet — placeholder gradient will be used.</p>}
        </div>

        <div><label className={labelCls} htmlFor="ad-media-url">Or paste Media URL</label><input id="ad-media-url" className={inputCls} value={v.mediaUrl.startsWith("data:") ? "" : v.mediaUrl} onChange={(e) => set("mediaUrl", e.target.value)} placeholder="https://... (optional)" /></div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelCls} htmlFor="ad-cta">CTA Text</label><input id="ad-cta" className={inputCls} value={v.ctaText} onChange={(e) => set("ctaText", e.target.value)} placeholder="Explore Course" /></div>
          <div><label className={labelCls} htmlFor="ad-link">CTA Link</label><input id="ad-link" className={inputCls} value={v.ctaLink} onChange={(e) => set("ctaLink", e.target.value)} placeholder="#courses or https://..." /></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelCls} htmlFor="ad-start">Start Date</label><input id="ad-start" type="date" className={inputCls} value={v.startDate} onChange={(e) => set("startDate", e.target.value)} /></div>
          <div><label className={labelCls} htmlFor="ad-end">End Date</label><input id="ad-end" type="date" className={inputCls} value={v.endDate} onChange={(e) => set("endDate", e.target.value)} /></div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-silver-200 p-4 text-sm font-bold">
          {([["isActive", "Active"], ["autoplay", "Autoplay"], ["muted", "Muted"], ["loop", "Loop"], ["audioEnabled", "Audio Enabled"]] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-navy-700">
              <input type="checkbox" checked={v[k] as boolean} onChange={(e) => set(k, e.target.checked)} className="h-4 w-4 accent-[#008C9E]" /> {label}
            </label>
          ))}
        </div>

        <Button type="submit" size="lg" className="w-full">{submitLabel}</Button>
      </form>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["desktop", "mobile", "hero", "banner", "popup"] as const).map((m) => (
            <button key={m} onClick={() => setPreviewMode(m)} className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${previewMode === m ? "bg-navy-700 text-white" : "border border-silver-300 bg-white text-navy-700"}`}>
              {m}
            </button>
          ))}
        </div>
        <AdvertisementPreview ad={v as Partial<Advertisement>} mode={previewMode} />
        <p className="text-[12px] text-muted">Live preview — updates as you type. Use Popup mode + “Preview Popup” on the list page to test the real popup component.</p>
      </div>
    </div>
  );
}

export function defaultFormValue(): AdFormValue {
  return {
    title: "SSC CGL 2027",
    subtitle: "Admissions Open",
    description: "Start your preparation with Neuron Academy.",
    mediaType: "image",
    mediaUrl: "",
    posterUrl: "",
    ctaText: "Explore Course",
    ctaLink: "#courses",
    type: "banner",
    priority: 10,
    startDate: "2025-01-01",
    endDate: "2030-12-31",
    isActive: true,
    autoplay: true,
    muted: true,
    loop: true,
    audioEnabled: false,
  };
}
