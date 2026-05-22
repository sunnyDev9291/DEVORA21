import type { Metadata } from "next";
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
      <section className="bg-slate-50 dark:bg-navy-950 pt-32 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-blue-400 text-sm font-semibold tracking-widest uppercase mb-3">
            FAQ
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white mb-5 tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            Everything you need to know before getting started with Devora21.
          </p>
        </div>
      </section>

      <FAQSection />
      <CTASection />
    </>
  );
}
