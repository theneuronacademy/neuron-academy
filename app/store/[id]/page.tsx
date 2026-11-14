import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, CheckCircle2, ExternalLink, FileText, MessageCircle, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/website/Navbar";
import { Footer } from "@/components/website/Footer";
import { BuyForm } from "@/components/store/BuyForm";
import { CONTACT } from "@/data/contact";
import { getDb } from "@/lib/prisma";
import { getStoreItem, getStoreItems } from "@/lib/store";
import { classLabel, courseHighlights, courseSummary, resourceTag, rupees, sizedImage, titleCaseName } from "@/lib/displayText";

// Regenerated at most every five minutes; items come from the admin panel.
export const revalidate = 300;

// Pre-build the items on sale; items added later are generated on first visit
// and then cached like the rest (keeps these pages off the per-request path).
export async function generateStaticParams() {
  return ((await getStoreItems(getDb())) ?? []).map((item) => ({ id: item.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = await getStoreItem(getDb(), id);
  if (!item) return { title: "Item Not Found" };
  const description = `${courseSummary(item.description) || item.title} Digital PDF from Neuron Academy, Shaheen Bagh. Price ${rupees(item.price)}.`.slice(0, 300);
  return {
    title: item.title,
    description,
    alternates: { canonical: `/store/${item.id}` },
    openGraph: { title: item.title, description, type: "website", siteName: "Neuron Academy", locale: "en_IN", url: `/store/${item.id}` },
  };
}

export default async function StoreItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getStoreItem(getDb(), id);
  if (!item) notFound();

  const points = courseHighlights(item.description);
  const summary = courseSummary(item.description);
  const tags = [item.subject && resourceTag(item.subject), item.className && classLabel(item.className), item.category && resourceTag(item.category)].filter(Boolean) as string[];
  const saving = item.mrp ? item.mrp - item.price : 0;
  const whatsapp = `${CONTACT.whatsappHref}?text=${encodeURIComponent(`Hello, I would like to buy "${item.title}".`)}`;

  // Product structured data: lets search engines show the price.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.title,
    description: summary || item.title,
    ...(item.coverImageUrl ? { image: item.coverImageUrl } : {}),
    brand: { "@type": "Organization", name: "Neuron Academy" },
    offers: { "@type": "Offer", price: item.price, priceCurrency: "INR", availability: item.sellable ? "https://schema.org/InStock" : "https://schema.org/PreOrder" },
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/store" className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> All study material
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-[1.05fr_1fr]">
          {/* What you get */}
          <div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-silver-200 bg-gradient-to-br from-silver-50 to-brand-primary/5">
              {item.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sizedImage(item.coverImageUrl, 1000)} alt={`Cover: ${item.title}`} className="absolute inset-0 h-full w-full object-contain p-4" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center bg-navy-800">
                  <BookOpen className="h-12 w-12 text-white" aria-hidden />
                </span>
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-navy-700 ring-1 ring-silver-200">{t}</span>
              ))}
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-navy-700 ring-1 ring-silver-200">
                <FileText className="h-3.5 w-3.5" aria-hidden /> Digital PDF
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-extrabold leading-tight tracking-tight text-navy-950 sm:text-3xl">{item.title}</h1>
            {item.author ? <p className="mt-2 text-sm font-semibold text-neutral-600">By {titleCaseName(item.author)}</p> : null}
            {summary ? <p className="mt-4 text-[15px] leading-relaxed text-neutral-700">{summary}</p> : null}
            {points.length > 0 ? (
              <ul className="mt-5 space-y-2">
                {points.map((pt) => (
                  <li key={pt} className="flex gap-2 text-[15px] leading-snug text-neutral-800">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" aria-hidden /> {pt}
                  </li>
                ))}
              </ul>
            ) : null}
            {item.sampleUrl ? (
              <a href={item.sampleUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-brand-primary underline-offset-4 hover:underline">
                View a free sample <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            ) : null}
          </div>

          {/* Buy */}
          <div>
            <div className="rounded-2xl border border-silver-200 bg-white p-6 shadow-card lg:sticky lg:top-24">
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-4xl font-extrabold text-navy-950">{rupees(item.price)}</span>
                {item.mrp ? <span className="text-lg font-semibold text-neutral-500 line-through">{rupees(item.mrp)}</span> : null}
                {saving > 0 ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[13px] font-bold text-emerald-700 ring-1 ring-emerald-200">Save {rupees(saving)}</span> : null}
              </p>
              <p className="mt-1 text-[13px] text-neutral-600">One-time payment for the PDF.</p>
              <div className="my-5 h-px bg-silver-200" />
              {item.sellable ? (
                <BuyForm bookId={item.id} priceLabel={rupees(item.price)} />
              ) : (
                <div>
                  <p className="text-[15px] leading-relaxed text-neutral-700">Online ordering for this item is not open yet. Message the academy to buy it.</p>
                  <a href={whatsapp} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3.5 text-base font-bold text-white">
                    <MessageCircle className="h-5 w-5" aria-hidden /> Ask on WhatsApp
                  </a>
                </div>
              )}
              <ul className="mt-5 space-y-2 border-t border-silver-200 pt-5 text-[13px] leading-relaxed text-neutral-700">
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" aria-hidden /> You pay Neuron Academy directly. The download unlocks after the academy confirms your payment.</li>
                <li className="flex gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" aria-hidden /> For your own study. Please do not share or resell the file.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
