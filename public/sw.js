/* Neuron Academy service worker (v2) — offline shell + background sync for test answers.
 * - Cache-first for versioned static assets (_next/static) + public images.
 * - Network-first for navigations/API; offline navigations fall back to /offline.
 * - Background sync for offline test answers (when connectivity restored).
 * - No app data is ever faked from cache: API responses are never served stale.
 */
const VERSION = "neuron-v2";
const STATIC_CACHE = `${VERSION}-static`;
const SYNC_TAG = "sync-offline-answers";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(["/offline", "/icon.svg"])).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Versioned static assets + images: cache-first.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/images/") || url.pathname === "/icon.svg") {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            })
        )
      )
    );
    return;
  }

  // API: network-only, never stale.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network-first, offline fallback page.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline").then((r) => r || Response.error())));
  }
});

// Background Sync for offline answers
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncOfflineAnswers());
  }
});

async function syncOfflineAnswers() {
  try {
    // Open IndexedDB and get unsynced answers
    const db = await openOfflineDB();
    const unsynced = await getUnsyncedFromDB(db);

    for (const answer of unsynced) {
      try {
        const res = await fetch(`/api/tests/${answer.testId}/attempt`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId: answer.attemptId,
            answers: answer.answers,
            baseUpdatedAt: new Date(answer.timestamp).toISOString(),
          }),
        });

        if (res.ok) {
          await markSyncedInDB(db, answer.attemptId);
          // Notify client
          self.clients.matchAll().then((clients) => {
            clients.forEach((client) => client.postMessage({ type: "SYNC_COMPLETE", attemptId: answer.attemptId }));
          });
        }
      } catch {
        // Continue with next answer
      }
    }
  } catch (err) {
    console.error("[SW] Background sync failed:", err);
  }
}

// IndexedDB helpers (simplified for SW context)
function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("neuron-offline", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("offline-answers")) {
        const store = db.createObjectStore("offline-answers", { keyPath: "attemptId" });
        store.createIndex("synced", "synced", { unique: false });
      }
    };
  });
}

function getUnsyncedFromDB(db: IDBDatabase): Promise<Array<{ attemptId: string; testId: string; answers: Record<string, string | null>; timestamp: number }>> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline-answers", "readonly");
    const store = tx.objectStore("offline-answers");
    const index = store.index("synced");
    const request = index.getAll(false);
    request.onsuccess = () => resolve(request.result.filter((a) => !a.synced));
    request.onerror = () => reject(request.error);
  });
}

function markSyncedInDB(db: IDBDatabase, attemptId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline-answers", "readwrite");
    const store = tx.objectStore("offline-answers");
    const request = store.get(attemptId);
    request.onsuccess = () => {
      const data = request.result;
      if (data) {
        data.synced = true;
        const putRequest = store.put(data);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Periodic sync registration (if supported)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "periodic-sync-offline-answers") {
    event.waitUntil(syncOfflineAnswers());
  }
});
