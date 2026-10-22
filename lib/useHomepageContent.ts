"use client";

import { useEffect, useState } from "react";

export function useHomepageContent() {
  const [content, setContent] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/homepage/content", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (json?.success && Array.isArray(json.data?.items)) {
            const map: Record<string, string> = {};
            for (const item of json.data.items) {
              if (item.isActive !== false) {
                map[item.key] = item.value;
              }
            }
            if (mounted) setContent(map);
          }
        }
      } catch {
        /* keep empty — fallbacks handle rendering */
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return { content, ready };
}
