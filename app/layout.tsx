import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Neuron Academy | Learn. Prepare. Succeed.",
  description:
    "Neuron Academy official website for courses, faculty, admissions, learning and academic preparation. JEE, NEET, AMU & Jamia entrance coaching in Shaheen Bagh, New Delhi.",
  keywords: ["Neuron Academy", "JEE coaching", "NEET coaching", "AMU entrance", "Jamia entrance", "Shaheen Bagh academy", "admissions"],
  openGraph: {
    title: "Neuron Academy | Learn. Prepare. Succeed.",
    description: "Courses, faculty, admissions, learning and academic preparation — JEE, NEET, AMU & Jamia entrances.",
    type: "website",
    siteName: "Neuron Academy",
  },
  twitter: {
    card: "summary_large_image",
    title: "Neuron Academy | Learn. Prepare. Succeed.",
    description: "Courses, faculty, admissions, learning and academic preparation.",
  },
};

import { SeedInit } from "@/components/SeedInit";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background text-ink antialiased">
        <SeedInit />
        {children}
      </body>
    </html>
  );
}
