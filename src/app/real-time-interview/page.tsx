import PageHero from "@/components/layout/PageHero";
import RequireAuth from "@/components/auth/RequireAuth";
import RealTimeInterviewContent from "@/components/sections/RealTimeInterviewContent";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: "Real Time Job Interview",
  description:
    "Get live technical and behavioral interview support from experienced engineers during your job search — real-time coaching when you need it most.",
  path: "/real-time-interview",
});

export default function RealTimeInterviewPage() {
  return (
    <>
      <PageHero
        title="Real Time Job Interview"
        description="Live interview support from experienced engineers — technical screens, behavioral prep, and real-time coaching while you're in the job search."
      />
      <RequireAuth>
        <RealTimeInterviewContent />
      </RequireAuth>
    </>
  );
}
