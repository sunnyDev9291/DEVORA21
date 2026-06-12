import ResumeBuilder from "@/components/sections/ResumeBuilder";
import PageHero from "@/components/layout/PageHero";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: "Resume Builder",
  description:
    "Generate ATS-optimized resume content tailored to any job. Choose a template, enter a job title and description, preview and download your updated resume.",
  path: "/resume",
});

export default function ResumePage() {
  return (
    <>
      <PageHero
        title="Resume Builder"
        description="Choose a template, enter the job details, and we'll generate tailored content and update your resume for download."
      />
      <ResumeBuilder />
    </>
  );
}
