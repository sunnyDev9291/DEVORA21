import type { Metadata } from "next";
import ServicesSection from "@/components/sections/ServicesSection";
import CTASection from "@/components/sections/CTASection";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Explore all Devora21 services — ATS resume support, interview prep, technical interview coaching, debugging, code review, architecture guidance, and career consulting for software engineers.",
};

export default function ServicesPage() {
  return (
    <>
      {/* Page hero */}
      <section className="bg-navy-950 pt-32 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-blue-400 text-sm font-semibold tracking-widest uppercase mb-3">
            What We Offer
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 tracking-tight">
            Every Service an Engineer Needs
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            From your first job application to your next big promotion — we cover every
            critical stage of a software engineer&apos;s career journey.
          </p>
        </div>
      </section>

      <ServicesSection showCTA={false} />
      <CTASection />
    </>
  );
}
