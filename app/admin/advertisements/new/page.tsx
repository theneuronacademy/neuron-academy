"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdvertisementForm, defaultFormValue, type AdFormValue } from "@/components/admin/AdvertisementForm";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { createAd } from "@/lib/mockStore";

export default function NewAdPage() {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) router.replace("/admin/login");
  }, [router]);

  const submit = (v: AdFormValue) => {
    createAd({ ...v });
    setOk(true);
    setTimeout(() => router.push("/admin/advertisements"), 1200);
  };

  return (
    <AdminLayout title="Create Advertisement" subtitle="Upload media, set type and publish to the website">
      {ok ? (
        <p className="mb-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-700" role="status">
          Advertisement published successfully. Redirecting…
        </p>
      ) : null}
      <AdvertisementForm initial={defaultFormValue()} submitLabel="Publish" onSubmit={submit} />
    </AdminLayout>
  );
}
