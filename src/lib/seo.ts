import type { Metadata } from "next";
import { CONTACT_INFO } from "@/lib/constants";

export const SITE_NAME = "Devora21";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://devora21.com";
export const DEFAULT_DESCRIPTION =
  "Devora21 helps software engineers get hired, perform better in real work, and solve technical challenges. ATS resume support, interview prep, debugging, code review and career guidance.";

export const PUBLIC_ROUTES = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/services", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/how-it-works", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/success-stories", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/faq", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/contact", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/resume", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/real-time-interview", priority: 0.8, changeFrequency: "weekly" as const },
];

export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_URL).toString();
}

export const OG_IMAGE_ALT =
  "Devora21 — Job Support & Tech Consulting for Software Engineers";

/** Shared Open Graph / Twitter preview image (generated at /opengraph-image). */
export const DEFAULT_OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: OG_IMAGE_ALT,
} as const;

export function pageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  noIndex = false,
}: {
  title: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const fullTitle = path === "/" ? title : `${title} | ${SITE_NAME}`;

  return {
    title: path === "/" ? { default: title, template: `%s | ${SITE_NAME}` } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [DEFAULT_OG_IMAGE.url],
    },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/logo.png"),
    description: DEFAULT_DESCRIPTION,
    email: CONTACT_INFO.email,
    sameAs: [CONTACT_INFO.linkedin],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: CONTACT_INFO.email,
      availableLanguage: "English",
    },
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    publisher: { "@type": "Organization", name: SITE_NAME },
  };
}

export function faqPageJsonLd(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export const HERO_IMAGE_ALT =
  "Software engineers working together — Devora21 career and technical consulting";
