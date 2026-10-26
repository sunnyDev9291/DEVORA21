import type { Metadata } from "next";
// Self-hosted — same Netlify next/font/google breakage risk as root layout.
import "@fontsource/syne/600.css";
import "@fontsource/syne/700.css";
import "@fontsource/syne/800.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import SuperAdminErrorBoundary from "@/components/super-admin/SuperAdminErrorBoundary";
import "./super-admin.css";

export const metadata: Metadata = {
  title: "Super Admin",
  robots: { index: false, follow: false },
};

/** Light ops analytics shell — quiet, airy, distinct from marketing UI. */
export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sa-console relative isolate min-h-[calc(100vh-5rem)] overflow-hidden bg-[var(--sa-bg)] text-[var(--sa-text)]">
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
      <div className="relative z-10">
        <SuperAdminErrorBoundary>{children}</SuperAdminErrorBoundary>
      </div>
    </div>
  );
}
