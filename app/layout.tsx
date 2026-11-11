import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BackToTop, ScrollProgress } from "@/components/website/motion";
import { ThemeProvider } from "@/components/website/ThemeProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Neuron Academy Shaheen Bagh | JMI, AMU, CBSE, NEET & JEE Coaching",
    template: "%s | Neuron Academy",
  },
  description:
    "Neuron Academy, Shaheen Bagh, New Delhi: coaching for Classes 6 to 12. JMI, AMU and CM SHRI school entrance preparation, CBSE board exams, NEET and JEE.",
  keywords: ["Neuron Academy", "JMI entrance coaching", "Jamia school entrance", "AMU entrance coaching", "CM SHRI entrance", "CBSE board coaching", "NEET coaching", "JEE coaching", "Shaheen Bagh coaching", "scholarship test"],
  openGraph: {
    title: "Neuron Academy Shaheen Bagh | JMI, AMU, CBSE, NEET & JEE Coaching",
    description: "Coaching for Classes 6 to 12 in Shaheen Bagh: JMI, AMU and CM SHRI school entrances, CBSE boards, NEET and JEE.",
    type: "website",
    siteName: "Neuron Academy",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Neuron Academy Shaheen Bagh | JMI, AMU, CBSE, NEET & JEE Coaching",
    description: "Coaching for Classes 6 to 12: JMI, AMU and CM SHRI school entrances, CBSE boards, NEET and JEE.",
  },
  icons: {
    icon: "/images/logo.png",
    apple: "/images/logo.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1746B8",
  width: "device-width",
  initialScale: 1,
};

function OrganizationJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "Neuron Academy",
    url: SITE_URL,
    description:
      "Coaching for Classes 6 to 12 in Shaheen Bagh, New Delhi — JMI, AMU and CM SHRI school entrances, CBSE boards, NEET and JEE, with small batches, weekly mocks and mentor-guided preparation.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Shaheen Bagh, New Delhi",
      addressCountry: "IN",
    },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-ink antialiased">
        <ThemeProvider>
          <ScrollProgress />
          <OrganizationJsonLd />
          {children}
          <BackToTop />
          {/* PWA service worker: offline shell only (never stale app data). */}
          <script
            dangerouslySetInnerHTML={{
              __html: `if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})})}`,
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
