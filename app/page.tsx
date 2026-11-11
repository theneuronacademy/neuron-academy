import type { Metadata } from "next";
import HomePageClient from "./HomePageClient";

const TITLE = "Neuron Academy Shaheen Bagh | JMI, AMU, CBSE, NEET & JEE Coaching";
const DESCRIPTION = "Coaching for Classes 6 to 12 in Shaheen Bagh: JMI, AMU and CM SHRI school entrances, CBSE boards, NEET and JEE.";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  // A page-level openGraph replaces the layout's, so the home page states it in full.
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "Neuron Academy", locale: "en_IN", url: "/" },
};

export default function HomePage() {
  return <HomePageClient />;
}
