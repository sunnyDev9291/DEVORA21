import type { Metadata } from "next";
import { IBM_Plex_Mono, Syne } from "next/font/google";
import "./super-admin.css";

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
      className={`${syne.variable} ${plexMono.variable} sa-console relative isolate min-h-[calc(100vh-5rem)] overflow-hidden bg-[var(--sa-bg)] text-[var(--sa-text)]`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(45,212,191,0.07) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 top-[-10%] h-[28rem] w-[28rem] rounded-full bg-teal-400/[0.07] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-[-8%] h-[24rem] w-[24rem] rounded-full bg-cyan-500/[0.05] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,_rgba(45,212,191,0.14),_transparent_65%)]"
        aria-hidden
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
