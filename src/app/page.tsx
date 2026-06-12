import HeroSection from "@/components/sections/HeroSection";
import StatsSection from "@/components/sections/StatsSection";
import ServicesSection from "@/components/sections/ServicesSection";
import HowItWorksSection from "@/components/sections/HowItWorksSection";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import FAQSection from "@/components/sections/FAQSection";
import CTASection from "@/components/sections/CTASection";
import JsonLd from "@/components/seo/JsonLd";
import { FAQS } from "@/lib/constants";
import { faqPageJsonLd, pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: "Devora21 | Job Support & Tech Consulting for Software Engineers",
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={faqPageJsonLd(FAQS.slice(0, 5))} />
      <HeroSection />
      <StatsSection />
      <ServicesSection limit={6} showCTA={true} />
      <HowItWorksSection />
      <TestimonialsSection limit={3} />
      <FAQSection limit={5} />
      <CTASection />
    </>
  );
}
