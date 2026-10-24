import type { Metadata } from "next";
import { Navbar } from "@/components/website/Navbar";
import { Footer } from "@/components/website/Footer";
import { SectionHeader } from "@/components/ui/primitives";
import { FacultyCard } from "@/components/website/FacultyCard";
import { FacultyJsonLd } from "@/components/website/SchemaMarkup";
import { getPublicFacultyList } from "@/services/siteServer";

export const metadata: Metadata = {
  title: "Faculty | Neuron Academy",
  description: "Meet the educators at Neuron Academy — subject specialists for JEE, NEET, AMU & Jamia entrance preparation in Shaheen Bagh, New Delhi.",
};

export default async function FacultyListingPage() {
  const faculty = await getPublicFacultyList();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <SectionHeader
              eyebrow="FACULTY"
              title="Meet the academy’s faculty"
              desc="Learn more about the educators featured by Neuron Academy — each card opens the full profile."
            />
            {faculty.length === 0 ? (
              <p className="mt-10 rounded-card border border-dashed border-silver-300 bg-white p-10 text-center text-sm font-bold text-muted">
                No faculty profiles published yet. Check back soon.
              </p>
            ) : (
              <>
                {faculty.map((f) => (
                  <FacultyJsonLd key={f.id} faculty={f} />
                ))}
                <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {faculty.map((f) => (
                    <FacultyCard key={f.id} f={f} />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
