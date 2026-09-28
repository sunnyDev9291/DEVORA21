import type { Metadata } from "next";
import { IBM_Plex_Mono, Syne } from "next/font/google";

const syne = Syne({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sa-display",
  weight: ["600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sa-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Super Admin",
  robots: { index: false, follow: false },
};

/** Ops console shell — intentionally unlike the warm marketing / dashboard UI. */
export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${syne.variable} ${plexMono.variable} sa-console relative isolate min-h-[calc(100vh-5rem)] bg-[#0b0f14] text-[#d7e0ea]`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(94,234,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(94,234,212,0.04) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,_rgba(45,212,191,0.12),_transparent_60%)]"
        aria-hidden
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
