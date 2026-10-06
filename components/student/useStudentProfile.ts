"use client";

import { useEffect, useState } from "react";

export interface StudentProfile {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone: string;
  studentType: "REGULAR" | "SCHOLARSHIP";
  status: string;
  batchId: string | null;
  photoUrl: string | null;
  dob: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  school: string | null;
  className: string | null;
  parentName: string | null;
  parentMobile: string | null;
  enrollmentDate: string | null;
  joiningDate: string | null;
  batch: { id: string; name: string } | null;
  course: { id: string; name: string } | null;
}

/** Phase 14 — shared own-profile fetch (server type drives all gating). */
export function useStudentProfile() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/students/me/profile", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (live && res.ok && json?.success === true) {
          setProfile(json.data.item as StudentProfile);
        }
      } catch {
        /* callers show fallback */
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return { profile, loading, refresh: () => setProfile((p) => (p ? { ...p } : p)) };
}

/** Profile completion % over the editable identity fields. */
export function profileCompletion(p: StudentProfile | null): number {
  if (!p) return 0;
  const fields = [p.name, p.photoUrl, p.dob, p.gender, p.address, p.city, p.school, p.className, p.parentName, p.parentMobile];
  const done = fields.filter((f) => f !== null && f !== undefined && String(f).trim() !== "").length;
  return Math.round((done / fields.length) * 100);
}
