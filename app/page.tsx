import type { Metadata } from "next";
import HomePageClient from "./HomePageClient";
import { getPublicBannerRows } from "@/services/siteServer";

const TITLE = "Neuron Academy Shaheen Bagh | JMI, AMU, CBSE, NEET & JEE Coaching";
const DESCRIPTION = "Coaching for Classes 6 to 12 in Shaheen Bagh: JMI, AMU and CM SHRI school entrances, CBSE boards, NEET and JEE.";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  // A page-level openGraph replaces the layout's, so the home page states it in full.
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "Neuron Academy", locale: "en_IN", url: "/" },
};

// Re-generate the page every two minutes so admin banner changes reach the
// first HTML quickly; the browser also refreshes banners after loading.
export const revalidate = 120;

export default async function HomePage() {
  const bannerRows = await getPublicBannerRows();
  return <HomePageClient initialBannerRows={bannerRows} />;
}
