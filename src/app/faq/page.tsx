import FAQSection from "@/components/sections/FAQSection";
import CTASection from "@/components/sections/CTASection";
import PageHero from "@/components/layout/PageHero";
import JsonLd from "@/components/seo/JsonLd";
import { FAQS } from "@/lib/constants";
import { breadcrumbJsonLd, faqPageJsonLd, pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: "FAQ",
  description:
    "Frequently asked questions about Devora21 — who we help, how we work, pricing, confidentiality, and what makes us different.",
  path: "/faq",
});

export default function FAQPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "FAQ", path: "/faq" },
          ]),
          faqPageJsonLd(FAQS),
        ]}
      />
      <PageHero
        title="Frequently Asked Questions"
        description="Everything you need to know before getting started with Devora21."
      />
      <FAQSection />
      <CTASection />
    </>
  );
}
