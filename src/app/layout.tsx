import type { Metadata } from "next";
// Self-hosted fonts — avoid next/font/google build failures when Google returns
// extensionless /l/font?kit= URLs (Next.js loader TypeError on Netlify/CI).
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SkipLink from "@/components/layout/SkipLink";
import SiteBackground from "@/components/layout/SiteBackground";
import DeferredSmartCursor from "@/components/layout/DeferredSmartCursor";
import ThemeProvider from "@/providers/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
import JsonLd from "@/components/seo/JsonLd";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Job Support & Tech Consulting for Software Engineers`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "software engineer job support",
    "technical interview prep",
    "resume ATS optimization",
    "code review service",
    "debugging support",
    "career guidance engineers",
    "software consulting",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    title: `${SITE_NAME} | Job Support & Tech Consulting for Software Engineers`,
    description: DEFAULT_DESCRIPTION,
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: SITE_URL,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Job Support & Tech Consulting for Software Engineers`,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="light")document.documentElement.classList.remove("dark");else document.documentElement.classList.add("dark");}catch(e){}})();`,
          }}
        />
      </head>
      <body className="relative min-h-screen font-sans bg-transparent text-stone-900 dark:text-stone-50">
        <SiteBackground />
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <ThemeProvider>
          <AuthProvider>
            <SkipLink />
            <Navbar />
            <main id="main-content" className="relative z-0">
              {children}
            </main>
            <Footer />
            <DeferredSmartCursor />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
