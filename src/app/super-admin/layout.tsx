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

/** Light ops analytics shell — quiet, airy, distinct from marketing UI. */
export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${syne.variable} ${plexMono.variable} sa-console relative isolate min-h-[calc(100vh-5rem)] overflow-hidden bg-[var(--sa-bg)] text-[var(--sa-text)]`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(15, 23, 42, 0.035) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          maskImage: "radial-gradient(ellipse at top, black 15%, transparent 70%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-20 top-[-8%] h-[22rem] w-[22rem] rounded-full bg-teal-200/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 top-[20%] h-[18rem] w-[18rem] rounded-full bg-sky-100/50 blur-3xl"
        aria-hidden
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
