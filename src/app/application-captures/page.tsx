import dynamic from "next/dynamic";
import RequireAuth from "@/components/auth/RequireAuth";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

const ApplicationCapturesGallery = dynamic(
  () => import("@/components/application-captures/ApplicationCapturesGallery"),
  {
    loading: () => (
      <div
        className="flex min-h-[calc(100vh-5rem)] items-center justify-center"
        aria-busy="true"
        aria-label="Loading application captures"
      >
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    ),
  }
);

export const metadata: Metadata = pageMetadata({
  title: "Application Captures",
  description:
    "Browse screenshot sessions captured by the Devora21 Chrome extension when you submit an application.",
  path: "/application-captures",
  noIndex: true,
});

export default function ApplicationCapturesPage() {
  return (
    <RequireAuth>
      <ApplicationCapturesGallery />
    </RequireAuth>
  );
}
