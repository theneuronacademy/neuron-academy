import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BackToTop, ScrollProgress } from "@/components/website/motion";
import { ThemeProvider } from "@/components/website/ThemeProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://neuronacademy.in";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Neuron Academy | Activate Your Neuron",
    template: "%s | Neuron Academy",
  },
  description:
    "Neuron Academy official website for courses, faculty, admissions, learning and academic preparation. JEE, NEET, AMU & Jamia entrance coaching in Shaheen Bagh, New Delhi.",
  keywords: ["Neuron Academy", "JEE coaching", "NEET coaching", "AMU entrance", "Jamia entrance", "Shaheen Bagh academy", "admissions", "scholarship test"],
  openGraph: {
    title: "Neuron Academy | Activate Your Neuron",
    description: "Courses, faculty, admissions, learning and academic preparation — JEE, NEET, AMU & Jamia entrances.",
    type: "website",
    siteName: "Neuron Academy",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Neuron Academy | Activate Your Neuron",
    description: "Courses, faculty, admissions, learning and academic preparation.",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/images/logo.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#183653",
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
      "JEE, NEET, AMU & Jamia entrance coaching in Shaheen Bagh, New Delhi — small batches, weekly mocks and mentor-guided preparation.",
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
