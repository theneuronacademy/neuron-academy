// Phase 6 — database liveness probe (client-safe).
// Pages call isDbLive() to choose API-primary vs local/demo mode.
// Cached per page-load; never throws; SSR returns false (client decides).

let cached: boolean | null = null;

export async function isDbLive(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    if (typeof window === "undefined") return false;
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) {
      cached = false;
      return false;
    }
    const json = await res.json();
    cached = json?.success === true && json?.data?.mode === "database";
    return cached;
  } catch {
    cached = false;
    return false;
  }
}
