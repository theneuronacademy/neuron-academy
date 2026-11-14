import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { Navbar } from "@/components/website/Navbar";
import { Footer } from "@/components/website/Footer";
import { SectionHeader } from "@/components/ui/primitives";
import { FindOrder } from "@/components/store/FindOrder";
import { getDb } from "@/lib/prisma";
import { getStoreItems } from "@/lib/store";
import { classLabel, courseSummary, resourceTag, rupees, sizedImage } from "@/lib/displayText";

export const metadata: Metadata = {
  title: "Study Material Store",
  description: "Question banks and study material prepared by Neuron Academy, Shaheen Bagh. Buy online and download as PDF.",
  alternates: { canonical: "/store" },
};

// Regenerated at most every five minutes; prices and items come from the admin panel.
export const revalidate = 300;

export default async function StorePage() {
  const items = (await getStoreItems(getDb())) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <SectionHeader
              eyebrow="STUDY MATERIAL STORE"
              title="Question banks and study material"
              desc="Prepared by Neuron Academy's teachers. Pay online and download the PDF once your payment is confirmed."
            />
            {items.length === 0 ? (
              <p className="mt-10 rounded-card border border-dashed border-silver-300 bg-white p-10 text-center text-sm font-bold text-muted">
                No material is on sale right now. Please check back soon.
              </p>
            ) : (
              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => {
                  const tags = [item.subject && resourceTag(item.subject), item.className && classLabel(item.className), item.category && resourceTag(item.category)].filter(Boolean) as string[];
                  return (
                    <article key={item.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-silver-200 bg-white shadow-card">
                      <Link href={`/store/${item.id}`} className="relative block aspect-[4/3] overflow-hidden bg-gradient-to-br from-silver-50 to-brand-primary/5">
                        {item.coverImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sizedImage(item.coverImageUrl, 800)} alt={`Cover: ${item.title}`} loading="lazy" className="absolute inset-0 h-full w-full object-contain p-3" />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center bg-navy-800">
                            <BookOpen className="h-10 w-10 text-white" aria-hidden />
                          </span>
                        )}
                      </Link>
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((t) => (
                            <span key={t} className="rounded-full bg-silver-50 px-2.5 py-1 text-[11px] font-bold text-navy-700 ring-1 ring-silver-200">{t}</span>
                          ))}
                        </div>
                        <h2 className="mt-3 text-base font-extrabold leading-snug text-navy-950">
                          <Link href={`/store/${item.id}`} className="hover:text-brand-primary">{item.title}</Link>
                        </h2>
                        {item.description ? <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-neutral-700">{courseSummary(item.description)}</p> : null}
                        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                          <p className="flex items-baseline gap-2">
                            <span className="text-2xl font-extrabold text-navy-950">{rupees(item.price)}</span>
                            {item.mrp ? <span className="text-sm font-semibold text-neutral-500 line-through">{rupees(item.mrp)}</span> : null}
                          </p>
                          <Link href={`/store/${item.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-primary-hover">
                            View &amp; buy <ArrowRight className="h-4 w-4" aria-hidden />
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-xl font-extrabold text-navy-950">Already ordered?</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">
            Enter your order number and the mobile number you used to open your order, check its status or download again.
          </p>
          <div className="mt-6 rounded-2xl border border-silver-200 bg-white p-5 shadow-sm">
            <FindOrder />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
