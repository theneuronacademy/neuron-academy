"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/**
 * SmartImage — tries to load a real photo from /images/.
 * If the file is missing, falls back to placeholder.
 * Add real photos with zero code changes:
 * just drop hero.jpg / about-campus.jpg / course-*.jpg etc into public/images/.
 */
export function SmartImage({
  src,
  alt,
  className,
  imgClassName,
  fallback,
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallback: ReactNode;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  // A blank src is a data gap (e.g. admin rows saved without an image).
  // Rendering <img src=""> re-requests the current page URL — show the
  // designed fallback node instead.
  if (failed || src.trim() === "") return <>{fallback}</>;

  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src.trim()}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        onError={() => setFailed(true)}
        className={imgClassName ?? "h-full w-full object-cover"}
      />
    </div>
  );
}

export const SITE_PHOTOS = {
  hero: "/images/hero.jpg",
  about: "/images/about-campus.jpg",
  course: (id: string) => `/images/course-${id}.jpg`,
  faculty: (id: string) => `/images/faculty-${id}.jpg`,
  gallery: (id: string) => `/images/gallery-${id}.jpg`,
};
