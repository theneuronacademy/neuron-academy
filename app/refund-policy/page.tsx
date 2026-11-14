import type { Metadata } from "next";
import { LegalPage } from "@/components/website/LegalPage";
import { REFUND_POLICY } from "@/data/legal";

export const metadata: Metadata = {
  title: REFUND_POLICY.title,
  description: REFUND_POLICY.description,
  alternates: { canonical: "/refund-policy" },
};

export default function Page() {
  return <LegalPage doc={REFUND_POLICY} />;
}
