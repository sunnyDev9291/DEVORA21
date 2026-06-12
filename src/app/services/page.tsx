import ServicesSection from "@/components/sections/ServicesSection";
import CTASection from "@/components/sections/CTASection";
import PageHero from "@/components/layout/PageHero";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: "Services",
  description:
    "Explore all Devora21 services — ATS resume support, interview prep, technical interview coaching, debugging, code review, architecture guidance, and career consulting for software engineers.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
        ])}
      />
      <PageHero
        title="Every Service an Engineer Needs"
        description="From your first job application to your next big promotion — we cover every critical stage of a software engineer's career journey."
      />
      <ServicesSection showCTA={false} />
      <CTASection />
    </>
  );
}
