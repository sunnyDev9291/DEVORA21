import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/ui/WhatsAppButton";
import ThemeProvider from "@/providers/ThemeProvider";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Devora21 | Job Support & Tech Consulting for Software Engineers",
    template: "%s | Devora21",
  },
  description:
    "Devora21 helps software engineers get hired, perform better in real work, and solve technical challenges. ATS resume support, interview prep, debugging, code review & career guidance.",
  keywords: [
    "software engineer job support",
    "technical interview prep",
    "resume ATS optimization",
    "code review service",
    "debugging support",
    "career guidance engineers",
    "software consulting",
  ],
  openGraph: {
    title: "Devora21 | Job Support & Tech Consulting for Software Engineers",
    description:
      "Professional job support and technical consulting for software engineers who are ready to level up.",
    type: "website",
    siteName: "Devora21",
  },
  twitter: {
    card: "summary_large_image",
    title: "Devora21 | Job Support & Tech Consulting for Software Engineers",
    description:
      "Professional job support and technical consulting for software engineers.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth dark">
      <body className={`${inter.className} bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100 transition-colors duration-300`}>
        <ThemeProvider>
          <Navbar />
          <main>{children}</main>
          <Footer />
          <WhatsAppButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
