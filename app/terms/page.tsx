import type { Metadata } from "next";
import { LegalPage } from "@/components/website/LegalPage";
import { TERMS } from "@/data/legal";

export const metadata: Metadata = {
  title: TERMS.title,
  description: TERMS.description,
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return <LegalPage doc={TERMS} />;
}
