import type { Metadata } from "next";
import { LegalPage } from "@/components/website/LegalPage";
import { PRIVACY_POLICY } from "@/data/legal";

export const metadata: Metadata = {
  title: PRIVACY_POLICY.title,
  description: PRIVACY_POLICY.description,
  alternates: { canonical: "/privacy-policy" },
};

export default function Page() {
  return <LegalPage doc={PRIVACY_POLICY} />;
}
