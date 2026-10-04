"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdvertisementForm, type AdFormValue } from "@/components/admin/AdvertisementForm";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getAdById, updateAd } from "@/lib/mockStore";

export default function EditAdPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [initial, setInitial] = useState<AdFormValue | null>(null);
  const [ok, setOk] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/admin/login");
      return;
    }
    const ad = getAdById(id);
    if (!ad) {
      setMissing(true);
      return;
    }
    setInitial({
      title: ad.title,
      subtitle: ad.subtitle,
      description: ad.description,
      mediaType: ad.mediaType,
      mediaUrl: ad.mediaUrl,
      posterUrl: ad.posterUrl,
      ctaText: ad.ctaText,
      ctaLink: ad.ctaLink,
      type: ad.type,
      priority: ad.priority,
      startDate: ad.startDate,
      endDate: ad.endDate,
      isActive: ad.isActive,
      autoplay: ad.autoplay,
      muted: ad.muted,
      loop: ad.loop,
      audioEnabled: ad.audioEnabled,
    });
  }, [id, router]);

  if (missing) {
    return (
      <AdminLayout title="Edit Advertisement">
        <p className="rounded-xl bg-white p-6 text-sm font-bold text-muted">Advertisement not found. <a href="/admin/advertisements" className="text-teal-600 underline">Back to list</a></p>
      </AdminLayout>
    );
  }

  if (!initial) {
    return (
      <AdminLayout title="Edit Advertisement">
        <p className="text-sm font-bold text-muted">Loading…</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Edit Advertisement" subtitle={`ID: ${id}`}>
      {ok ? <p className="mb-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-700" role="status">Changes saved. Redirecting…</p> : null}
      <AdvertisementForm
        initial={initial}
        submitLabel="Save Changes"
        onSubmit={(v) => {
          updateAd(id, { ...v });
          setOk(true);
          setTimeout(() => router.push("/admin/advertisements"), 1000);
        }}
      />
    </AdminLayout>
  );
}
