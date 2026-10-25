"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, CheckCircle2, Eye, Upload, RefreshCw, Loader2, ImagePlus, TriangleAlert } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { Button } from "@/components/ui/primitives";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { directCloudinaryUpload } from "@/components/admin/directUpload";

interface Row {
  id: string;
  key: string;
  value: string;
  type: string;
  isActive: boolean;
}

interface HeroImage {
  imageUrl: string;
  altText: string;
  publicId: string;
}

const HERO_FILE_TYPES = "image/jpeg,image/png,image/webp,image/avif,image/gif";

export default function HomepageContentPage() {
  const router = useRouter();
  const { ready: authReady, isAdmin } = useAdminAuth();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState("text");
  const [saved, setSaved] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  // Dedicated homepage hero image (independent from banner management).
  const [hero, setHero] = useState<HeroImage | null>(null);
  const [heroAlt, setHeroAlt] = useState("");
  const [heroBusy, setHeroBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady || !isAdmin) return;
    (async () => {
      try {
        const res = await fetch("/api/homepage/content", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json.data?.items)) {
          setRows(
            (json.data.items as Array<{ id: string; key?: string; value?: string; type?: string; isActive?: boolean }>).map((i) => ({
              id: i.id,
              key: i.key ?? "",
              value: i.value ?? "",
              type: i.type ?? "text",
              isActive: i.isActive ?? true,
            }))
          );
        } else {
          setPageError(json?.error ?? "Could not load homepage content.");
        }
        const heroRes = await fetch("/api/homepage/hero-image", { cache: "no-store" });
        const heroJson = (await heroRes.json().catch(() => null)) as
          | { success?: boolean; data?: { item?: { imageUrl?: string; altText?: string; publicId?: string } | null } }
          | null;
        if (heroRes.ok && heroJson?.success && typeof heroJson.data?.item?.imageUrl === "string" && heroJson.data.item.imageUrl !== "") {
          const item = heroJson.data.item;
          const loaded = { imageUrl: String(item.imageUrl), altText: String(item.altText ?? ""), publicId: String(item.publicId ?? "") };
          setHero(loaded);
          setHeroAlt(loaded.altText);
        }
      } catch {
        setPageError("Cannot reach the server.");
      }
      setReady(true);
    })();
  }, [router, authReady, isAdmin]);

  const save = async () => {
    if (!key.trim()) {
      setFormError("Key is required.");
      return;
    }
    if (!value.trim()) {
      setFormError("Value is required.");
      return;
    }
    setFormError(null);
    try {
      if (editing) {
        const res = await fetch(`/api/homepage/content/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: value.trim(), type, isActive: true }),
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success !== false) {
          setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, value: value.trim(), type, isActive: true } : r)));
          setSaved("Homepage content updated.");
          setModal(false);
          setEditing(null);
        } else {
          setFormError(json?.error ?? "Could not update content. Nothing was saved.");
          return;
        }
      } else {
        const res = await fetch("/api/homepage/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: key.trim(), value: value.trim(), type }),
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && json.data?.item) {
          const item = json.data.item;
          setRows((p) => [...p, { id: item.id, key: item.key, value: item.value, type: item.type, isActive: true }]);
          setSaved("Homepage content added.");
          setModal(false);
        } else {
          setFormError(json?.error ?? "Could not add content. Nothing was saved.");
          return;
        }
      }
    } catch {
      setFormError("Cannot reach the server. Nothing was saved.");
      return;
    }
    setKey("");
    setValue("");
    setType("text");
    window.setTimeout(() => setSaved(null), 2500);
  };

  const toggleActive = async (r: Row) => {
    setPageError(null);
    const next = !r.isActive;
    try {
      const res = await fetch(`/api/homepage/content/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
        cache: "no-store",
      });
      if (res.ok) {
        setRows((p) => p.map((x) => (x.id === r.id ? { ...x, isActive: next } : x)));
      } else {
        setPageError("Could not change visibility.");
      }
    } catch {
      setPageError("Cannot reach the server. Visibility unchanged.");
    }
  };

  const remove = async (r: Row) => {
    if (!window.confirm(`Deactivate "${r.key}"?`)) return;
    setPageError(null);
    try {
      const res = await fetch(`/api/homepage/content/${r.id}`, { method: "DELETE", cache: "no-store" });
      if (res.ok) {
        setRows((p) => p.filter((x) => x.id !== r.id));
        setSaved("Content deactivated.");
      } else {
        setPageError("Could not deactivate content.");
      }
    } catch {
      setPageError("Cannot reach the server. Nothing was changed.");
    }
    window.setTimeout(() => setSaved(null), 2500);
  };

  // --- Dedicated homepage hero image (independent of banner management) ---
  const flashSaved = (message: string) => {
    setSaved(message);
    window.setTimeout(() => setSaved(null), 3000);
  };

  const saveHero = async (payload: { imageUrl: string; publicId: string; altText: string }): Promise<string | null> => {
    try {
      const res = await fetch("/api/homepage/hero-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string; warning?: string; data?: { item?: HeroImage | null } }
        | null;
      if (res.ok && json?.success && json.data?.item?.imageUrl) {
        const item = json.data.item;
        setHero({ imageUrl: item.imageUrl, altText: item.altText ?? "", publicId: item.publicId ?? "" });
        setHeroAlt(item.altText ?? "");
        return json.warning ?? null;
      }
      setPageError(json?.error ?? "Could not save the hero image. Nothing changed.");
      return json?.error ?? "Could not save the hero image.";
    } catch {
      const err = "Cannot reach the server. Nothing was saved.";
      setPageError(err);
      return err;
    }
  };

  const uploadHeroImage = async (file: File, replacement: boolean) => {
    setHeroBusy(true);
    setPageError(null);
    try {
      const uploaded = await directCloudinaryUpload(file, "branding", "image", () => undefined);
      const warning = await saveHero({ imageUrl: uploaded.url, publicId: uploaded.publicId || "", altText: heroAlt });
      if (warning) {
        setNotice(warning);
        window.setTimeout(() => setNotice(null), 5000);
      }
      // The saved banner shows even when a warning was surfaced above it —
      // the image itself is on the website either way.
      flashSaved(replacement ? "Hero image replaced — banner images are untouched." : "Hero image saved — banner images are untouched.");
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Could not upload the hero image.");
    } finally {
      setHeroBusy(false);
    }
  };

  const saveHeroAlt = async () => {
    if (!hero) return;
    setHeroBusy(true);
    setPageError(null);
    const warning = await saveHero({ imageUrl: hero.imageUrl, publicId: hero.publicId, altText: heroAlt });
    if (warning) {
      setNotice(warning);
      window.setTimeout(() => setNotice(null), 5000);
    }
    flashSaved("Hero image details saved.");
    setHeroBusy(false);
  };

  const removeHeroImage = async () => {
    if (!hero) return;
    if (!window.confirm("Remove the homepage hero image? The split-hero card falls back to the default campus photo until a new one is uploaded.")) return;
    setHeroBusy(true);
    setPageError(null);
    try {
      const res = await fetch("/api/homepage/hero-image", { method: "DELETE", cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string; warning?: string } | null;
      if (res.ok && json?.success) {
        setHero(null);
        setHeroAlt("");
        if (typeof json.warning === "string" && json.warning) {
          setNotice(json.warning);
          window.setTimeout(() => setNotice(null), 5000);
        }
        flashSaved("Hero image removed — the homepage card shows the default photo again.");
      } else {
        setPageError(json?.error ?? "Could not remove the hero image. Nothing changed.");
      }
    } catch {
      setPageError("Cannot reach the server. Nothing was removed.");
    } finally {
      setHeroBusy(false);
    }
  };

  if (!ready) {
    return (
      <AdminLayout title="Homepage Content" subtitle="Website → Homepage">
        <LoadingState message="Loading homepage content…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Homepage Content" subtitle="Editable homepage headings and taglines">
      <AdminPageHeader
        title="Homepage Content Manager"
        description={`Edit homepage headings, taglines and CTA labels — ${rows.length} items`}
        actionLabel="Add Content"
        actionIcon={Plus}
        onAction={() => { setEditing(null); setKey(""); setValue(""); setType("text"); setFormError(null); setModal(true); }}
      />
      {pageError ? (
        <p className="rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">
          {pageError}
        </p>
      ) : null}
      {saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] font-bold text-amber-800" role="status">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {notice}
          <button type="button" onClick={() => setNotice(null)} className="ml-auto text-[11px] underline">Dismiss</button>
        </p>
      ) : null}

      {/* Homepage Hero Image — independent upload/lightbox-free manager.
          Saving here never touches banner management images. */}
      <div className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-extrabold text-navy-700">
              <ImagePlus className="h-4 w-4 text-teal-600" /> Homepage Hero Image
            </p>
            <p className="mt-0.5 max-w-xl text-[12px] text-muted">
              The artwork inside the split-hero card on the homepage. Managed separately from banners: uploading here never changes banner images and vice versa. Wide artwork is recommended; it displays fully (no cropping) inside the navy card.
            </p>
          </div>
          {hero ? null : (
            <label className="cursor-pointer rounded-xl bg-navy-700 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-navy-800 disabled:opacity-50">
              <span className="inline-flex items-center gap-2"><Upload className="h-4 w-4" /> Upload image…</span>
              <input
                type="file"
                accept={HERO_FILE_TYPES}
                className="hidden"
                disabled={heroBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadHeroImage(f, false);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        {hero ? (
          <div className="mt-3 flex flex-wrap items-start gap-3">
            <div className="h-28 w-44 shrink-0 overflow-hidden rounded-xl bg-navy-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hero.imageUrl} alt={heroAlt || "Homepage hero image preview"} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <label className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border border-silver-300 px-2.5 py-1.5 text-[12px] font-bold text-navy-700 hover:border-teal-500 ${heroBusy ? "pointer-events-none opacity-50" : ""}`}>
                  {heroBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Replace
                  <input
                    type="file"
                    accept={HERO_FILE_TYPES}
                    className="hidden"
                    disabled={heroBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadHeroImage(f, true);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  onClick={() => void removeHeroImage()}
                  disabled={heroBusy}
                  className="inline-flex items-center gap-1 rounded-lg border border-crimson-100 px-2.5 py-1.5 text-[12px] font-bold text-crimson hover:bg-crimson-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
              <label className="block text-[11px] font-bold text-navy-700">
                Alt text
                <input
                  value={heroAlt}
                  onChange={(e) => setHeroAlt(e.target.value)}
                  placeholder="Describe the image for screen readers (optional)"
                  className="mt-1 w-full rounded-xl border border-silver-300 px-3 py-2 text-[13px] font-medium outline-none focus:border-teal-500"
                />
              </label>
              <div>
                <button
                  type="button"
                  disabled={heroBusy || heroAlt === hero.altText}
                  onClick={() => void saveHeroAlt()}
                  className="rounded-xl bg-teal-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {heroBusy ? "Saving…" : "Save details"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-silver-300 bg-silver-50 px-4 py-3 text-[12px] font-semibold text-muted">
            No hero image uploaded yet — the homepage card shows the default campus photo, not a banner.
          </p>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No homepage content" desc="Add editable homepage text items." action={<Button variant="primary" size="sm" onClick={() => { setEditing(null); setKey(""); setValue(""); setType("text"); setFormError(null); setModal(true); }}>Add Content</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-card border border-silver-200 bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold tracking-widest text-muted uppercase">{r.key}</p>
                  <p className="mt-1 truncate text-[13px] font-extrabold text-navy-700">{r.value}</p>
                  <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${r.type === "url" ? "border-teal-200 bg-teal-50 text-teal-700" : "border-silver-200 bg-silver-50 text-muted"}`}>{r.type}</span>
                </div>
                <button onClick={() => toggleActive(r)} aria-label={`Toggle ${r.key}`} aria-pressed={r.isActive}>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${r.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-silver-200 bg-silver-50 text-muted"}`}>
                    {r.isActive ? "Active" : "Hidden"}
                  </span>
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  onClick={() => {
                    setEditing(r);
                    setKey(r.key);
                    setValue(r.value);
                    setType(r.type);
                    setFormError(null);
                    setModal(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-silver-300 px-2.5 py-1.5 text-[12px] font-bold text-navy-700 hover:border-teal-500"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button onClick={() => remove(r)} className="inline-flex items-center gap-1 rounded-lg border border-crimson-100 px-2.5 py-1.5 text-[12px] font-bold text-crimson hover:bg-crimson-50">
                  <Trash2 className="h-3.5 w-3.5" /> Deactivate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <AdminModal open={modal} title={editing ? "Edit Content" : "Add Content"} onClose={() => { setModal(false); setEditing(null); }}>
        <label className="block text-[12px] font-bold text-navy-700">
          Content key
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. hero.headline" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm" />
          <p className="mt-1 text-[11px] text-muted">Used to look up the value on the public site.</p>
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Value
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. Neuron Academy — Shaheen Bagh" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm" />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-navy-700">
          Type
          <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-base outline-none focus:border-teal-500 sm:text-sm">
            <option value="text">Text</option>
            <option value="url">URL</option>
            <option value="html">HTML</option>
          </select>
        </label>
        {formError ? (
          <p className="mt-3 rounded-xl bg-crimson-50 px-3.5 py-2.5 text-[13px] font-bold text-crimson" role="alert">{formError}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setModal(false); setEditing(null); }}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => void save()}>
            Save
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}
