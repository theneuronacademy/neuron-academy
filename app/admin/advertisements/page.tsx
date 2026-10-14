"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdvertisementTable } from "@/components/admin/AdvertisementTable";
import { AdvertisementPopup } from "@/components/website/AdvertisementPopup";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getAllAds, deleteAd, toggleAdActive, filterAds } from "@/lib/mockStore";
import type { AdFilter, Advertisement } from "@/lib/types";

const FILTERS: AdFilter[] = ["all", "active", "inactive", "scheduled", "expired", "popup", "hero", "banner"];

export default function AdminAdsPage() {
  const router = useRouter();
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [filter, setFilter] = useState<AdFilter>("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Advertisement | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = () => setAds(getAllAds());

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    load();
    window.addEventListener("neuron-ads-updated", load);
    return () => window.removeEventListener("neuron-ads-updated", load);
  }, [router]);

  const visible = filterAds(ads, filter);

  return (
    <AdminLayout title="Advertisements" subtitle="Create hero, banner and popup ads for the public website">
      {/* Legacy local preview surface: edits here never reach the database
          or the website. Use Website → Banners / Popups for live content. */}
      <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] font-bold text-amber-800" role="note">
        Legacy preview — ads listed here are stored only in this browser for design preview and never appear on the website. Manage live content under <Link href="/admin/website/banners" className="underline">Website → Banners</Link> and <Link href="/admin/website/popups" className="underline">Website → Popups</Link>.
      </p>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold capitalize ${filter === f ? "bg-navy-700 text-white" : "border border-silver-300 bg-white text-navy-700 hover:border-teal-500"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <Link href="/admin/website/banners" className="inline-flex items-center gap-1.5 rounded-xl bg-crimson px-4 py-2.5 text-sm font-bold text-white hover:bg-crimson-bright">
          <Plus className="h-4 w-4" /> Manage Live Banners
        </Link>
      </div>

      {toast ? <p className="mb-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-700" role="status">{toast}</p> : null}

      <AdvertisementTable
        ads={visible}
        onToggle={(id) => {
          toggleAdActive(id);
          load();
          setToast("Advertisement status updated.");
          setTimeout(() => setToast(null), 2500);
        }}
        onDelete={(id) => setConfirmId(id)}
        onPreviewPopup={(ad) => setPreview(ad)}
      />

      {confirmId ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-800/60 p-4" role="dialog" aria-modal="true" aria-label="Delete advertisement">
          <div className="w-full max-w-sm rounded-card bg-white p-6 text-center">
            <p className="text-lg font-extrabold text-navy-700">Delete this advertisement?</p>
            <p className="mt-1 text-sm text-muted">It will be removed from this local preview list only. Live website content is managed under Website → Banners / Popups.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmId(null)} className="rounded-xl border border-silver-300 px-4 py-2.5 text-sm font-bold">Cancel</button>
              <button
                onClick={() => {
                  deleteAd(confirmId);
                  setConfirmId(null);
                  load();
                  setToast("Advertisement deleted.");
                  setTimeout(() => setToast(null), 2500);
                }}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? <AdvertisementPopup forceAd={preview} /> : null}
      {preview ? (
        <button onClick={() => setPreview(null)} className="fixed bottom-4 left-1/2 z-[95] -translate-x-1/2 rounded-full bg-navy-700 px-5 py-2.5 text-sm font-bold text-white shadow-card">
          Close Preview
        </button>
      ) : null}
    </AdminLayout>
  );
}
