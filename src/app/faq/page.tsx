import type { Metadata } from "next";
import Image from "next/image";
import FAQSection from "@/components/sections/FAQSection";
import CTASection from "@/components/sections/CTASection";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about Devora21 — who we help, how we work, pricing, confidentiality, and what makes us different.",
};

export default function FAQPage() {
  return (
    <>
      {/* Hero */}
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
        <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="text-slate-300 text-lg">
            Everything you need to know before getting started with Devora21.
          </p>
        </div>
      </section>

      <FAQSection />
      <CTASection />
    </>
  );
}
