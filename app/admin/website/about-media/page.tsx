"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, CheckCircle2, TriangleAlert, ArrowUp, ArrowDown, Sparkles, Upload, RefreshCw, Loader2, LayoutGrid } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { LoadingState, EmptyState, ErrorState } from "@/components/admin/AdminStates";
import { SearchBar, AdminToolbar } from "@/components/admin/SearchBar";
import { Button } from "@/components/ui/primitives";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { BANNER_ANIMATIONS } from "@/components/website/bannerMotion";
import { directCloudinaryUpload } from "@/components/admin/directUpload";

interface AboutRow {
  id: string;
  image: string;
  publicId: string;
  caption: string;
  altText: string;
  active: boolean;
  order: number;
}

type QueueStatus = "uploading" | "saving" | "done" | "error";

interface QueueItem {
  key: string;
  name: string;
  status: QueueStatus;
  pct: number;
  error?: string;
}

const LAYOUTS = [
  { value: "grid", label: "Grid", hint: "All images shown together in a responsive grid." },
  { value: "carousel", label: "Carousel", hint: "One large image at a time with swipe/arrow navigation." },
  { value: "rotate", label: "Auto-rotate", hint: "Images rotate automatically; pauses on hover." },
] as const;

/** Upload one image signed-direct to media storage (category "about").
 *  Type/size rules are enforced server-side by the signature route; the signed
 *  direct flow bypasses the serverless body cap, so large-but-valid images no
 *  longer fail with a generic upload error. Progress via XHR. */
function uploadAboutImage(file: File, onProgress: (pct: number) => void): Promise<{ url: string; publicId: string }> {
  return directCloudinaryUpload(file, "about", "image", onProgress);
}

function mapItemToRow(item: Record<string, unknown>): AboutRow {
  return {
    id: String(item.id),
    image: String(item.imageUrl ?? ""),
    publicId: String(item.publicId ?? ""),
    caption: String(item.caption ?? ""),
    altText: String(item.altText ?? ""),
    active: Boolean(item.isActive ?? true),
    order: Number(item.displayOrder ?? 0),
  };
}

export default function AboutMediaPage() {
  const router = useRouter();
  const { ready: authReady, isAdmin } = useAdminAuth();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<AboutRow[]>([]);
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<(typeof LAYOUTS)[number]["value"]>("grid");
  const [animation, setAnimation] = useState<string>("none");
  const [settingsChanged, setSettingsChanged] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) return;
    if (!isAdmin) {
      router.replace("/admin/login");
      return;
    }
    (async () => {
      try {
        const [itemsRes, settingsRes] = await Promise.all([
          fetch("/api/about-media", { cache: "no-store" }),
          fetch("/api/about-media/settings", { cache: "no-store" }),
        ]);
        const itemsJson = await itemsRes.json().catch(() => null);
        if (itemsRes.ok && itemsJson?.success && Array.isArray(itemsJson.data?.items)) {
          setRows((itemsJson.data.items as Array<Record<string, unknown>>).map(mapItemToRow));
          if (typeof itemsJson.data.warning === "string" && itemsJson.data.warning) setNotice(itemsJson.data.warning);
        } else {
          setListError(itemsJson?.error ?? "Could not load About images.");
        }
        const settingsJson = await settingsRes.json().catch(() => null);
        if (settingsRes.ok && settingsJson?.success && settingsJson.data) {
          if (typeof settingsJson.data.warning === "string" && settingsJson.data.warning) {
            setNotice((prev) => prev ?? settingsJson.data.warning);
          }
          if (LAYOUTS.some((l) => l.value === settingsJson.data.layout)) setLayout(settingsJson.data.layout);
          if (typeof settingsJson.data.animation === "string") setAnimation(settingsJson.data.animation);
        }
      } catch {
        setListError("Cannot reach the server. About media unavailable.");
      }
      setReady(true);
    })();
  }, [router, authReady, isAdmin]);

  const filtered = useMemo(
    () =>
      [...rows]
        .sort((a, b) => a.order - b.order)
        .filter((r) => !search.trim() || `${r.caption} ${r.altText}`.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  const patchRow = async (id: string, body: Record<string, unknown>): Promise<boolean> => {
    setPageError(null);
    try {
      const res = await fetch(`/api/about-media/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        if (typeof json.warning === "string" && json.warning) setNotice(json.warning);
        return true;
      }
      setPageError(json?.error ?? "Could not save. Nothing changed.");
      return false;
    } catch {
      setPageError("Cannot reach the server. Nothing changed.");
      return false;
    }
  };

  const addToQueue = (files: File[]) => {
    const items: QueueItem[] = files.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, status: "uploading", pct: 0 }));
    setQueue((q) => [...q, ...items]);
    (async () => {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const key = items[i].key;
        const setItem = (patch: Partial<QueueItem>) =>
          setQueue((q) => q.map((item) => (item.key === key ? { ...item, ...patch } : item)));
        try {
          const uploaded = await uploadAboutImage(file, (pct) => setItem({ pct }));
          setItem({ status: "saving", pct: 100 });
          const res = await fetch("/api/about-media", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageUrl: uploaded.url,
              publicId: uploaded.publicId || undefined,
              isActive: true,
            }),
            cache: "no-store",
          });
          const json = await res.json().catch(() => null);
          if (res.ok && json?.success && json.data?.item) {
            setRows((p) => [...p, mapItemToRow(json.data.item)]);
            setItem({ status: "done" });
            if (typeof json.warning === "string" && json.warning) setNotice(json.warning);
          } else {
            setItem({ status: "error", error: json?.error ?? "Image uploaded, but it could not be added to the section. Try again." });
          }
        } catch (err) {
          setItem({ status: "error", error: err instanceof Error ? err.message : "Upload failed." });
        }
      }
      setQueue((q) => q.filter((item) => item.status === "error"));
      setSaved("Uploads finished — files with problems are listed above.");
      window.setTimeout(() => setSaved(null), 3000);
    })();
  };

  const replaceImage = async (r: AboutRow, file: File) => {
    setRowBusy(r.id);
    try {
      const uploaded = await uploadAboutImage(file, () => undefined);
      const ok2 = await patchRow(r.id, { imageUrl: uploaded.url, publicId: uploaded.publicId || "" });
      if (ok2) {
        setRows((p) => p.map((x) => (x.id === r.id ? { ...x, image: uploaded.url, publicId: uploaded.publicId || "" } : x)));
        setSaved("Image replaced — the About section updates seamlessly.");
      }
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Could not replace the image. Nothing changed.");
    } finally {
      setRowBusy(null);
      window.setTimeout(() => setSaved(null), 3000);
    }
  };

  const saveText = async (r: AboutRow, caption: string, altText: string) => {
    setRowBusy(r.id);
    const ok2 = await patchRow(r.id, { caption, altText });
    if (ok2) {
      setRows((p) => p.map((x) => (x.id === r.id ? { ...x, caption, altText } : x)));
      setSaved("Image details saved.");
    }
    setRowBusy(null);
    window.setTimeout(() => setSaved(null), 3000);
  };

  const toggleActive = async (r: AboutRow) => {
    setRowBusy(r.id);
    const next = !r.active;
    const ok2 = await patchRow(r.id, { isActive: next });
    if (ok2) setRows((p) => p.map((x) => (x.id === r.id ? { ...x, active: next } : x)));
    setRowBusy(null);
  };

  const remove = async (r: AboutRow) => {
    if (!window.confirm(`Remove this About image${r.caption ? ` (${r.caption})` : ""}? This cannot be undone.`)) return;
    setPageError(null);
    try {
      const res = await fetch(`/api/about-media/${r.id}`, { method: "DELETE", cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        if (typeof json?.warning === "string" && json.warning) setNotice(json.warning);
        setRows((p) => p.filter((x) => x.id !== r.id));
        setSaved("Image removed.");
      } else {
        setPageError(json?.error ?? "Could not remove the image. Nothing was deleted.");
      }
    } catch {
      setPageError("Cannot reach the server. Nothing was deleted.");
    }
    window.setTimeout(() => setSaved(null), 2500);
  };

  const move = async (r: AboutRow, dir: -1 | 1) => {
    const sorted = [...rows].sort((a, b) => a.order - b.order);
    const i = sorted.findIndex((x) => x.id === r.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    [next[i], next[j]] = [next[j], next[i]];
    const ordered = next.map((x, idx) => ({ ...x, order: idx + 1 }));
    setPageError(null);
    try {
      const results = await Promise.all(
        [ordered[i], ordered[j]].map((x) =>
          fetch(`/api/about-media/${x.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayOrder: x.order }),
            cache: "no-store",
          }).then((res) => res.ok).catch(() => false)
        )
      );
      if (results.every(Boolean)) {
        setRows((p) => p.map((x) => ordered.find((o) => o.id === x.id) ?? x));
      } else {
        setPageError("Could not save the new order. Order unchanged.");
      }
    } catch {
      setPageError("Cannot reach the server. Order unchanged.");
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    setPageError(null);
    try {
      const res = await fetch("/api/about-media/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout, animation }),
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setSettingsChanged(false);
        setSaved("About media settings saved — the section updates on the website.");
        if (typeof json.warning === "string" && json.warning) setNotice(json.warning);
      } else {
        setPageError(json?.error ?? "Could not save settings. Nothing changed.");
      }
    } catch {
      setPageError("Cannot reach the server. Settings unchanged.");
    } finally {
      setSavingSettings(false);
      window.setTimeout(() => setSaved(null), 3000);
    }
  };

  if (!ready) {
    return (
      <AdminLayout title="About Media" subtitle="Website → About Media">
        <LoadingState message="Loading About images…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="About Media" subtitle='"About the Academy" images — fully independent from the gallery'>
      <AdminPageHeader
        title="About the Academy — Media"
        description={`${filtered.length} images • choose layout and entry motion; captions and alt text per image.`}
      />
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {saved}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] font-bold text-amber-800" role="status">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {notice}
          <button type="button" onClick={() => setNotice(null)} className="ml-auto text-[11px] underline">Dismiss</button>
        </p>
      ) : null}
      {pageError ? (
        <p className="mt-2 rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">
          {pageError}
        </p>
      ) : null}

      {/* Upload queue — multiple files at once. */}
      <div className="rounded-card border border-teal-200 bg-teal-50/50 p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-extrabold text-navy-700">
              <Upload className="h-4 w-4 text-teal-600" /> Add images
            </p>
            <p className="mt-0.5 text-[12px] text-muted">
              Multiple photos upload one after another to media storage, then each becomes its own row below. Images and captions stay independent of the academy gallery.
            </p>
          </div>
          <label className="cursor-pointer rounded-xl bg-navy-700 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-navy-800 disabled:opacity-50">
            Choose images…
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              multiple
              className="hidden"
              disabled={queue.some((q) => q.status === "uploading" || q.status === "saving")}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) addToQueue(files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {queue.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {queue.map((item) => (
              <li key={item.key} className="flex items-center gap-3 rounded-xl border border-silver-200 bg-white px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-navy-700">{item.name}</span>
                {item.status === "uploading" || item.status === "saving" ? (
                  <span className="flex items-center gap-2 text-[11px] font-bold text-navy-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {item.status === "saving" && item.pct === 100 ? "Creating image…" : `Uploading… ${item.pct}%`}
                  </span>
                ) : null}
                {item.status === "done" ? <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Added</span> : null}
                {item.status === "error" ? <span className="flex items-center gap-1 text-[11px] font-bold text-crimson"><TriangleAlert className="h-3.5 w-3.5" /> {item.error}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Layout + motion settings. */}
      <div className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
        <p className="flex items-center gap-2 text-[13px] font-extrabold text-navy-700">
          <LayoutGrid className="h-4 w-4 text-teal-600" /> Section layout & motion
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LAYOUTS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              title={opt.hint}
              aria-pressed={layout === opt.value}
              onClick={() => {
                setLayout(opt.value);
                setSettingsChanged(true);
              }}
              className={`rounded-xl border px-3 py-2 text-left text-[12px] font-bold transition ${layout === opt.value ? "border-teal-500 bg-teal-50 text-teal-700" : "border-silver-300 bg-white text-navy-700 hover:border-teal-400"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted">{LAYOUTS.find((o) => o.value === layout)?.hint}</p>
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-navy-700">
            <Sparkles className="h-3.5 w-3.5 text-teal-600" /> Motion / Animation Style
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {BANNER_ANIMATIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={opt.hint}
                aria-pressed={animation === opt.value}
                onClick={() => {
                  setAnimation(opt.value);
                  setSettingsChanged(true);
                }}
                className={`rounded-xl border px-3 py-2 text-left text-[12px] font-bold transition ${animation === opt.value ? "border-teal-500 bg-teal-50 text-teal-700" : "border-silver-300 bg-white text-navy-700 hover:border-teal-400"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">{BANNER_ANIMATIONS.find((o) => o.value === animation)?.hint ?? "Images appear without motion."}</p>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="primary" size="sm" disabled={!settingsChanged || savingSettings} onClick={() => void saveSettings()}>
            {savingSettings ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </div>

      <AdminToolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Search captions…" />
      </AdminToolbar>

      {listError ? (
        <ErrorState message={listError} onRetry={() => window.location.reload()} />
      ) : null}
      {!listError && filtered.length === 0 ? (
        <EmptyState
          title="No About images yet"
          desc='The "About the Academy" section keeps showing the default campus photo until at least one image is active — add photos above without breaking the section.'
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((r) => (
            <AboutRowCard
              key={r.id}
              row={r}
              busy={rowBusy === r.id}
              onReplace={replaceImage}
              onSaveText={saveText}
              onToggle={toggleActive}
              onRemove={remove}
              onMove={move}
            />
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

interface AboutRowCardProps {
  row: AboutRow;
  busy: boolean;
  onReplace: (r: AboutRow, file: File) => Promise<void>;
  onSaveText: (r: AboutRow, caption: string, altText: string) => Promise<void>;
  onToggle: (r: AboutRow) => Promise<void>;
  onRemove: (r: AboutRow) => Promise<void>;
  onMove: (r: AboutRow, dir: -1 | 1) => Promise<void>;
}

/** One About image card: replace, reorder, publish toggle, remove, caption/alt editing. */
function AboutRowCard({ row, busy, onReplace, onSaveText, onToggle, onRemove, onMove }: AboutRowCardProps) {
  const [caption, setCaption] = useState(row.caption);
  const [altText, setAltText] = useState(row.altText);
  return (
    <div className="rounded-card border border-silver-200 bg-white p-3 shadow-card">
      <div className="flex gap-3">
        <div className="h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-navy-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.image} alt={altText || caption || "About the Academy"} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-bold tracking-widest text-muted">ORDER {row.order}</p>
            <button onClick={() => void onToggle(row)} aria-label={`Toggle visibility of About image ${row.order}`} aria-pressed={row.active} disabled={busy}>
              <AdminStatusBadge tone={row.active ? "green" : "gray"}>{row.active ? "Active" : "Inactive"}</AdminStatusBadge>
            </button>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <label className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border border-silver-300 px-2.5 py-1.5 text-[12px] font-bold text-navy-700 hover:border-teal-500 ${busy ? "opacity-50 pointer-events-none" : ""}`}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Replace
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onReplace(row, f);
                  e.target.value = "";
                }}
              />
            </label>
            <button onClick={() => void onMove(row, -1)} aria-label="Move up" className="rounded-lg border border-silver-300 p-1.5 text-navy-700 hover:border-teal-500">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => void onMove(row, 1)} aria-label="Move down" className="rounded-lg border border-silver-300 p-1.5 text-navy-700 hover:border-teal-500">
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => void onRemove(row)} className="inline-flex items-center gap-1 rounded-lg border border-crimson-100 px-2.5 py-1.5 text-[12px] font-bold text-crimson hover:bg-crimson-50">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        </div>
      </div>
      <div className="mt-2 grid gap-2">
        <label className="block text-[11px] font-bold text-navy-700">
          Caption
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Shown under the image (optional)"
            className="mt-1 w-full rounded-xl border border-silver-300 px-3 py-2 text-[13px] font-medium outline-none focus:border-teal-500"
          />
        </label>
        <label className="block text-[11px] font-bold text-navy-700">
          Alt text
          <input
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Describe the image for screen readers (optional)"
            className="mt-1 w-full rounded-xl border border-silver-300 px-3 py-2 text-[13px] font-medium outline-none focus:border-teal-500"
          />
        </label>
        <div>
          <button
            type="button"
            disabled={busy || (caption === row.caption && altText === row.altText)}
            onClick={() => void onSaveText(row, caption, altText)}
            className="rounded-xl bg-teal-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save details"}
          </button>
        </div>
      </div>
    </div>
  );
}
