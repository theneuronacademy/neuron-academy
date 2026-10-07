import { FacultyShell } from "@/components/faculty/FacultyShell";

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  return <FacultyShell title="Faculty" subtitle="Your academic workspace">{children}</FacultyShell>;
}