import Link from "next/link";
import { Clock, FileText, Lock, Sparkles } from "lucide-react";
import { AnnouncementBar } from "@/components/website/AnnouncementBar";
import { Navbar } from "@/components/website/Navbar";
import { Footer } from "@/components/website/Footer";
import { SectionHeader } from "@/components/ui/primitives";
import { getDb } from "@/lib/prisma";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scholarship Tests | Neuron Academy",
  description: "Free and paid scholarship mock tests at Neuron Academy, Shaheen Bagh. Register, start your test, and get instant results.",
};

// Phase 13 — public scholarship catalogue. Cacheable (no personalized data);
// metadata only — never questions, answers, or admin internals.
export const revalidate = 60;

interface CatalogueTest {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  totalQuestions: number;
  accessType: string;
  price: number;
  batchName: string | null;
}

async function catalogue(): Promise<CatalogueTest[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db.test.findMany({
      where: { isActive: true, status: { in: ["PUBLISHED", "LIVE"] }, accessType: { in: ["FREE", "PAID"] } },
      select: {
        id: true,
        title: true,
        description: true,
        duration: true,
        totalQuestions: true,
        accessType: true,
        price: true,
        batch: { select: { name: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 100,
    });
    return rows.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      duration: t.duration,
      totalQuestions: t.totalQuestions,
      accessType: t.accessType,
      price: t.price,
      batchName: t.batch?.name ?? null,
    }));
  } catch {
    return [];
  }
}

export default async function ScholarshipTestsPage() {
  const tests = await catalogue();
  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SectionHeader
          eyebrow="SCHOLARSHIP TESTS"
          title="Prove Yourself. Earn Your Scholarship."
          desc="Free scholarship mocks and paid test series — register with your mobile number, start the test, and get instant results."
        />
        {tests.length === 0 ? (
          <div className="mx-auto mt-10 max-w-xl rounded-card border border-dashed border-silver-300 bg-white p-10 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-teal-600" />
            <p className="mt-3 text-lg font-extrabold text-navy-700">New scholarship tests are on the way.</p>
            <p className="mt-1 text-sm text-muted">Register as a student today and you will be notified the moment the first test goes live.</p>
            <Link href="/student/register" className="mt-5 inline-block rounded-xl bg-crimson px-6 py-3 text-sm font-bold text-white">Register as Student →</Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tests.map((t) => (
              <article key={t.id} className="card-lift premium-ring flex flex-col rounded-card bg-white p-6">
                <div className="flex items-center justify-between gap-2">
                  {t.accessType === "FREE" ? (
                    <span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-extrabold tracking-widest text-teal-700">FREE</span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-extrabold tracking-widest text-amber-700">₹{t.price}</span>
                  )}
                  {t.batchName ? <span className="text-[11px] font-bold text-muted">{t.batchName}</span> : null}
                </div>
                <h2 className="mt-3 text-lg font-extrabold tracking-tight text-navy-700">{t.title}</h2>
                {t.description ? <p className="mt-1.5 line-clamp-3 text-[13.5px] leading-relaxed text-muted">{t.description}</p> : null}
                <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] font-bold text-muted">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {t.duration} min</span>
                  <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {t.totalQuestions} questions</span>
                </p>
                <div className="mt-5 grid gap-2 border-t border-silver-100 pt-4">
                  {t.accessType === "FREE" ? (
                    <>
                      <Link href="/student/register" className="btn-metallic-sheen rounded-xl bg-crimson px-4 py-2.5 text-center text-sm font-bold text-white">Register & Start Free →</Link>
                      <Link href="/student/login" className="rounded-xl border border-silver-300 px-4 py-2.5 text-center text-sm font-bold text-navy-700 hover:border-teal-500">Already registered? Login</Link>
                    </>
                  ) : (
                    <>
                      <p className="flex items-center justify-center gap-1.5 text-[13px] font-extrabold text-muted"><Lock className="h-4 w-4" /> Locked • ₹{t.price}</p>
                      <Link href="/student/login" className="rounded-xl bg-navy-700 px-4 py-2.5 text-center text-sm font-bold text-white">Login to Unlock</Link>
                      <p className="text-center text-[12px] font-semibold text-muted">Pay via UPI, then contact the academy to unlock access.</p>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
