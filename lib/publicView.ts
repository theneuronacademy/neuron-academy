// Public-site API reads.
//
// The public website adds `?view=public` to its reads of /api/courses,
// /api/banners and the other content routes. For those requests the route:
//  - ignores any signed-in session and returns only published rows, so a
//    response can never contain admin drafts or a student's private data; and
//  - marks a successful response as cacheable by Vercel's CDN for a short
//    time, so most visits are answered from the cache instead of running a
//    server function and querying the database.
// Requests without the parameter (the admin panel, student pages) behave
// exactly as before and are never cached.

import type { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/session";

export { publicPath } from "@/lib/publicPath";

/** Seconds a public response may be served from the CDN before it is refreshed. */
const FRESH_SECONDS = 60;
/** Seconds a stale copy may still be served while a fresh one is fetched in the background. */
const STALE_SECONDS = 600;

export function isPublicView(req: Request): boolean {
  try {
    return new URL(req.url).searchParams.get("view") === "public";
  } catch {
    return false;
  }
}

/** The signed-in user, or null for public-view requests (which must not depend on who is asking). */
export function viewerFor(req: NextRequest): ReturnType<typeof getUserFromRequest> {
  return isPublicView(req) ? null : getUserFromRequest(req);
}

/** Make a successful public-view response cacheable on the CDN; anything else is returned unchanged. */
export function withPublicCache<T extends Response>(req: Request, res: T): T {
  if (isPublicView(req) && res.status === 200) {
    res.headers.set("Cache-Control", `public, s-maxage=${FRESH_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`);
  }
  return res;
}
