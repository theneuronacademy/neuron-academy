"use client";

import Link from "next/link";
import { Eye, Pencil, Trash2, Power } from "lucide-react";
import type { Advertisement } from "@/lib/types";
import { AdvertisementStatusBadge } from "@/components/admin/AdvertisementStatusBadge";
import { todayISO } from "@/lib/mockStore";

export function AdvertisementTable({
  ads,
  onToggle,
  onDelete,
  onPreviewPopup,
}: {
  ads: Advertisement[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPreviewPopup: (ad: Advertisement) => void;
}) {
  const today = todayISO();

  if (ads.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-silver-300 bg-white p-10 text-center">
        <p className="text-lg font-extrabold text-navy-700">No advertisements yet.</p>
        <p className="mt-1 text-sm text-muted">Create your first banner, hero or popup.</p>
        <Link href="/admin/advertisements/new" className="mt-4 inline-block rounded-xl bg-crimson px-5 py-2.5 text-sm font-bold text-white">
          Create Advertisement
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-silver-200 bg-white shadow-card">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead>
          <tr className="border-b border-silver-200 bg-silver-50 text-[11px] tracking-widest text-muted">
            <th className="px-4 py-3 font-bold">TITLE</th>
            <th className="px-4 py-3 font-bold">TYPE</th>
            <th className="px-4 py-3 font-bold">MEDIA</th>
            <th className="px-4 py-3 font-bold">STATUS</th>
            <th className="px-4 py-3 font-bold">DATES</th>
            <th className="px-4 py-3 font-bold">PRIORITY</th>
            <th className="px-4 py-3 text-right font-bold">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {ads.map((ad) => (
            <tr key={ad.id} className="border-b border-silver-100 last:border-0 hover:bg-silver-50/60">
              <td className="px-4 py-3">
                <p className="font-extrabold text-navy-700">{ad.title}</p>
                <p className="text-[12px] text-muted">{ad.subtitle}</p>
              </td>
              <td className="px-4 py-3"><span className="rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-bold text-navy-700">{ad.type}</span></td>
              <td className="px-4 py-3 text-[12px] font-bold text-muted">{ad.mediaType}{ad.mediaUrl ? " • uploaded" : " • placeholder"}</td>
              <td className="px-4 py-3"><AdvertisementStatusBadge ad={ad} today={today} /></td>
              <td className="px-4 py-3 text-[12px] text-muted">{ad.startDate} → {ad.endDate}</td>
              <td className="px-4 py-3 font-bold text-navy-700">{ad.priority}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1.5">
                  {ad.type === "popup" ? (
                    <button onClick={() => onPreviewPopup(ad)} aria-label={`Preview popup ${ad.title}`} title="Preview Popup" className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"><Eye className="h-4 w-4" /></button>
                  ) : null}
                  <Link href={`/admin/advertisements/${ad.id}/edit`} aria-label={`Edit ${ad.title}`} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"><Pencil className="h-4 w-4" /></Link>
                  <button onClick={() => onToggle(ad.id)} aria-label={`${ad.isActive ? "Deactivate" : "Activate"} ${ad.title}`} title={ad.isActive ? "Deactivate" : "Activate"} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"><Power className="h-4 w-4" /></button>
                  <button onClick={() => onDelete(ad.id)} aria-label={`Delete ${ad.title}`} className="rounded-lg border border-crimson-100 p-2 text-crimson hover:bg-crimson-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
