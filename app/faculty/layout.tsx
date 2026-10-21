"use client";

import { usePathname } from "next/navigation";
import { FacultyShell } from "@/components/faculty/FacultyShell";
import { FacultyQueryProvider } from "@/components/faculty/FacultyQueryProvider";
import { LangProvider } from "@/lib/i18n";

const PRIVATE_FACULTY_ROUTES = new Set([
  "dashboard", "batches", "students", "attendance", "tests", "results", "analytics",
  "timetable", "materials", "assignments", "gradebook", "doubts", "notifications", "parents", "profile",
]);

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const isPublicPage =
    pathname === "/faculty/login" ||
    pathname === "/faculty/register" ||
    (segments.length === 2 && segments[0] === "faculty" && !PRIVATE_FACULTY_ROUTES.has(segments[1]));
  const needsShell =
    pathname.startsWith("/faculty/students/") || pathname.startsWith("/faculty/batches/");

  if (isPublicPage) return <>{children}</>;

  return (
    <LangProvider>
      <FacultyQueryProvider>
        {needsShell ? (
          <FacultyShell title="Faculty" subtitle="Your academic workspace">{children}</FacultyShell>
        ) : children}
      </FacultyQueryProvider>
    </LangProvider>
  );
}
