import type { Metadata } from "next";
import Image from "next/image";
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
      <section className="relative pt-32 pb-20 overflow-hidden min-h-[480px] flex items-center">
        <div className="absolute inset-0">
          <Image
            src="/bg.jpeg"
            alt=""
            fill
            className="object-cover object-center"
            priority
            quality={80}
          />
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-navy-950/80" />
        </div>
        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 tracking-tight">
            Every Service an Engineer Needs
          </h1>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">
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
